use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use crate::state::AppState;
use super::types::NetworkInfo;

pub async fn list_networks(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let networks_res = state.docker.list_networks(None).await;
    let mut options = bollard::query_parameters::ListContainersOptions::default();
    options.all = true;
    let containers = state.docker.list_containers(Some(options)).await.unwrap_or_default();

    match networks_res {
        Ok(networks) => {
            let info: Vec<NetworkInfo> = networks
                .into_iter()
                .map(|net| {
                    let net_name = net.name.as_deref().unwrap_or_default();
                    let net_id = net.id.as_deref().unwrap_or_default();
                    let short_id = net_id.chars().take(12).collect::<String>();

                    let mut count = 0;
                    for c in &containers {
                        if let Some(net_settings) = &c.network_settings {
                            if let Some(c_nets) = &net_settings.networks {
                                if c_nets.contains_key(net_name) || c_nets.values().any(|n| n.network_id.as_deref() == Some(net_id)) {
                                    count += 1;
                                }
                            }
                        }
                    }

                    let in_use = count > 0 || net_name == "bridge" || net_name == "host" || net_name == "none";

                    NetworkInfo {
                        id: short_id,
                        name: net.name.unwrap_or_default(),
                        driver: net.driver.unwrap_or_default(),
                        in_use,
                        containers_count: count,
                    }
                })
                .collect();
            (StatusCode::OK, Json(info)).into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch networks").into_response(),
    }
}

pub async fn prune_networks(
    State(state): State<AppState>,
) -> impl IntoResponse {
    match state.docker.prune_networks(None::<bollard::query_parameters::PruneNetworksOptions>).await {
        Ok(res) => {
            let deleted = res.networks_deleted.unwrap_or_default();
            (StatusCode::OK, Json(serde_json::json!({
                "deleted": deleted,
                "message": "Networks pruned successfully"
            }))).into_response()
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))).into_response(),
    }
}

pub async fn delete_network(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match state.docker.remove_network(&id).await {
        Ok(_) => (StatusCode::OK, "Network removed successfully").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}
