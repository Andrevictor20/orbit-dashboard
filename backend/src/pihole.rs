use axum::{
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
use std::time::{Duration, Instant};
use crate::state::AppState;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct PiHoleConfig {
    pub url: String,
    pub token: Option<String>,
    pub enabled: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PiHoleConfigResponse {
    pub configured: bool,
    pub connected: bool,
    pub url: String,
    pub status: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SavePiHoleConfigRequest {
    pub url: String,
    pub token: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToggleBlockingRequest {
    pub enable: bool,
    pub duration_seconds: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DomainActionRequest {
    pub domain: String,
    pub list_type: String, // "white" or "black"
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PiHoleDomainItem {
    pub domain: String,
    pub list_type: String,
    pub enabled: bool,
}

struct CachedStats {
    data: serde_json::Value,
    timestamp: Instant,
}

static PIHOLE_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
});

static PIHOLE_CONFIG_CACHE: Lazy<Arc<RwLock<Option<PiHoleConfig>>>> = Lazy::new(|| {
    let path = get_config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(config) = serde_json::from_str::<PiHoleConfig>(&data) {
            return Arc::new(RwLock::new(Some(config)));
        }
    }
    Arc::new(RwLock::new(None))
});

static PIHOLE_STATS_CACHE: Lazy<Arc<RwLock<Option<CachedStats>>>> = Lazy::new(|| {
    Arc::new(RwLock::new(None))
});

pub fn invalidate_pihole_stats_cache() {
    if let Ok(mut guard) = PIHOLE_STATS_CACHE.write() {
        *guard = None;
    }
}

pub fn get_config_path() -> PathBuf {
    let mut path = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    path.push("data");
    path.push("pihole.json");
    path
}

fn save_config_to_disk(config: &Option<PiHoleConfig>) {
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

pub fn clean_pihole_url(raw_url: &str) -> Result<String, String> {
    let trimmed = raw_url.trim();
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err("URL must start with http:// or https://".to_string());
    }
    let mut url = trimmed.trim_end_matches('/').to_string();
    if url.ends_with("/admin/api.php") {
        url = url.trim_end_matches("/admin/api.php").to_string();
    } else if url.ends_with("/admin") {
        url = url.trim_end_matches("/admin").to_string();
    }
    Ok(url.trim_end_matches('/').to_string())
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/pihole/config", get(get_config).post(save_config).delete(delete_config))
        .route("/api/pihole/stats", get(get_stats))
        .route("/api/pihole/blocking", post(toggle_blocking))
        .route("/api/pihole/domains", get(list_domains).post(add_domain).delete(remove_domain))
}

pub async fn get_config() -> impl IntoResponse {
    let current = {
        let guard = PIHOLE_CONFIG_CACHE.read().unwrap();
        guard.clone()
    };

    match current {
        None => (
            StatusCode::OK,
            Json(PiHoleConfigResponse {
                configured: false,
                connected: false,
                url: String::new(),
                status: None,
                error: None,
            }),
        ).into_response(),
        Some(cfg) => {
            let mut api_url = format!("{}/admin/api.php?summaryRaw", cfg.url);
            if let Some(ref token) = cfg.token {
                if !token.is_empty() {
                    api_url.push_str(&format!("&auth={}", token));
                }
            }

            match PIHOLE_CLIENT.get(&api_url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    let info: serde_json::Value = resp.json().await.unwrap_or_default();
                    let status = info.get("status").and_then(|v| v.as_str()).map(|s| s.to_string());

                    (
                        StatusCode::OK,
                        Json(PiHoleConfigResponse {
                            configured: true,
                            connected: true,
                            url: cfg.url,
                            status,
                            error: None,
                        }),
                    ).into_response()
                }
                Ok(resp) => {
                    let err = format!("Pi-hole responded with status {}", resp.status());
                    (
                        StatusCode::OK,
                        Json(PiHoleConfigResponse {
                            configured: true,
                            connected: false,
                            url: cfg.url,
                            status: None,
                            error: Some(err),
                        }),
                    ).into_response()
                }
                Err(e) => {
                    let err = format!("Could not reach Pi-hole: {}", e);
                    (
                        StatusCode::OK,
                        Json(PiHoleConfigResponse {
                            configured: true,
                            connected: false,
                            url: cfg.url,
                            status: None,
                            error: Some(err),
                        }),
                    ).into_response()
                }
            }
        }
    }
}

pub async fn save_config(Json(payload): Json<SavePiHoleConfigRequest>) -> impl IntoResponse {
    let clean_url = match clean_pihole_url(&payload.url) {
        Ok(u) => u,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": e })),
            ).into_response();
        }
    };

    let token_clean = payload.token.map(|t| t.trim().to_string()).filter(|t| !t.is_empty());

    let mut test_url = format!("{}/admin/api.php?summaryRaw", clean_url);
    if let Some(ref tok) = token_clean {
        test_url.push_str(&format!("&auth={}", tok));
    }

    let resp = match PIHOLE_CLIENT.get(&test_url).send().await {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": format!("Failed to reach Pi-hole at {}: {}", clean_url, e)
                })),
            ).into_response();
        }
    };

    if !resp.status().is_success() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": format!("Pi-hole returned status {}", resp.status())
            })),
        ).into_response();
    }

    let val: serde_json::Value = resp.json().await.unwrap_or_default();
    let status = val.get("status").and_then(|v| v.as_str()).unwrap_or("enabled").to_string();

    let new_cfg = PiHoleConfig {
        url: clean_url,
        token: token_clean,
        enabled: true,
    };

    {
        let mut guard = PIHOLE_CONFIG_CACHE.write().unwrap();
        *guard = Some(new_cfg.clone());
    }

    save_config_to_disk(&Some(new_cfg));
    invalidate_pihole_stats_cache();

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "status": "ok",
            "message": "Connected to Pi-hole successfully",
            "pihole_status": status
        })),
    ).into_response()
}

