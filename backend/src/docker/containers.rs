use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use futures::StreamExt;
use crate::state::AppState;
use super::types::{ContainerInfo, DeleteContainerQuery, UpdateEnvPayload, UpdateVolumesPayload};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use once_cell::sync::Lazy;

pub fn valid_env_entry(entry: &str) -> bool {
    let Some((key, _)) = entry.split_once('=') else {
        return false;
    };

    !key.is_empty()
        && !key.as_bytes()[0].is_ascii_digit()
        && key.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
}

/// Helper to resolve the real location of a docker-compose manifest on disk.
/// Handles paths inside container (/app/data/apps/...), host paths (/host/...),
/// and relative working directories. Returns (compose_file_path, project_directory).
pub fn resolve_compose_file(
    working_dir: Option<&str>,
    config_files_label: &str,
) -> Option<(std::path::PathBuf, std::path::PathBuf)> {
    let clean_label = config_files_label.split(',').next().unwrap_or("docker-compose.yml").trim();
    if clean_label.is_empty() {
        return None;
    }

    let mut candidate_paths = Vec::new();

    // 1. Direct label path
    candidate_paths.push(std::path::PathBuf::from(clean_label));

    // 2. Host-prefixed label path if label starts with '/'
    if clean_label.starts_with('/') {
        candidate_paths.push(std::path::PathBuf::from(format!("/host{}", clean_label)));
    }

    // 3. Relative to working_dir if provided
    if let Some(wd) = working_dir {
        let wd_path = std::path::Path::new(wd);
        candidate_paths.push(wd_path.join(clean_label));
        
        let file_name = std::path::Path::new(clean_label).file_name().unwrap_or_default();
        candidate_paths.push(wd_path.join(file_name));

        // Also check with /host prefix on working_dir
        let host_wd = format!("/host{}", wd);
        let host_wd_path = std::path::Path::new(&host_wd);
        candidate_paths.push(host_wd_path.join(clean_label));
        candidate_paths.push(host_wd_path.join(file_name));
    }

    // Find the first candidate that actually exists as a file
    for candidate in candidate_paths {
        if candidate.is_file() {
            let project_dir = if let Some(wd) = working_dir {
                if std::path::Path::new(wd).is_dir() {
                    std::path::PathBuf::from(wd)
                } else if std::path::Path::new(&format!("/host{}", wd)).is_dir() {
                    std::path::PathBuf::from(format!("/host{}", wd))
                } else {
                    candidate.parent().unwrap_or_else(|| std::path::Path::new(".")).to_path_buf()
                }
            } else {
                candidate.parent().unwrap_or_else(|| std::path::Path::new(".")).to_path_buf()
            };

            return Some((candidate, project_dir));
        }
    }

    None
}

pub use super::port_prioritization::*;

#[derive(Clone, Copy, Debug)]
pub struct CachedContainerSize {
    pub size_rw: Option<i64>,
    pub size_root_fs: Option<i64>,
}

static CONTAINER_SIZE_CACHE: Lazy<RwLock<HashMap<String, CachedContainerSize>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));
static LAST_SIZE_SCAN: Lazy<RwLock<Option<Instant>>> =
    Lazy::new(|| RwLock::new(None));

pub fn get_cached_container_sizes() -> HashMap<String, CachedContainerSize> {
    CONTAINER_SIZE_CACHE.read().map(|c| c.clone()).unwrap_or_default()
}

