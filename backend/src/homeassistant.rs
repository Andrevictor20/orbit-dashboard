use axum::{
    extract::Path,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use crate::state::AppState;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct HomeAssistantConfig {
    pub url: String,
    pub token: String,
    pub enabled: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ConfigResponse {
    pub configured: bool,
    pub connected: bool,
    pub url: String,
    pub version: Option<String>,
    pub location_name: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SaveConfigRequest {
    pub url: String,
    pub token: String,
}

static HA_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
});

static HA_CONFIG_CACHE: Lazy<Arc<RwLock<Option<HomeAssistantConfig>>>> = Lazy::new(|| {
    let path = get_config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(config) = serde_json::from_str::<HomeAssistantConfig>(&data) {
            return Arc::new(RwLock::new(Some(config)));
        }
    }
    Arc::new(RwLock::new(None))
});

pub fn get_config_path() -> PathBuf {
    let mut path = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    path.push("data");
    path.push("homeassistant.json");
    path
}

fn save_config_to_disk(config: &Option<HomeAssistantConfig>) {
    let path = get_config_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Some(cfg) = config {
        if let Ok(json) = serde_json::to_string_pretty(cfg) {
            let _ = fs::write(&path, json);
        }
    } else if path.exists() {
        let _ = fs::remove_file(&path);
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/homeassistant/config", get(get_config).post(save_config).delete(delete_config))
        .route("/api/homeassistant/entities", get(get_entities))
        .route("/api/homeassistant/services/{domain}/{service}", post(call_service))
        .route("/api/homeassistant/camera_proxy/{entity_id}", get(camera_proxy))
}

pub async fn get_config() -> impl IntoResponse {
    let current = {
        let guard = HA_CONFIG_CACHE.read().unwrap();
        guard.clone()
    };

    match current {
        None => (
            StatusCode::OK,
            Json(ConfigResponse {
                configured: false,
                connected: false,
                url: String::new(),
                version: None,
                location_name: None,
                error: None,
            }),
        ).into_response(),
        Some(cfg) => {
            let clean_url = cfg.url.trim_end_matches('/');
            let check_url = format!("{}/api/config", clean_url);

            match HA_CLIENT
                .get(&check_url)
                .bearer_auth(&cfg.token)
                .send()
                .await
            {
                Ok(resp) if resp.status().is_success() => {
                    let info: serde_json::Value = resp.json().await.unwrap_or_default();
                    let version = info.get("version").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let location_name = info.get("location_name").and_then(|v| v.as_str()).map(|s| s.to_string());

                    (
                        StatusCode::OK,
                        Json(ConfigResponse {
                            configured: true,
                            connected: true,
                            url: cfg.url,
                            version,
                            location_name,
                            error: None,
                        }),
                    ).into_response()
                }
                Ok(resp) => {
                    let err_msg = format!("Home Assistant returned status {}", resp.status());
                    (
                        StatusCode::OK,
                        Json(ConfigResponse {
                            configured: true,
                            connected: false,
                            url: cfg.url,
                            version: None,
                            location_name: None,
                            error: Some(err_msg),
                        }),
                    ).into_response()
                }
                Err(e) => {
                    let err_msg = format!("Could not reach Home Assistant: {}", e);
                    (
                        StatusCode::OK,
                        Json(ConfigResponse {
                            configured: true,
                            connected: false,
                            url: cfg.url,
                            version: None,
                            location_name: None,
                            error: Some(err_msg),
                        }),
                    ).into_response()
                }
            }
        }
    }
}

pub async fn save_config(Json(payload): Json<SaveConfigRequest>) -> impl IntoResponse {
    let trimmed_url = payload.url.trim();
    let trimmed_token = payload.token.trim();

    if !trimmed_url.starts_with("http://") && !trimmed_url.starts_with("https://") {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "URL must start with http:// or https://" })),
        ).into_response();
    }

    if trimmed_token.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Token cannot be empty" })),
        ).into_response();
    }

    let clean_url = trimmed_url.trim_end_matches('/').to_string();

    // Verify connectivity with Home Assistant API
    let test_url = format!("{}/api/", clean_url);
    let resp = match HA_CLIENT
        .get(&test_url)
        .bearer_auth(trimmed_token)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": format!("Failed to connect to Home Assistant at {}: {}", clean_url, e)
                })),
            ).into_response();
        }
    };

    if !resp.status().is_success() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": format!("Authentication failed: Home Assistant responded with status {}", resp.status())
            })),
        ).into_response();
    }

    // Try fetching extra details (version, location)
    let mut version: Option<String> = None;
    let mut location_name: Option<String> = None;
    let config_url = format!("{}/api/config", clean_url);
    if let Ok(config_resp) = HA_CLIENT.get(&config_url).bearer_auth(trimmed_token).send().await {
        if let Ok(val) = config_resp.json::<serde_json::Value>().await {
            version = val.get("version").and_then(|v| v.as_str()).map(|s| s.to_string());
            location_name = val.get("location_name").and_then(|v| v.as_str()).map(|s| s.to_string());
        }
    }

    let new_config = HomeAssistantConfig {
        url: clean_url,
        token: trimmed_token.to_string(),
        enabled: true,
    };

    {
        let mut guard = HA_CONFIG_CACHE.write().unwrap();
        *guard = Some(new_config.clone());
    }

    save_config_to_disk(&Some(new_config));

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "status": "ok",
            "message": "Connected to Home Assistant successfully",
            "version": version,
            "location_name": location_name
        })),
    ).into_response()
}

