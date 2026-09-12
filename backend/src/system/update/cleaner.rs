use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;
use crate::state::AppState;

pub async fn cleanup_old_orbit_images(docker: Arc<bollard::Docker>) -> (usize, i64) {
    let mut deleted_count = 0usize;
    let mut space_reclaimed = 0i64;

    // 0. Remove inactive orphan containers
    let list_c_opts = bollard::query_parameters::ListContainersOptions {
        all: true,
        ..Default::default()
    };
    if let Ok(containers) = docker.list_containers(Some(list_c_opts)).await {
        for c in containers {
            let names = c.names.unwrap_or_default();
            let is_orbit = names.iter().any(|n| {
                let clean = n.trim_start_matches('/').to_lowercase();
                clean == "orbit"
                    || clean.contains("orbit-dashboard")
                    || clean.starts_with("orbit")
            });
            let state = c
                .state
                .map(|s| s.to_string())
                .unwrap_or_default()
                .to_lowercase();
            if is_orbit && (state == "created" || state == "exited" || state == "dead") {
                if let Some(id) = c.id {
                    tracing::info!("Removendo container inativo/órfão do Orbit: {}", id);
                    let rm_opts = bollard::query_parameters::RemoveContainerOptions {
                        force: true,
                        ..Default::default()
                    };
                    let _ = docker.remove_container(&id, Some(rm_opts)).await;
                }
            }
        }
    }

    // 1. Clean dangling images
    let mut filters = std::collections::HashMap::new();
    filters.insert("dangling".to_string(), vec!["true".to_string()]);
    let prune_opts = bollard::query_parameters::PruneImagesOptions {
        filters: Some(filters),
    };
    if let Ok(res) = docker.prune_images(Some(prune_opts)).await {
        deleted_count += res.images_deleted.map(|d| d.len()).unwrap_or(0);
        space_reclaimed += res.space_reclaimed.unwrap_or(0);
    }

    // 2. Identify active Orbit image ID
    let mut current_orbit_image_id = None;
    if let Ok(hostname) = std::env::var("HOSTNAME") {
        let clean_host = hostname.trim();
        if !clean_host.is_empty() {
            if let Ok(ins) = docker
                .inspect_container(
                    clean_host,
                    None::<bollard::query_parameters::InspectContainerOptions>,
                )
                .await
            {
                current_orbit_image_id = ins.image;
            }
        }
    }
    if current_orbit_image_id.is_none() {
        for cname in &["orbit-dashboard", "orbit", "Orbit", "orbit_dashboard"] {
            if let Ok(ins) = docker
                .inspect_container(
                    cname,
                    None::<bollard::query_parameters::InspectContainerOptions>,
                )
                .await
            {
                if let Some(img_id) = ins.image {
                    current_orbit_image_id = Some(img_id);
                    break;
                }
            }
        }
    }

    // 3. Search and remove old unused Orbit images
    if let Some(ref current_img) = current_orbit_image_id {
        let mut list_filters = std::collections::HashMap::new();
        list_filters.insert(
            "reference".to_string(),
            vec![
                "ghcr.io/andrevictor20/orbit-dashboard*".to_string(),
                "victorandre280/orbit-dashboard*".to_string(),
            ],
        );
        let list_opts = bollard::query_parameters::ListImagesOptions {
            filters: Some(list_filters),
            all: true,
            ..Default::default()
        };

        if let Ok(images) = docker.list_images(Some(list_opts)).await {
            for img in images {
                let img_id = img.id.clone();
                if &img_id != current_img
                    && !img_id.starts_with(current_img)
                    && !current_img.starts_with(&img_id)
                {
                    tracing::info!("Removendo imagem antiga não utilizada do Orbit: {}", img_id);
                    let rm_opts = bollard::query_parameters::RemoveImageOptions {
                        force: false,
                        noprune: false,
                        ..Default::default()
                    };
                    if let Ok(rm_res) = docker.remove_image(&img_id, Some(rm_opts), None).await {
                        deleted_count += rm_res.len();
                        if img.size > 0 {
                            space_reclaimed += img.size;
                        }
                    }
                }
            }
        }
    }

    if deleted_count > 0 {
        tracing::info!(
            "Limpeza automática pós-atualização: {} imagem(ns) antiga(s) do Orbit removida(s), {} bytes liberados.",
            deleted_count,
            space_reclaimed
        );
    }

    (deleted_count, space_reclaimed)
}

pub async fn cleanup_old_orbit_images_handler(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let (deleted, space) = cleanup_old_orbit_images(state.docker.clone()).await;
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "success": true,
            "deleted_count": deleted,
            "space_reclaimed": space,
            "message": format!("Limpeza pós-atualização concluída. {} imagem(ns) removida(s).", deleted)
        })),
    )
}
