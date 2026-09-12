pub mod client;
pub mod detector;
pub mod ingress;
pub mod models;

pub use client::{get_config, save_config, update_config, CloudflareClient};
pub use detector::detect_cloudflared;
pub use ingress::*;
pub use models::*;

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use tracing::warn;

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/cloudflare/config", get(get_config_handler).post(save_config_handler).delete(delete_config_handler))
        .route("/api/cloudflare/detect", get(detect_handler))
        .route("/api/cloudflare/tunnels", get(get_tunnels_handler))
        .route("/api/cloudflare/sync-links", post(sync_links_handler))
        .route("/api/cloudflare/test", post(test_connection_handler))
        .route("/api/cloudflare/routes", post(create_route_handler).delete(delete_route_handler))
}

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

    let configured = !config.account_id.is_empty() && !config.tunnel_id.is_empty() && (!config.api_token.is_empty() || detected.as_ref().map(|d| d.local_config_path.is_some()).unwrap_or(false));

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
            if let Ok((_, raw_rules)) = client.fetch_remote_config(&updated.account_id, &updated.tunnel_id, &updated.api_token).await {
                let containers = client::fetch_docker_containers_for_matching(&docker).await;
                let matched = client::match_ingress_with_containers(raw_rules, &containers);
                client::sync_ingress_rules_to_links(&matched);
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

    // Determine account_id and tunnel_id (from config or auto-detected container)
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
                    let containers = client::fetch_docker_containers_for_matching(&state.docker).await;
                    rules_result = client::match_ingress_with_containers(raw_rules, &containers);
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
                        let containers = client::fetch_docker_containers_for_matching(&state.docker).await;
                        rules_result = client::match_ingress_with_containers(raw_rules, &containers);
                        fetch_error = None; // Cleared error since local succeeded
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
        client::sync_ingress_rules_to_links(&rules_result);
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
    let containers = client::fetch_docker_containers_for_matching(docker).await;
    let matched = client::match_ingress_with_containers(raw_rules, &containers);
    Some(client::sync_ingress_rules_to_links(&matched))
}

pub async fn sync_links_handler(
    State(state): State<AppState>,
) -> impl IntoResponse {
    match auto_sync_cloudflare_links(&state.docker).await {
        Some(sync_res) => (StatusCode::OK, Json(sync_res)).into_response(),
        None => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Could not retrieve Cloudflare tunnel ingress rules to sync" })),
        ).into_response(),
    }
}

