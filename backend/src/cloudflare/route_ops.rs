use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use tracing::warn;

use crate::state::AppState;
use super::client::{self, get_config, CloudflareClient};
use super::detector;
use super::matching;
use super::models::{
    CreateRouteRequest, CreateRouteResponse, DeleteRouteRequest, DeleteRouteResponse, IngressRule,
};

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
        )
            .into_response();
    }

    if service.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "success": false, "error": "Serviço interno (URL/Porta) é obrigatório." })),
        )
            .into_response();
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

    let (rule, dns_created, dns_msg) = if !config.api_token.is_empty()
        && !account_id.is_empty()
        && !tunnel_id.is_empty()
    {
        // Strategy 1: Remote Cloudflare Zero Trust API
        let add_res = client
            .add_route(&account_id, &tunnel_id, &config.api_token, raw_rule.clone())
            .await;

        match add_res {
            Ok(r) => {
                let (created, msg) = client::try_create_dns_cname(
                    &reqwest::Client::new(),
                    Some(&account_id),
                    &tunnel_id,
                    &config.api_token,
                    &hostname,
                )
                .await
                .unwrap_or((false, None));
                (r, created, msg)
            }
            Err(remote_err) => {
                if let Some(ref d) = detected {
                    if let Some(ref local_path) = d.local_config_path {
                        warn!(
                            "Remote Cloudflare API update returned error ('{}'). Falling back to local configuration at '{}'",
                            remote_err, local_path
                        );
                        match client.add_route_local(local_path, raw_rule) {
                            Ok(r) => (
                                r,
                                false,
                                Some(
                                    "Rota adicionada ao arquivo local de configuração do Cloudflare (config.yml)."
                                        .to_string(),
                                ),
                            ),
                            Err(local_err) => {
                                return (
                                    StatusCode::BAD_REQUEST,
                                    Json(json!({
                                        "success": false,
                                        "error": format!(
                                            "Falha remota na API ({}) e local no arquivo ({})",
                                            remote_err, local_err
                                        )
                                    })),
                                )
                                    .into_response();
                            }
                        }
                    } else {
                        return (
                            StatusCode::BAD_REQUEST,
                            Json(json!({ "success": false, "error": remote_err })),
                        )
                            .into_response();
                    }
                } else {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(json!({ "success": false, "error": remote_err })),
                    )
                        .into_response();
                }
            }
        }
    } else if let Some(ref d) = detected {
        if let Some(ref local_path) = d.local_config_path {
            match client.add_route_local(local_path, raw_rule) {
                Ok(r) => (r, false, None),
                Err(err) => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(json!({ "success": false, "error": err })),
                    )
                        .into_response();
                }
            }
        } else {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "success": false,
                    "error": "Túnel Cloudflare não configurado com Token de API para gerenciamento remoto. Adicione seu Token nas Configurações da Cloudflare."
                })),
            )
                .into_response();
        }
    } else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "success": false,
                "error": "Túnel Cloudflare não configurado com Token de API para gerenciamento remoto nem arquivo local detectado."
            })),
        )
            .into_response();
    };

    // Match with local docker containers for UI feedback and auto-sync
    let containers = matching::fetch_docker_containers_for_matching(&state.docker).await;
    let matched = matching::match_ingress_with_containers(vec![rule], &containers);
    let matched_rule = matched.into_iter().next().unwrap_or_else(|| IngressRule {
        hostname: hostname.clone(),
        service: service.clone(),
        path: None,
        public_url: format!("https://{}", hostname),
        matched_container_id: None,
        matched_container_name: None,
    });

    if config.enabled && config.auto_sync_links {
        matching::sync_ingress_rules_to_links(&[matched_rule.clone()]);
    }

    (
        StatusCode::OK,
        Json(CreateRouteResponse {
            success: true,
            message: format!(
                "Rota '{}' criada com sucesso no túnel Cloudflare.",
                hostname
            ),
            dns_created,
            dns_message: dns_msg,
            route: matched_rule,
        }),
    )
        .into_response()
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
        )
            .into_response();
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
                    message: format!(
                        "Rota '{}' removida com sucesso do túnel Cloudflare.",
                        hostname
                    ),
                }),
            )
                .into_response(),
            Err(remote_err) => {
                if let Some(ref d) = detected {
                    if let Some(ref local_path) = d.local_config_path {
                        warn!(
                            "Remote Cloudflare delete failed ('{}'). Trying local config at '{}'",
                            remote_err, local_path
                        );
                        match client.delete_route_local(
                            local_path,
                            &hostname,
                            payload.path.as_deref(),
                        ) {
                            Ok(_) => (
                                StatusCode::OK,
                                Json(DeleteRouteResponse {
                                    success: true,
                                    message: format!(
                                        "Rota '{}' removida do arquivo local de configuração.",
                                        hostname
                                    ),
                                }),
                            )
                                .into_response(),
                            Err(local_err) => (
                                StatusCode::BAD_REQUEST,
                                Json(json!({
                                    "success": false,
                                    "error": format!(
                                        "Falha remota ({}) e local ({})",
                                        remote_err, local_err
                                    )
                                })),
                            )
                                .into_response(),
                        }
                    } else {
                        (
                            StatusCode::BAD_REQUEST,
                            Json(json!({ "success": false, "error": remote_err })),
                        )
                            .into_response()
                    }
                } else {
                    (
                        StatusCode::BAD_REQUEST,
                        Json(json!({ "success": false, "error": remote_err })),
                    )
                        .into_response()
                }
            }
        }
    } else if let Some(ref d) = detected {
        if let Some(ref local_path) = d.local_config_path {
            match client.delete_route_local(local_path, &hostname, payload.path.as_deref()) {
                Ok(_) => (
                    StatusCode::OK,
                    Json(DeleteRouteResponse {
                        success: true,
                        message: format!(
                            "Rota '{}' removida com sucesso do arquivo local de configuração.",
                            hostname
                        ),
                    }),
                )
                    .into_response(),
                Err(err) => (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "success": false, "error": err })),
                )
                    .into_response(),
            }
        } else {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "success": false,
                    "error": "Túnel Cloudflare não configurado com Token de API remoto."
                })),
            )
                .into_response()
        }
    } else {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "success": false,
                "error": "Túnel Cloudflare não configurado com Token de API remoto."
            })),
        )
            .into_response()
    }
}
