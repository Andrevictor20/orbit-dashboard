use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;

use crate::state::AppState;
use super::client::{get_config, CloudflareClient};
use super::detector;
use super::matching;
use super::models::SyncLinksResponse;

pub async fn auto_sync_cloudflare_links(docker: &bollard::Docker) -> Option<SyncLinksResponse> {
    let config = get_config().unwrap_or_default();
    let detected = detector::detect_cloudflared(docker).await;

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
    let mut raw_rules_opt = None;

    if let (Some(acc), Some(tun)) = (&account_id, &tunnel_id) {
        if !config.api_token.is_empty() {
            if let Ok((_, raw)) = client.fetch_remote_config(acc, tun, &config.api_token).await {
                raw_rules_opt = Some(raw);
            }
        }
    }

    if raw_rules_opt.is_none() {
        if let Some(ref d) = detected {
            if let Some(ref path) = d.local_config_path {
                if let Ok((_, raw)) = client.parse_local_yaml(path) {
                    raw_rules_opt = Some(raw);
                }
            }
        }
    }

    let raw_rules = raw_rules_opt?;
    let containers = matching::fetch_docker_containers_for_matching(docker).await;
    let matched = matching::match_ingress_with_containers(raw_rules, &containers);
    Some(matching::sync_ingress_rules_to_links(&matched))
}

pub async fn sync_links_handler(
    State(state): State<AppState>,
) -> impl IntoResponse {
    match auto_sync_cloudflare_links(&state.docker).await {
        Some(sync_res) => (StatusCode::OK, Json(sync_res)).into_response(),
        None => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Could not retrieve Cloudflare tunnel ingress rules to sync" })),
        )
            .into_response(),
    }
}