pub async fn create_route_handler(
    State(state): State<AppState>,
    Json(payload): Json<CreateRouteRequest>,
) -> impl IntoResponse {
    let hostname = payload.hostname.trim().to_string();
    let service = payload.service.trim().to_string();

    if hostname.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "success": false, "error": "Hostname é obrigatório." })),
        ).into_response();
    }

    if service.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "success": false, "error": "Serviço interno (URL/Porta) é obrigatório." })),
        ).into_response();
    }

    let config = get_config().unwrap_or_default();
    let detected = detector::detect_cloudflared(&state.docker).await;

    let account_id = if !config.account_id.is_empty() {
        config.account_id.clone()
    } else if let Some(ref d) = detected {
        d.account_id.clone().unwrap_or_default()
    } else {
        String::new()
    };

    let tunnel_id = if !config.tunnel_id.is_empty() {
        config.tunnel_id.clone()
    } else if let Some(ref d) = detected {
        d.tunnel_id.clone().unwrap_or_default()
    } else {
        String::new()
    };

    let client = CloudflareClient::new();
    let raw_rule = client::RawIngressRule {
        hostname: Some(hostname.clone()),
        service: service.clone(),
        path: payload.path.filter(|p| !p.trim().is_empty()),
        origin_request: payload.no_tls_verify.map(|nv| client::OriginRequestConfig {
            no_tls_verify: Some(nv),
        }),
    };

    let (rule, dns_created, dns_msg) = if !config.api_token.is_empty() && !account_id.is_empty() && !tunnel_id.is_empty() {
        // Strategy 1: Remote Cloudflare Zero Trust API
        let add_res = client
            .add_route(&account_id, &tunnel_id, &config.api_token, raw_rule)
            .await;

        let r = match add_res {
            Ok(r) => r,
            Err(err) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "success": false, "error": err })),
                ).into_response();
            }
        };

        // Try creating DNS CNAME record if zone permissions exist
        let (created, msg) = client::try_create_dns_cname(
            &reqwest::Client::new(),
            Some(&account_id),
            &tunnel_id,
            &config.api_token,
            &hostname,
        ).await.unwrap_or((false, None));

        (r, created, msg)
    } else if let Some(ref d) = detected {
        if let Some(ref local_path) = d.local_config_path {
            // Strategy 2: Local config.yml file on disk
            match client.add_route_local(local_path, raw_rule) {
                Ok(r) => (r, false, None),
                Err(err) => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(json!({ "success": false, "error": err })),
                    ).into_response();
                }
            }
        } else {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "success": false,
                    "error": "Túnel Cloudflare não configurado com Token de API para gerenciamento remoto. Adicione seu Token nas Configurações da Cloudflare."
                })),
            ).into_response();
        }
    } else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "success": false,
                "error": "Túnel Cloudflare não configurado com Token de API para gerenciamento remoto nem arquivo local detectado."
            })),
        ).into_response();
    };

    // Match with local docker containers for UI feedback and auto-sync
    let containers = client::fetch_docker_containers_for_matching(&state.docker).await;
    let matched = client::match_ingress_with_containers(vec![rule], &containers);
    let matched_rule = matched.into_iter().next().unwrap_or_else(|| IngressRule {
        hostname: hostname.clone(),
        service: service.clone(),
        path: None,
        public_url: format!("https://{}", hostname),
        matched_container_id: None,
        matched_container_name: None,
    });

    if config.enabled && config.auto_sync_links {
        client::sync_ingress_rules_to_links(&[matched_rule.clone()]);
    }

    (
        StatusCode::OK,
        Json(CreateRouteResponse {
            success: true,
            message: format!("Rota '{}' criada com sucesso no túnel Cloudflare.", hostname),
            dns_created,
            dns_message: dns_msg,
            route: matched_rule,
        }),
    ).into_response()
}

pub async fn delete_route_handler(
    State(state): State<AppState>,
    Json(payload): Json<DeleteRouteRequest>,
) -> impl IntoResponse {
    let hostname = payload.hostname.trim().to_string();
    if hostname.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "success": false, "error": "Hostname é obrigatório." })),
        ).into_response();
    }

    let config = get_config().unwrap_or_default();
    let detected = detector::detect_cloudflared(&state.docker).await;

    let account_id = if !config.account_id.is_empty() {
        config.account_id.clone()
    } else if let Some(ref d) = detected {
        d.account_id.clone().unwrap_or_default()
    } else {
        String::new()
    };

    let tunnel_id = if !config.tunnel_id.is_empty() {
        config.tunnel_id.clone()
    } else if let Some(ref d) = detected {
        d.tunnel_id.clone().unwrap_or_default()
    } else {
        String::new()
    };

    let client = CloudflareClient::new();
    if !config.api_token.is_empty() && !account_id.is_empty() && !tunnel_id.is_empty() {
        let res = client
            .delete_route(
                &account_id,
                &tunnel_id,
                &config.api_token,
                &hostname,
                payload.path.as_deref(),
            )
            .await;

        match res {
            Ok(_) => (
                StatusCode::OK,
                Json(DeleteRouteResponse {
                    success: true,
                    message: format!("Rota '{}' removida com sucesso do túnel Cloudflare.", hostname),
                }),
            ).into_response(),
            Err(err) => (
                StatusCode::BAD_REQUEST,
                Json(json!({ "success": false, "error": err })),
            ).into_response(),
        }
    } else if let Some(ref d) = detected {
        if let Some(ref local_path) = d.local_config_path {
            match client.delete_route_local(local_path, &hostname, payload.path.as_deref()) {
                Ok(_) => (
                    StatusCode::OK,
                    Json(DeleteRouteResponse {
                        success: true,
                        message: format!("Rota '{}' removida com sucesso do arquivo local de configuração.", hostname),
                    }),
                ).into_response(),
                Err(err) => (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "success": false, "error": err })),
                ).into_response(),
            }
        } else {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "success": false, "error": "Túnel Cloudflare não configurado com Token de API remoto." })),
            ).into_response()
        }
    } else {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "success": false, "error": "Túnel Cloudflare não configurado com Token de API remoto." })),
        ).into_response()
    }
}