pub async fn delete_config() -> impl IntoResponse {
    {
        let mut guard = PIHOLE_CONFIG_CACHE.write().unwrap();
        *guard = None;
    }
    save_config_to_disk(&None);
    invalidate_pihole_stats_cache();

    (
        StatusCode::OK,
        Json(serde_json::json!({ "status": "ok", "message": "Pi-hole disconnected" })),
    ).into_response()
}

pub async fn get_stats() -> impl IntoResponse {
    // Check 3-second cache
    if let Ok(guard) = PIHOLE_STATS_CACHE.read() {
        if let Some(cached) = guard.as_ref() {
            if cached.timestamp.elapsed() < Duration::from_secs(3) {
                return (StatusCode::OK, Json(cached.data.clone())).into_response();
            }
        }
    }

    let cfg = {
        let guard = PIHOLE_CONFIG_CACHE.read().unwrap();
        guard.clone()
    };

    let cfg = match cfg {
        Some(c) if c.enabled => c,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Pi-hole is not configured or enabled" })),
            ).into_response();
        }
    };

    let mut summary_url = format!("{}/admin/api.php?summaryRaw", cfg.url);
    let mut top_url = format!("{}/admin/api.php?topItems=10", cfg.url);
    if let Some(ref tok) = cfg.token {
        if !tok.is_empty() {
            summary_url.push_str(&format!("&auth={}", tok));
            top_url.push_str(&format!("&auth={}", tok));
        }
    }

    let (summary_res, top_res) = tokio::join!(
        PIHOLE_CLIENT.get(&summary_url).send(),
        PIHOLE_CLIENT.get(&top_url).send()
    );

    let mut stats: serde_json::Value = match summary_res {
        Ok(r) if r.status().is_success() => r.json().await.unwrap_or(serde_json::json!({})),
        Ok(r) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": format!("Pi-hole summary returned {}", r.status()) })),
            ).into_response();
        }
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": format!("Could not reach Pi-hole summary: {}", e) })),
            ).into_response();
        }
    };

    if let Ok(r) = top_res {
        if r.status().is_success() {
            if let Ok(top_data) = r.json::<serde_json::Value>().await {
                if let Some(obj) = stats.as_object_mut() {
                    if let Some(tq) = top_data.get("top_queries") {
                        obj.insert("top_queries".to_string(), tq.clone());
                    }
                    if let Some(ta) = top_data.get("top_ads") {
                        obj.insert("top_ads".to_string(), ta.clone());
                    }
                }
            }
        }
    }

    // Cache the response
    if let Ok(mut guard) = PIHOLE_STATS_CACHE.write() {
        *guard = Some(CachedStats {
            data: stats.clone(),
            timestamp: Instant::now(),
        });
    }

    (StatusCode::OK, Json(stats)).into_response()
}

pub async fn toggle_blocking(Json(payload): Json<ToggleBlockingRequest>) -> impl IntoResponse {
    let cfg = {
        let guard = PIHOLE_CONFIG_CACHE.read().unwrap();
        guard.clone()
    };

    let cfg = match cfg {
        Some(c) if c.enabled => c,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Pi-hole is not configured or enabled" })),
            ).into_response();
        }
    };

    let mut action_url = if payload.enable {
        format!("{}/admin/api.php?enable", cfg.url)
    } else if let Some(sec) = payload.duration_seconds {
        format!("{}/admin/api.php?disable={}", cfg.url, sec)
    } else {
        format!("{}/admin/api.php?disable", cfg.url)
    };

    if let Some(ref tok) = cfg.token {
        if !tok.is_empty() {
            action_url.push_str(&format!("&auth={}", tok));
        }
    }

    match PIHOLE_CLIENT.get(&action_url).send().await {
        Ok(resp) if resp.status().is_success() => {
            let res_json: serde_json::Value = resp.json().await.unwrap_or_default();
            let new_status = res_json.get("status").and_then(|v| v.as_str()).unwrap_or(
                if payload.enable { "enabled" } else { "disabled" }
            );

            invalidate_pihole_stats_cache();

            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "status": new_status,
                    "message": format!("Blocking {}", new_status)
                })),
            ).into_response()
        }
        Ok(resp) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": format!("Pi-hole returned status {}", resp.status()) })),
        ).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": format!("Failed to reach Pi-hole: {}", e) })),
        ).into_response(),
    }
}

