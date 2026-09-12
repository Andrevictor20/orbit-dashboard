pub mod compose_resolver;
pub mod mutations;
pub mod size_cache;

pub use compose_resolver::*;
pub use mutations::*;
pub use size_cache::*;
pub use super::port_prioritization::*;
pub use super::update_runner::*;
pub use super::updates::*;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use futures::StreamExt;
use std::time::Instant;

use super::types::{
    ContainerInfo, DeleteContainerQuery,
};
use crate::state::AppState;

pub async fn list_containers(State(state): State<AppState>) -> impl IntoResponse {
    let is_first_scan = {
        size_cache::LAST_SIZE_SCAN
            .read()
            .map(|l| l.is_none())
            .unwrap_or(true)
    };
    let mut options = bollard::query_parameters::ListContainersOptions::default();
    options.all = true;
    options.size = is_first_scan;

    if !is_first_scan {
        trigger_container_size_scan_if_needed(state.docker.clone());
    }

    match state.docker.list_containers(Some(options)).await {
        Ok(containers) => {
            if is_first_scan {
                if let Ok(mut cache) = size_cache::CONTAINER_SIZE_CACHE.write() {
                    for c in &containers {
                        if let Some(id) = &c.id {
                            let size = CachedContainerSize {
                                size_rw: c.size_rw,
                                size_root_fs: c.size_root_fs,
                            };
                            cache.insert(id.clone(), size);
                            if id.len() >= 12 {
                                cache.insert(id[..12].to_string(), size);
                            }
                        }
                    }
                }
                if let Ok(mut last) = size_cache::LAST_SIZE_SCAN.write() {
                    *last = Some(Instant::now());
                }
            }

            let cached_sizes = get_cached_container_sizes();

            let info: Vec<ContainerInfo> = containers
                .into_iter()
                .map(|c| {
                    let full_id = c.id.clone().unwrap_or_default();
                    let short_id: String = full_id.chars().take(12).collect();

                    let name = c
                        .names
                        .as_ref()
                        .and_then(|names| names.first())
                        .map(|n| n.trim_start_matches('/').to_string())
                        .filter(|n| !n.is_empty())
                        .unwrap_or_else(|| {
                            c.labels
                                .as_ref()
                                .and_then(|l| {
                                    l.get("com.docker.compose.service")
                                        .or_else(|| l.get("io.casaos.app.name"))
                                })
                                .cloned()
                                .unwrap_or_else(|| short_id.clone())
                        });

                    let labels = c.labels.unwrap_or_default();
                    let image_str = c.image.unwrap_or_default();
                    let network_mode = c.host_config.as_ref().and_then(|h| h.network_mode.as_deref());
                    let ports = process_and_prioritize_ports(
                        c.ports,
                        &labels,
                        &image_str,
                        &name,
                        network_mode,
                    );

                    let (size_rw, size_root_fs) = if c.size_rw.is_some() || c.size_root_fs.is_some()
                    {
                        (c.size_rw, c.size_root_fs)
                    } else {
                        cached_sizes
                            .get(&full_id)
                            .or_else(|| cached_sizes.get(&short_id))
                            .map(|s| (s.size_rw, s.size_root_fs))
                            .unwrap_or((None, None))
                    };

                    ContainerInfo {
                        id: short_id,
                        name,
                        image: image_str,
                        state: c.state.map(|s| s.to_string()).unwrap_or_default(),
                        status: c.status.unwrap_or_default(),
                        ports,
                        labels,
                        size_rw,
                        size_root_fs,
                    }
                })
                .collect();
            (StatusCode::OK, Json(info)).into_response()
        }
        Err(_) => {
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch containers").into_response()
        }
    }
}

pub async fn inspect_container(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match state
        .docker
        .inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>)
        .await
    {
        Ok(info) => (StatusCode::OK, Json(info)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

pub async fn container_logs(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let options = Some(bollard::query_parameters::LogsOptions {
        stdout: true,
        stderr: true,
        tail: "500".to_string(),
        follow: false,
        ..Default::default()
    });

    let mut stream = state.docker.logs(&id, options);
    let mut logs = String::new();

    while let Some(log_result) = stream.next().await {
        match log_result {
            Ok(log) => {
                logs.push_str(&format!("{}\n", log));
            }
            Err(_) => break,
        }
    }

    (StatusCode::OK, logs).into_response()
}

pub async fn delete_container(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<DeleteContainerQuery>,
) -> impl IntoResponse {
    let docker = state.docker.clone();
    let container_id = id.clone();
    let remove_volumes = query.v.unwrap_or(false);
    let remove_image = query.image.unwrap_or(false);
    let remove_network = query.network.unwrap_or(false);

    // Spawn desacoplado: a task roda no scheduler de background do Tokio e NÃO é
    // cancelada se o cliente fechar a aba, atualizar a página (F5) ou sofrer queda de rede.
    let deletion_task = tokio::spawn(async move {
        let mut image_id = None;
        let mut network_names = Vec::new();

        // 1. Inspect container to check running state and collect image/network if requested
        if let Ok(inspect) = docker
            .inspect_container(
                &container_id,
                None::<bollard::query_parameters::InspectContainerOptions>,
            )
            .await
        {
            // Stop container if running or paused before removal
            if let Some(st) = inspect.state {
                if st.running.unwrap_or(false) || st.paused.unwrap_or(false) {
                    let stop_opts = Some(bollard::query_parameters::StopContainerOptions {
                        t: Some(5),
                        signal: None,
                    });
                    let _ = docker.stop_container(&container_id, stop_opts).await;
                }
            }

            if remove_image {
                image_id = inspect.image;
            }
            if remove_network {
                if let Some(network_settings) = inspect.network_settings {
                    if let Some(networks) = network_settings.networks {
                        network_names = networks.keys().cloned().collect();
                    }
                }
            }
        }

        // 2. Remove the container
        let options = Some(bollard::query_parameters::RemoveContainerOptions {
            force: true,
            v: remove_volumes,
            link: false,
        });

        let remove_res = docker.remove_container(&container_id, options).await;

        if let Some(img_id) = image_id {
            let _ = docker
                .remove_image(
                    &img_id,
                    None::<bollard::query_parameters::RemoveImageOptions>,
                    None,
                )
                .await;
        }

        for net_name in network_names {
            if net_name != "bridge" && net_name != "host" && net_name != "none" {
                let _ = docker.remove_network(&net_name).await;
            }
        }

        remove_res
    });

    // Se o cliente continuar conectado, aguarda a resposta e retorna o resultado
    match deletion_task.await {
        Ok(Ok(_)) => (
            StatusCode::OK,
            "Container stopped and removed successfully",
        )
            .into_response(),
        Ok(Err(e)) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Deletion task error: {}", e),
        )
            .into_response(),
    }
}


pub async fn container_action(
    State(state): State<AppState>,
    Path((id, action)): Path<(String, String)>,
) -> impl IntoResponse {
    let docker = &state.docker;

    let res = match action.as_str() {
        "start" => {
            docker
                .start_container(
                    &id,
                    None::<bollard::query_parameters::StartContainerOptions>,
                )
                .await
        }
        "stop" => docker.stop_container(&id, None).await,
        "restart" => docker.restart_container(&id, None).await,
        "pause" => docker.pause_container(&id).await,
        "unpause" => docker.unpause_container(&id).await,
        _ => return (StatusCode::BAD_REQUEST, "Invalid action").into_response(),
    };

    match res {
        Ok(_) => (StatusCode::OK, "Action successful").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}
