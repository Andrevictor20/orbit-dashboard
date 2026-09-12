use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use tracing::warn;

use crate::state::AppState;
use super::client::{self, get_config, save_config, update_config, CloudflareClient};
use super::detector;
use super::matching;
use super::models::{CloudflareStatusResponse, SaveCloudflareConfigRequest};

pub use super::route_ops::*;
pub use super::sync::*;

#[derive(serde::Deserialize)]
pub struct TestCloudflareRequest {
    pub account_id: String,
    pub tunnel_id: String,
    pub api_token: String,
}

pub async fn test_connection_handler(
    Json(payload): Json<TestCloudflareRequest>,
) -> impl IntoResponse {
    let client = CloudflareClient::new();
    let res = client
        .fetch_remote_config(&payload.account_id, &payload.tunnel_id, &payload.api_token)
        .await;

    match res {
        Ok((name, rules)) => (
            StatusCode::OK,
            Json(json!({
                "success": true,
                "tunnel_name": name,
                "routes_count": rules.len(),
                "message": "Conexão com a Cloudflare estabelecida com sucesso!"
            })),
        ),
        Err(err) => (
            StatusCode::OK,
            Json(json!({
                "success": false,
                "error": err
            })),
        ),
    }
}

pub async fn get_config_handler(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let config = get_config().unwrap_or_default();
    let detected = detector::detect_cloudflared(&state.docker).await;

    let configured = !config.account_id.is_empty()
        && !config.tunnel_id.is_empty()
        && (!config.api_token.is_empty()
            || detected.as_ref().map(|d| d.local_config_path.is_some()).unwrap_or(false));

    let masked_token = if config.api_token.is_empty() {
        "".to_string()
    } else {
        client::mask_token(&config.api_token)
    };

    (
        StatusCode::OK,
        Json(json!({
            "configured": configured,
            "account_id": config.account_id,
            "tunnel_id": config.tunnel_id,
            "api_token": masked_token,
            "has_api_token": !config.api_token.is_empty(),
            "auto_sync_links": config.auto_sync_links,
            "enabled": config.enabled,
            "detected": detected,
        })),
    )
}

pub async fn save_config_handler(
    State(state): State<AppState>,
    Json(payload): Json<SaveCloudflareConfigRequest>,
) -> impl IntoResponse {
    let updated = update_config(payload);

    // If auto-sync is enabled, trigger link sync
    if updated.enabled && updated.auto_sync_links {
        let docker = state.docker.clone();
        tokio::spawn(async move {
            let client = CloudflareClient::new();
            if let Ok((_, raw_rules)) = client
                .fetch_remote_config(&updated.account_id, &updated.tunnel_id, &updated.api_token)
                .await
            {
                let containers = matching::fetch_docker_containers_for_matching(&docker).await;
                let matched = matching::match_ingress_with_containers(raw_rules, &containers);
                matching::sync_ingress_rules_to_links(&matched);
            }
        });
    }

    (
        StatusCode::OK,
        Json(json!({
            "message": "Cloudflare configuration updated successfully",
            "configured": true
        })),
    )
}

pub async fn delete_config_handler() -> impl IntoResponse {
    save_config(None);
    (
        StatusCode::OK,
        Json(json!({ "message": "Cloudflare configuration deleted successfully" })),
    )
}

pub async fn detect_handler(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let detected = detector::detect_cloudflared(&state.docker).await;
    (
        StatusCode::OK,
        Json(json!({
            "detected": detected.is_some(),
            "data": detected,
        })),
    )
}

pub async fn get_tunnels_handler(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let config = get_config().unwrap_or_default();
    let detected = detector::detect_cloudflared(&state.docker).await;

    let account_id = if !config.account_id.is_empty() {
        Some(config.account_id.clone())
    } else {
        detected.as_ref().and_then(|d| d.account_id.clone())
    };

    let tunnel_id = if !config.tunnel_id.is_empty() {
        Some(config.tunnel_id.clone())
    } else {
        detected.as_ref().and_then(|d| d.tunnel_id.clone())
    };

    let client = CloudflareClient::new();
    let mut mode = "none".to_string();
    let mut rules_result = Vec::new();
    let mut tunnel_name = None;
    let mut fetch_error = None;

    // Strategy 1: Remote Cloudflare API if token is present
    if let (Some(acc), Some(tun)) = (&account_id, &tunnel_id) {
        if !config.api_token.is_empty() {
            match client.fetch_remote_config(acc, tun, &config.api_token).await {
                Ok((name, raw_rules)) => {
                    mode = "remote".to_string();
                    tunnel_name = name;
                    let containers = matching::fetch_docker_containers_for_matching(&state.docker).await;
                    rules_result = matching::match_ingress_with_containers(raw_rules, &containers);
                }
                Err(err) => {
                    warn!("Failed to fetch remote Cloudflare config: {}", err);
                    fetch_error = Some(err);
                }
            }
        }
    }

    // Strategy 2: Fallback to local config.yml if remote wasn't successful or token wasn't provided
    if rules_result.is_empty() {
        if let Some(ref d) = detected {
            if let Some(ref local_path) = d.local_config_path {
                match client.parse_local_yaml(local_path) {
                    Ok((tun_from_file, raw_rules)) => {
                        mode = "local".to_string();
                        if tunnel_name.is_none() {
                            tunnel_name = tun_from_file;
                        }
                        let containers = matching::fetch_docker_containers_for_matching(&state.docker).await;
                        rules_result = matching::match_ingress_with_containers(raw_rules, &containers);
                        fetch_error = None;
                    }
                    Err(err) => {
                        if fetch_error.is_none() {
                            fetch_error = Some(err);
                        }
                    }
                }
            }
        }
    }

    // If auto_sync_links is enabled and we have matched rules, auto-sync
    if config.enabled && config.auto_sync_links && !rules_result.is_empty() {
        matching::sync_ingress_rules_to_links(&rules_result);
    }

    let connected = mode == "remote" || mode == "local" || !rules_result.is_empty();

    let status = CloudflareStatusResponse {
        configured: account_id.is_some() && tunnel_id.is_some(),
        connected,
        mode,
        tunnel_name,
        tunnel_id,
        account_id,
        routes_count: rules_result.len(),
        error: fetch_error,
        detected_container: detected,
    };

    (
        StatusCode::OK,
        Json(json!({
            "status": status,
            "rules": rules_result,
        })),
    )
}