pub async fn list_domains() -> impl IntoResponse {
    let cfg = {
        let guard = PIHOLE_CONFIG_CACHE.read().unwrap();
        guard.clone()
    };

    let cfg = match cfg {
        Some(c) if c.enabled => c,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Pi-hole is not configured or enabled" })),
            ).into_response();
        }
    };

    let mut white_url = format!("{}/admin/api.php?list=white", cfg.url);
    let mut black_url = format!("{}/admin/api.php?list=black", cfg.url);
    if let Some(ref tok) = cfg.token {
        if !tok.is_empty() {
            white_url.push_str(&format!("&auth={}", tok));
            black_url.push_str(&format!("&auth={}", tok));
        }
    }

    let (white_res, black_res) = tokio::join!(
        PIHOLE_CLIENT.get(&white_url).send(),
        PIHOLE_CLIENT.get(&black_url).send()
    );

    let mut items: Vec<PiHoleDomainItem> = Vec::new();

    if let Ok(resp) = white_res {
        if resp.status().is_success() {
            if let Ok(val) = resp.json::<serde_json::Value>().await {
                extract_domains_from_json(&val, "white", &mut items);
            }
        }
    }

    if let Ok(resp) = black_res {
        if resp.status().is_success() {
            if let Ok(val) = resp.json::<serde_json::Value>().await {
                extract_domains_from_json(&val, "black", &mut items);
            }
        }
    }

    (StatusCode::OK, Json(items)).into_response()
}

fn extract_domains_from_json(val: &serde_json::Value, list_type: &str, items: &mut Vec<PiHoleDomainItem>) {
    if let Some(arr) = val.as_array() {
        for entry in arr {
            if let Some(s) = entry.as_str() {
                items.push(PiHoleDomainItem {
                    domain: s.to_string(),
                    list_type: list_type.to_string(),
                    enabled: true,
                });
            } else if let Some(sub_arr) = entry.as_array() {
                if let Some(first) = sub_arr.first().and_then(|v| v.as_str()) {
                    items.push(PiHoleDomainItem {
                        domain: first.to_string(),
                        list_type: list_type.to_string(),
                        enabled: true,
                    });
                }
            }
        }
    }
}

pub async fn add_domain(Json(payload): Json<DomainActionRequest>) -> impl IntoResponse {
    let cfg = {
        let guard = PIHOLE_CONFIG_CACHE.read().unwrap();
        guard.clone()
    };

    let cfg = match cfg {
        Some(c) if c.enabled => c,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Pi-hole is not configured or enabled" })),
            ).into_response();
        }
    };

    let domain = payload.domain.trim();
    if domain.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Domain cannot be empty" })),
        ).into_response();
    }

    let list = if payload.list_type == "black" { "black" } else { "white" };
    let mut add_url = format!("{}/admin/api.php?list={}&add={}", cfg.url, list, domain);
    if let Some(ref tok) = cfg.token {
        if !tok.is_empty() {
            add_url.push_str(&format!("&auth={}", tok));
        }
    }

    match PIHOLE_CLIENT.get(&add_url).send().await {
        Ok(resp) if resp.status().is_success() => {
            invalidate_pihole_stats_cache();
            (
                StatusCode::OK,
                Json(serde_json::json!({ "status": "ok", "message": format!("Added {} to {}", domain, list) })),
            ).into_response()
        }
        Ok(resp) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": format!("Pi-hole returned status {}", resp.status()) })),
        ).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": format!("Failed to reach Pi-hole: {}", e) })),
        ).into_response(),
    }
}

pub async fn remove_domain(Json(payload): Json<DomainActionRequest>) -> impl IntoResponse {
    let cfg = {
        let guard = PIHOLE_CONFIG_CACHE.read().unwrap();
        guard.clone()
    };

    let cfg = match cfg {
        Some(c) if c.enabled => c,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Pi-hole is not configured or enabled" })),
            ).into_response();
        }
    };

    let domain = payload.domain.trim();
    let list = if payload.list_type == "black" { "black" } else { "white" };
    let mut sub_url = format!("{}/admin/api.php?list={}&sub={}", cfg.url, list, domain);
    if let Some(ref tok) = cfg.token {
        if !tok.is_empty() {
            sub_url.push_str(&format!("&auth={}", tok));
        }
    }

    match PIHOLE_CLIENT.get(&sub_url).send().await {
        Ok(resp) if resp.status().is_success() => {
            invalidate_pihole_stats_cache();
            (
                StatusCode::OK,
                Json(serde_json::json!({ "status": "ok", "message": format!("Removed {} from {}", domain, list) })),
            ).into_response()
        }
        Ok(resp) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": format!("Pi-hole returned status {}", resp.status()) })),
        ).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": format!("Failed to reach Pi-hole: {}", e) })),
        ).into_response(),
    }
}