pub fn trigger_container_size_scan_if_needed(docker: Arc<bollard::Docker>) {
    let should_scan = {
        let last = LAST_SIZE_SCAN.read().unwrap();
        match *last {
            Some(instant) => instant.elapsed() > Duration::from_secs(60),
            None => true,
        }
    };

    if should_scan {
        if let Ok(mut last) = LAST_SIZE_SCAN.write() {
            *last = Some(Instant::now());
        }

        tokio::spawn(async move {
            let mut options = bollard::query_parameters::ListContainersOptions::default();
            options.all = true;
            options.size = true;
            if let Ok(containers) = docker.list_containers(Some(options)).await {
                if let Ok(mut cache) = CONTAINER_SIZE_CACHE.write() {
                    for c in containers {
                        if let Some(id) = c.id {
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
            }
        });
    }
}

pub async fn list_containers(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let is_first_scan = { LAST_SIZE_SCAN.read().map(|l| l.is_none()).unwrap_or(true) };
    let mut options = bollard::query_parameters::ListContainersOptions::default();
    options.all = true;
    options.size = is_first_scan;

    if !is_first_scan {
        trigger_container_size_scan_if_needed(state.docker.clone());
    }

    match state.docker.list_containers(Some(options)).await {
        Ok(containers) => {
            if is_first_scan {
                if let Ok(mut cache) = CONTAINER_SIZE_CACHE.write() {
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
                if let Ok(mut last) = LAST_SIZE_SCAN.write() {
                    *last = Some(Instant::now());
                }
            }

            let cached_sizes = get_cached_container_sizes();

            let info: Vec<ContainerInfo> = containers
                .into_iter()
                .map(|c| {
                    let full_id = c.id.clone().unwrap_or_default();
                    let short_id: String = full_id.chars().take(12).collect();

                    let name = c.names
                        .as_ref()
                        .and_then(|names| names.first())
                        .map(|n| n.trim_start_matches('/').to_string())
                        .filter(|n| !n.is_empty())
                        .unwrap_or_else(|| {
                            c.labels
                                .as_ref()
                                .and_then(|l| l.get("com.docker.compose.service").or_else(|| l.get("io.casaos.app.name")))
                                .cloned()
                                .unwrap_or_else(|| short_id.clone())
                        });

                    let labels = c.labels.unwrap_or_default();
                    let image_str = c.image.unwrap_or_default();
                    let network_mode = c.host_config.as_ref().and_then(|h| h.network_mode.as_deref());
                    let ports = process_and_prioritize_ports(c.ports, &labels, &image_str, &name, network_mode);

                    let (size_rw, size_root_fs) = if c.size_rw.is_some() || c.size_root_fs.is_some() {
                        (c.size_rw, c.size_root_fs)
                    } else {
                        cached_sizes.get(&full_id)
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
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch containers").into_response(),
    }
}

pub async fn inspect_container(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match state.docker.inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>).await {
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
    let docker = &state.docker;
    let mut image_id = None;
    let mut network_names = Vec::new();

    // 1. Inspect container to check running state and collect image/network if requested
    if let Ok(inspect) = docker.inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>).await {
        // Stop container if running or paused before removal
        if let Some(st) = inspect.state {
            if st.running.unwrap_or(false) || st.paused.unwrap_or(false) {
                let stop_opts = Some(bollard::query_parameters::StopContainerOptions { t: Some(5), signal: None });
                let _ = docker.stop_container(&id, stop_opts).await;
            }
        }

        if query.image.unwrap_or(false) {
            image_id = inspect.image;
        }
        if query.network.unwrap_or(false) {
            if let Some(network_settings) = inspect.network_settings {
                if let Some(networks) = network_settings.networks {
                    network_names = networks.keys().cloned().collect();
                }
            }
        }
    }

    // 2. Remove the stopped container
    let remove_volumes = query.v.unwrap_or(false);
    let options = Some(bollard::query_parameters::RemoveContainerOptions {
        force: true,
        v: remove_volumes,
        link: false,
    });
    
    if let Err(e) = docker.remove_container(&id, options).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }

    if let Some(img_id) = image_id {
        let _ = docker.remove_image(&img_id, None::<bollard::query_parameters::RemoveImageOptions>, None).await;
    }

    for net_name in network_names {
        if net_name != "bridge" && net_name != "host" && net_name != "none" {
            let _ = docker.remove_network(&net_name).await;
        }
    }

    (StatusCode::OK, "Container stopped and removed successfully").into_response()
}

pub async fn update_container_env(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateEnvPayload>,
) -> impl IntoResponse {
    let docker = &state.docker;

    if payload.env.iter().any(|entry| !valid_env_entry(entry)) {
        return (StatusCode::BAD_REQUEST, "Environment variables must use KEY=VALUE with a valid key").into_response();
    }
    let unique_keys: std::collections::HashSet<&str> = payload.env.iter()
        .filter_map(|entry| entry.split_once('=').map(|(key, _)| key))
        .collect();
    if unique_keys.len() != payload.env.len() {
        return (StatusCode::BAD_REQUEST, "Environment variable keys must be unique").into_response();
    }
    
    // 1. Inspect current container
    let inspect = match docker.inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>).await {
        Ok(i) => i,
        Err(e) => return (StatusCode::NOT_FOUND, format!("Container not found: {}", e)).into_response(),
    };
    
    let config = match inspect.config {
        Some(c) => c,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read container config").into_response(),
    };

    let name = inspect.name.unwrap_or_else(|| id.clone());
    let clean_name = name.trim_start_matches('/');

    let new_config = bollard::models::ContainerCreateBody {
        hostname: config.hostname,
        domainname: config.domainname,
        image: config.image,
        cmd: config.cmd,
        entrypoint: config.entrypoint,
        user: config.user,
        working_dir: config.working_dir,
        labels: config.labels,
        env: Some(payload.env),
        exposed_ports: config.exposed_ports,
        tty: config.tty,
        open_stdin: config.open_stdin,
        stdin_once: config.stdin_once,
        healthcheck: config.healthcheck,
        stop_signal: config.stop_signal,
        stop_timeout: config.stop_timeout,
        shell: config.shell,
        host_config: inspect.host_config,
        networking_config: inspect.network_settings.map(|ns| bollard::models::NetworkingConfig {
            endpoints_config: ns.networks,
            ..Default::default()
        }),
        ..Default::default()
    };

    // 2. Stop container. Do not remove a running container if stop failed.
    if let Err(error) = docker.stop_container(&id, None).await {
        if inspect.state.as_ref().and_then(|state| state.running).unwrap_or(false) {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to stop container: {}", error)).into_response();
        }
    }

    // 3. Remove container
    let remove_options = bollard::query_parameters::RemoveContainerOptions {
        force: false,
        v: false,
        link: false,
    };
    if let Err(e) = docker.remove_container(&id, Some(remove_options)).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to remove container: {}", e)).into_response();
    }

    // 4. Create new container
    let create_options = bollard::query_parameters::CreateContainerOptions {
        name: Some(clean_name.to_string()),
        ..Default::default()
    };

    let created = match docker.create_container(Some(create_options), new_config).await {
        Ok(c) => c,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create new container: {}", e)).into_response(),
    };

    // 5. Start new container
    match docker.start_container(&created.id, None::<bollard::query_parameters::StartContainerOptions>).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({
            "id": created.id,
            "message": "Environment variables updated successfully"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to start new container: {}", e)).into_response(),
    }
}

pub async fn update_container_volumes(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateVolumesPayload>,
) -> impl IntoResponse {
    let docker = &state.docker;

    // 1. Inspect current container
    let inspect = match docker.inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>).await {
        Ok(i) => i,
        Err(e) => return (StatusCode::NOT_FOUND, format!("Container not found: {}", e)).into_response(),
    };
    
    let config = match inspect.config {
        Some(c) => c,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read container config").into_response(),
    };

    let name = inspect.name.unwrap_or_else(|| id.clone());
    let clean_name = name.trim_start_matches('/');

    let mut new_host_config = inspect.host_config.clone().unwrap_or_default();
    new_host_config.binds = Some(payload.volumes);

    let new_config = bollard::models::ContainerCreateBody {
        hostname: config.hostname,
        domainname: config.domainname,
        image: config.image,
        cmd: config.cmd,
        entrypoint: config.entrypoint,
        user: config.user,
        working_dir: config.working_dir,
        labels: config.labels,
        env: config.env,
        exposed_ports: config.exposed_ports,
        tty: config.tty,
        open_stdin: config.open_stdin,
        stdin_once: config.stdin_once,
        healthcheck: config.healthcheck,
        stop_signal: config.stop_signal,
        stop_timeout: config.stop_timeout,
        shell: config.shell,
        host_config: Some(new_host_config),
        networking_config: inspect.network_settings.map(|ns| bollard::models::NetworkingConfig {
            endpoints_config: ns.networks,
            ..Default::default()
        }),
        ..Default::default()
    };

    // 2. Stop container
    if let Err(error) = docker.stop_container(&id, None).await {
        if inspect.state.as_ref().and_then(|state| state.running).unwrap_or(false) {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to stop container: {}", error)).into_response();
        }
    }

    // 3. Remove container
    let remove_options = bollard::query_parameters::RemoveContainerOptions {
        force: false,
        v: false,
        link: false,
    };
    if let Err(e) = docker.remove_container(&id, Some(remove_options)).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to remove container: {}", e)).into_response();
    }

    // 4. Create new container
    let create_options = bollard::query_parameters::CreateContainerOptions {
        name: Some(clean_name.to_string()),
        ..Default::default()
    };

    let created = match docker.create_container(Some(create_options), new_config).await {
        Ok(c) => c,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create new container: {}", e)).into_response(),
    };

    // 5. Start new container
    match docker.start_container(&created.id, None::<bollard::query_parameters::StartContainerOptions>).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({
            "id": created.id,
            "message": "Volumes updated successfully"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to start new container: {}", e)).into_response(),
    }
}

pub async fn container_action(
    State(state): State<AppState>,
    Path((id, action)): Path<(String, String)>,
) -> impl IntoResponse {
    let docker = &state.docker;

    let res = match action.as_str() {
        "start" => docker.start_container(&id, None::<bollard::query_parameters::StartContainerOptions>).await,
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

pub use super::updates::*;
pub use super::update_runner::*;
