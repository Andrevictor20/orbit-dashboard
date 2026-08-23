use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use futures::StreamExt;
use crate::state::AppState;
use super::types::{ContainerInfo, DeleteContainerQuery, PortInfo, UpdateEnvPayload, UpdateVolumesPayload};

pub fn valid_env_entry(entry: &str) -> bool {
    let Some((key, _)) = entry.split_once('=') else {
        return false;
    };

    !key.is_empty()
        && !key.as_bytes()[0].is_ascii_digit()
        && key.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
}

pub async fn list_containers(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let mut options = bollard::query_parameters::ListContainersOptions::default();
    options.all = true;
    options.size = false; // Fast listing without slow synchronous filesystem scans

    match state.docker.list_containers(Some(options)).await {
        Ok(containers) => {
            let info: Vec<ContainerInfo> = containers
                .into_iter()
                .map(|c| {
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
                                .unwrap_or_else(|| c.id.as_deref().unwrap_or("unknown").chars().take(12).collect())
                        });

                    let labels = c.labels.unwrap_or_default();

                    ContainerInfo {
                        id: c.id.unwrap_or_default().chars().take(12).collect(),
                        name,
                        image: c.image.unwrap_or_default(),
                        state: c.state.map(|s| s.to_string()).unwrap_or_default(),
                        status: c.status.unwrap_or_default(),
                        ports: c.ports.unwrap_or_default().into_iter().map(|p| PortInfo {
                            ip: p.ip,
                            private_port: p.private_port,
                            public_port: p.public_port,
                            typ: p.typ.map(|t| t.to_string()).unwrap_or_else(|| "tcp".to_string()),
                        }).collect(),
                        labels,
                        size_rw: c.size_rw,
                        size_root_fs: c.size_root_fs,
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

    if query.image.unwrap_or(false) || query.network.unwrap_or(false) {
        if let Ok(inspect) = docker.inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>).await {
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
    }

    let remove_volumes = query.v.unwrap_or(false);
    let options = Some(bollard::query_parameters::RemoveContainerOptions {
        force: true, // Force removal if running
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

    (StatusCode::OK, "Container removed successfully").into_response()
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
