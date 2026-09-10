pub mod client;
pub mod models;
pub mod v5;
pub mod v6;

use axum::{
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use once_cell::sync::Lazy;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

use crate::state::AppState;
use self::client::{invalidate_sid, PiHoleOrchestrator};
use self::models::*;

pub use self::models::{
    PiHoleConfig, PiHoleConfigResponse, SavePiHoleConfigRequest,
    ToggleBlockingRequest, DomainActionRequest, PiHoleDomainItem,
};

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
    } else if url.ends_with("/api") {
        url = url.trim_end_matches("/api").to_string();
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
                version: None,
                error: None,
            }),
        ).into_response(),
        Some(cfg) => {
            match PiHoleOrchestrator::test_connection(&cfg.url, cfg.token.as_deref()).await {
                Ok((ver, status)) => (
                    StatusCode::OK,
                    Json(PiHoleConfigResponse {
                        configured: true,
                        connected: true,
                        url: cfg.url,
                        status: Some(status),
                        version: Some(ver),
                        error: None,
                    }),
                ).into_response(),
                Err(err) => (
                    StatusCode::OK,
                    Json(PiHoleConfigResponse {
                        configured: true,
                        connected: false,
                        url: cfg.url,
                        status: None,
                        version: cfg.version,
                        error: Some(err),
                    }),
                ).into_response(),
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

    let (detected_version, status) = match PiHoleOrchestrator::test_connection(&clean_url, token_clean.as_deref()).await {
        Ok(res) => res,
        Err(err) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": format!("Falha ao conectar com o Pi-hole em {}: {}", clean_url, err)
                })),
            ).into_response();
        }
    };

    let new_cfg = PiHoleConfig {
        url: clean_url,
        token: token_clean,
        enabled: true,
        version: Some(detected_version.clone()),
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
            "pihole_status": status,
            "version": detected_version
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
    invalidate_sid();

    (
        StatusCode::OK,
        Json(serde_json::json!({ "status": "ok", "message": "Pi-hole disconnected" })),
    ).into_response()
}

pub async fn get_stats() -> impl IntoResponse {
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

    match PiHoleOrchestrator::fetch_stats(&cfg).await {
        Ok(stats) => {
            if let Ok(mut guard) = PIHOLE_STATS_CACHE.write() {
                *guard = Some(CachedStats {
                    data: stats.clone(),
                    timestamp: Instant::now(),
                });
            }
            (StatusCode::OK, Json(stats)).into_response()
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": e })),
        ).into_response(),
    }
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

    match PiHoleOrchestrator::toggle_blocking(&cfg, payload.enable, payload.duration_seconds).await {
        Ok(new_status) => {
            invalidate_pihole_stats_cache();
            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "status": new_status,
                    "message": format!("Blocking {}", new_status)
                })),
            ).into_response()
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": e })),
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

    match PiHoleOrchestrator::list_domains(&cfg).await {
        Ok(items) => (StatusCode::OK, Json(items)).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": e })),
        ).into_response(),
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

    match PiHoleOrchestrator::add_domain(&cfg, domain, &payload.list_type).await {
        Ok(()) => {
            invalidate_pihole_stats_cache();
            (
                StatusCode::OK,
                Json(serde_json::json!({ "status": "ok", "message": format!("Added {} to {}", domain, payload.list_type) })),
            ).into_response()
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": e })),
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
    if domain.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Domain cannot be empty" })),
        ).into_response();
    }

    match PiHoleOrchestrator::remove_domain(&cfg, domain, &payload.list_type).await {
        Ok(()) => {
            invalidate_pihole_stats_cache();
            (
                StatusCode::OK,
                Json(serde_json::json!({ "status": "ok", "message": format!("Removed {} from {}", domain, payload.list_type) })),
            ).into_response()
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": e })),
        ).into_response(),
    }
}
