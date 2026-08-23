use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use crate::state::AppState;
use super::types::VolumeInfo;

pub async fn list_volumes(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let volumes_res = state.docker.list_volumes(None::<bollard::query_parameters::ListVolumesOptions>).await;
    let mut options = bollard::query_parameters::ListContainersOptions::default();
    options.all = true;
    let containers = state.docker.list_containers(Some(options)).await.unwrap_or_default();

    match volumes_res {
        Ok(volumes_response) => {
            let info: Vec<VolumeInfo> = volumes_response.volumes
                .unwrap_or_default()
                .into_iter()
                .map(|v| {
                    let mut count = 0;
                    for c in &containers {
                        if let Some(mounts) = &c.mounts {
                            if mounts.iter().any(|m| m.name.as_deref() == Some(&v.name) || m.source.as_deref() == Some(&v.mountpoint)) {
                                count += 1;
                            }
                        }
                    }

                    VolumeInfo {
                        name: v.name,
                        driver: v.driver,
                        mountpoint: v.mountpoint,
                        in_use: count > 0,
                        containers_count: count,
                        size: None,
                    }
                })
                .collect();
            (StatusCode::OK, Json(info)).into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch volumes").into_response(),
    }
}

pub async fn prune_volumes(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let mut filters = std::collections::HashMap::new();
    filters.insert("all".to_string(), vec!["true".to_string()]);
    let options = bollard::query_parameters::PruneVolumesOptions { filters: Some(filters) };
    match state.docker.prune_volumes(Some(options)).await {
        Ok(res) => {
            let deleted = res.volumes_deleted.unwrap_or_default();
            let space_reclaimed = res.space_reclaimed.unwrap_or(0);
            (StatusCode::OK, Json(serde_json::json!({
                "deleted": deleted,
                "space_reclaimed": space_reclaimed,
                "message": "Volumes pruned successfully"
            }))).into_response()
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))).into_response(),
    }
}

pub async fn delete_volume(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    match state.docker.remove_volume(&name, None::<bollard::query_parameters::RemoveVolumeOptions>).await {
        Ok(_) => (StatusCode::OK, "Volume removed successfully").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}