pub async fn delete_config() -> impl IntoResponse {
    {
        let mut guard = HA_CONFIG_CACHE.write().unwrap();
        *guard = None;
    }
    save_config_to_disk(&None);

    (
        StatusCode::OK,
        Json(serde_json::json!({ "status": "ok", "message": "Home Assistant disconnected" })),
    ).into_response()
}

pub async fn get_entities() -> impl IntoResponse {
    let cfg = {
        let guard = HA_CONFIG_CACHE.read().unwrap();
        guard.clone()
    };

    let cfg = match cfg {
        Some(c) if c.enabled => c,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Home Assistant is not configured or enabled" })),
            ).into_response();
        }
    };

    let states_url = format!("{}/api/states", cfg.url.trim_end_matches('/'));
    match HA_CLIENT
        .get(&states_url)
        .bearer_auth(&cfg.token)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            match resp.json::<serde_json::Value>().await {
                Ok(data) => (StatusCode::OK, Json(data)).into_response(),
                Err(e) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({ "error": format!("Failed to parse entities: {}", e) })),
                ).into_response(),
            }
        }
        Ok(resp) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": format!("Home Assistant returned status {}", resp.status()) })),
        ).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": format!("Failed to reach Home Assistant: {}", e) })),
        ).into_response(),
    }
}

pub async fn call_service(
    Path((domain, service)): Path<(String, String)>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    let cfg = {
        let guard = HA_CONFIG_CACHE.read().unwrap();
        guard.clone()
    };

    let cfg = match cfg {
        Some(c) if c.enabled => c,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Home Assistant is not configured or enabled" })),
            ).into_response();
        }
    };

    let service_url = format!("{}/api/services/{}/{}", cfg.url.trim_end_matches('/'), domain, service);
    match HA_CLIENT
        .post(&service_url)
        .bearer_auth(&cfg.token)
        .json(&payload)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            let data: serde_json::Value = resp.json().await.unwrap_or(serde_json::json!({"status": "ok"}));
            (StatusCode::OK, Json(data)).into_response()
        }
        Ok(resp) => {
            let error_text = resp.text().await.unwrap_or_default();
            (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": format!("Service call failed: {}", error_text) })),
            ).into_response()
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": format!("Failed to reach Home Assistant: {}", e) })),
        ).into_response(),
    }
}

pub async fn camera_proxy(Path(entity_id): Path<String>) -> impl IntoResponse {
    let cfg = {
        let guard = HA_CONFIG_CACHE.read().unwrap();
        guard.clone()
    };

    let cfg = match cfg {
        Some(c) if c.enabled => c,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Home Assistant is not configured or enabled" })),
            ).into_response();
        }
    };

    let proxy_url = format!("{}/api/camera_proxy/{}", cfg.url.trim_end_matches('/'), entity_id);
    match HA_CLIENT
        .get(&proxy_url)
        .bearer_auth(&cfg.token)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            let content_type = resp
                .headers()
                .get("content-type")
                .and_then(|h| h.to_str().ok())
                .unwrap_or("image/jpeg")
                .to_string();
            let bytes = resp.bytes().await.unwrap_or_default();
            (
                StatusCode::OK,
                [(axum::http::header::CONTENT_TYPE, content_type)],
                bytes,
            ).into_response()
        }
        Ok(resp) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": format!("Camera proxy returned status {}", resp.status()) })),
        ).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": format!("Failed to reach camera: {}", e) })),
        ).into_response(),
    }
}

