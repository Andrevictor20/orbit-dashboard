use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use crate::state::AppState;
use super::types::ImageInfo;

pub async fn list_images(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let images_res = state.docker.list_images(Some(bollard::query_parameters::ListImagesOptions::default())).await;
    let mut options = bollard::query_parameters::ListContainersOptions::default();
    options.all = true;
    let containers = state.docker.list_containers(Some(options)).await.unwrap_or_default();

    match images_res {
        Ok(images) => {
            let info: Vec<ImageInfo> = images
                .into_iter()
                .map(|img| {
                    let short_id = img.id.replace("sha256:", "").chars().take(12).collect::<String>();
                    let full_id = img.id.clone();
                    let tags = img.repo_tags.clone();

                    let mut count = 0;
                    for c in &containers {
                        let c_image = c.image.as_deref().unwrap_or_default();
                        let c_image_id = c.image_id.as_deref().unwrap_or_default();

                        let matches_id = c_image_id == full_id 
                            || c_image_id.replace("sha256:", "").starts_with(&short_id)
                            || c_image.starts_with(&short_id);
                        
                        let matches_tag = tags.iter().any(|t| t == c_image || (t.ends_with(":latest") && t.trim_end_matches(":latest") == c_image));
                        
                        if matches_id || matches_tag {
                            count += 1;
                        }
                    }

                    ImageInfo {
                        id: short_id,
                        tags: img.repo_tags,
                        size: img.size,
                        in_use: count > 0,
                        containers_count: count,
                    }
                })
                .collect();
            (StatusCode::OK, Json(info)).into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch images").into_response(),
    }
}

pub async fn prune_images(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let mut filters = std::collections::HashMap::new();
    filters.insert("dangling".to_string(), vec!["false".to_string()]);
    let options = bollard::query_parameters::PruneImagesOptions { filters: Some(filters) };
    match state.docker.prune_images(Some(options)).await {
        Ok(res) => {
            let deleted: Vec<String> = res.images_deleted
                .unwrap_or_default()
                .into_iter()
                .filter_map(|item| item.deleted.or(item.untagged))
                .collect();
            let space_reclaimed = res.space_reclaimed.unwrap_or(0);
            (StatusCode::OK, Json(serde_json::json!({
                "deleted": deleted,
                "space_reclaimed": space_reclaimed,
                "message": "Images pruned successfully"
            }))).into_response()
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))).into_response(),
    }
}

pub async fn delete_image(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match state.docker.remove_image(&id, None::<bollard::query_parameters::RemoveImageOptions>, None).await {
        Ok(_) => (StatusCode::OK, "Image removed successfully").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

pub async fn prune_builder(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let mut total_reclaimed = 0i64;

    // 1. Run builder prune via host / container CLI
    let chroot_output = tokio::process::Command::new("chroot")
        .arg("/host")
        .arg("docker")
        .arg("builder")
        .arg("prune")
        .arg("-af")
        .output()
        .await;

    if let Ok(o) = chroot_output {
        if o.status.success() {
            let msg = String::from_utf8_lossy(&o.stdout);
            tracing::info!("Host docker builder prune: {}", msg);
        }
    }

    let local_output = tokio::process::Command::new("docker")
        .arg("builder")
        .arg("prune")
        .arg("-af")
        .output()
        .await;

    if let Ok(o) = local_output {
        if o.status.success() {
            let msg = String::from_utf8_lossy(&o.stdout);
            tracing::info!("Local docker builder prune: {}", msg);
        }
    }

    // 2. Also run bollard images prune
    let mut filters = std::collections::HashMap::new();
    filters.insert("dangling".to_string(), vec!["false".to_string()]);
    let options = bollard::query_parameters::PruneImagesOptions { filters: Some(filters) };
    if let Ok(res) = state.docker.prune_images(Some(options)).await {
        total_reclaimed += res.space_reclaimed.unwrap_or(0);
    }

    (StatusCode::OK, Json(serde_json::json!({
        "success": true,
        "space_reclaimed": total_reclaimed,
        "message": "Cache de build e imagens não utilizadas liberados com sucesso!"
    }))).into_response()
}
