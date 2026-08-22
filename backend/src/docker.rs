use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    Json,
    response::IntoResponse,
};
use bollard::Docker;
use serde::Serialize;
use std::sync::Arc;
use futures::StreamExt;

#[derive(Clone)]
pub struct AppState {
    pub docker: Arc<Docker>,
}

#[derive(Serialize)]
pub struct PortInfo {
    pub ip: Option<String>,
    pub private_port: u16,
    pub public_port: Option<u16>,
    pub typ: String,
}

#[derive(Serialize)]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
    pub ports: Vec<PortInfo>,
    pub size_rw: Option<i64>,
    pub size_root_fs: Option<i64>,
}

#[derive(serde::Deserialize)]
pub struct UpdateEnvPayload {
    pub env: Vec<String>,
}

#[derive(serde::Deserialize)]
pub struct UpdateVolumesPayload {
    pub volumes: Vec<String>,
}

fn valid_env_entry(entry: &str) -> bool {
    let Some((key, _)) = entry.split_once('=') else {
        return false;
    };

    !key.is_empty()
        && !key.as_bytes()[0].is_ascii_digit()
        && key.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
}

pub fn calculate_cpu_percent(
    cpu_usage_total: f64,
    precpu_usage_total: f64,
    system_cpu_usage: f64,
    presystem_cpu_usage: f64,
    online_cpus: f64,
) -> f64 {
    let cpu_delta = cpu_usage_total - precpu_usage_total;
    let system_delta = system_cpu_usage - presystem_cpu_usage;
    
    if system_delta > 0.0 && cpu_delta > 0.0 {
        (cpu_delta / system_delta) * online_cpus * 100.0
    } else {
        0.0
    }
}

#[derive(Serialize)]
pub struct ContainerSnapshot {
    pub id: String,
    pub cpu_percent: f64,
    pub memory_used: u64,
    pub memory_limit: u64,
}

#[derive(Serialize)]
pub struct ImageInfo {
    pub id: String,
    pub tags: Vec<String>,
    pub size: i64,
}

#[derive(Serialize)]
pub struct NetworkInfo {
    pub id: String,
    pub name: String,
    pub driver: String,
}

#[derive(Serialize)]
pub struct VolumeInfo {
    pub name: String,
    pub driver: String,
    pub mountpoint: String,
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
                .map(|c| ContainerInfo {
                    id: c.id.unwrap_or_default().chars().take(12).collect(),
                    name: c.names.unwrap_or_default().first().unwrap_or(&"".to_string()).replace("/", ""),
                    image: c.image.unwrap_or_default(),
                    state: c.state.map(|s| s.to_string()).unwrap_or_default(),
                    status: c.status.unwrap_or_default(),
                    ports: c.ports.unwrap_or_default().into_iter().map(|p| PortInfo {
                        ip: p.ip,
                        private_port: p.private_port,
                        public_port: p.public_port,
                        typ: p.typ.map(|t| t.to_string()).unwrap_or_else(|| "tcp".to_string()),
                    }).collect(),
                    size_rw: c.size_rw,
                    size_root_fs: c.size_root_fs,
                })
                .collect();
            (StatusCode::OK, Json(info)).into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch containers").into_response(),
    }
}

pub async fn snapshot_stats(
    State(state): State<AppState>,
) -> impl IntoResponse {
    // Get all running containers
    let mut options = bollard::query_parameters::ListContainersOptions::default();
    options.all = false; // Only running
    
    let containers = match state.docker.list_containers(Some(options)).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to list").into_response(),
    };

    let futures = containers.into_iter().filter_map(|c| {
        let id = c.id?;
        let docker = state.docker.clone();
        Some(async move {
            let stats_options = bollard::query_parameters::StatsOptions {
                stream: false,
                ..Default::default()
            };
            let mut stream = docker.stats(&id, Some(stats_options));
            
            // Timeout after 2 seconds per container to avoid blocking the whole pipeline
            let stat_result = tokio::time::timeout(std::time::Duration::from_millis(2000), stream.next()).await;
            if let Ok(Some(Ok(stats))) = stat_result {
                let mut cpu_percent = 0.0;
                
                if let (Some(cpu), Some(precpu)) = (stats.cpu_stats, stats.precpu_stats) {
                    let cpu_usage_total = cpu.cpu_usage.as_ref().and_then(|u| u.total_usage).unwrap_or(0) as f64;
                    let precpu_usage_total = precpu.cpu_usage.as_ref().and_then(|u| u.total_usage).unwrap_or(0) as f64;
                    let system_cpu_usage = cpu.system_cpu_usage.unwrap_or(0) as f64;
                    let presystem_cpu_usage = precpu.system_cpu_usage.unwrap_or(0) as f64;
                    
                    let online_cpus = cpu.online_cpus.unwrap_or(
                        cpu.cpu_usage.as_ref().and_then(|u| u.percpu_usage.as_ref()).map(|v| v.len()).unwrap_or(1) as u32
                    ) as f64;

                    cpu_percent = calculate_cpu_percent(
                        cpu_usage_total,
                        precpu_usage_total,
                        system_cpu_usage,
                        presystem_cpu_usage,
                        online_cpus,
                    );
                }

                let memory_used = stats.memory_stats.as_ref().and_then(|m| m.usage).unwrap_or(0);
                let memory_limit = stats.memory_stats.as_ref().and_then(|m| m.limit).unwrap_or(0);

                Some(ContainerSnapshot {
                    id: id.chars().take(12).collect(),
                    cpu_percent,
                    memory_used,
                    memory_limit,
                })
            } else {
                None
            }
        })
    });

    let results = futures::future::join_all(futures).await;
    let snapshots: Vec<ContainerSnapshot> = results.into_iter().flatten().collect();

    (StatusCode::OK, Json(snapshots)).into_response()
}

pub async fn list_images(
    State(state): State<AppState>,
) -> impl IntoResponse {
    match state.docker.list_images(Some(bollard::query_parameters::ListImagesOptions::default())).await {
        Ok(images) => {
            let info: Vec<ImageInfo> = images
                .into_iter()
                .map(|img| ImageInfo {
                    id: img.id.replace("sha256:", "").chars().take(12).collect(),
                    tags: img.repo_tags,
                    size: img.size,
                })
                .collect();
            (StatusCode::OK, Json(info)).into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch images").into_response(),
    }
}

pub async fn list_networks(
    State(state): State<AppState>,
) -> impl IntoResponse {
    match state.docker.list_networks(None).await {
        Ok(networks) => {
            let info: Vec<NetworkInfo> = networks
                .into_iter()
                .map(|net| NetworkInfo {
                    id: net.id.unwrap_or_default().chars().take(12).collect(),
                    name: net.name.unwrap_or_default(),
                    driver: net.driver.unwrap_or_default(),
                })
                .collect();
            (StatusCode::OK, Json(info)).into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch networks").into_response(),
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
pub async fn list_volumes(
    State(state): State<AppState>,
) -> impl IntoResponse {
    match state.docker.list_volumes(None::<bollard::query_parameters::ListVolumesOptions>).await {
        Ok(volumes_response) => {
            let info: Vec<VolumeInfo> = volumes_response.volumes
                .unwrap_or_default()
                .into_iter()
                .map(|v| VolumeInfo {
                    name: v.name,
                    driver: v.driver,
                    mountpoint: v.mountpoint,
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
    match state.docker.prune_volumes(None::<bollard::query_parameters::PruneVolumesOptions>).await {
        Ok(_) => (StatusCode::OK, "Volumes pruned successfully").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

pub async fn prune_images(
    State(state): State<AppState>,
) -> impl IntoResponse {
    match state.docker.prune_images(None::<bollard::query_parameters::PruneImagesOptions>).await {
        Ok(_) => (StatusCode::OK, "Images pruned successfully").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
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

pub async fn delete_volume(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    match state.docker.remove_volume(&name, None::<bollard::query_parameters::RemoveVolumeOptions>).await {
        Ok(_) => (StatusCode::OK, "Volume removed successfully").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
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

#[derive(serde::Deserialize)]
pub struct DeleteContainerQuery {
    pub v: Option<bool>,
    pub image: Option<bool>,
    pub network: Option<bool>,
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

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use bollard::exec::{CreateExecOptions, StartExecResults};
use futures::sink::SinkExt;

pub async fn container_exec_ws(
    State(state): State<AppState>,
    Path(id): Path<String>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_exec_socket(socket, state.docker, id))
}

async fn handle_exec_socket(socket: WebSocket, docker: Arc<Docker>, id: String) {
    let (mut sender, mut receiver) = socket.split();

    // 1. Create Exec
    let exec_options = CreateExecOptions {
        attach_stdout: Some(true),
        attach_stderr: Some(true),
        attach_stdin: Some(true),
        tty: Some(true),
        cmd: Some(vec!["/bin/sh".to_string()]), // Default to sh, usually available
        ..Default::default()
    };

    let exec = match docker.create_exec(&id, exec_options).await {
        Ok(e) => e,
        Err(err) => {
            let _ = sender.send(Message::Text(format!("Failed to create exec: {}", err).into())).await;
            return;
        }
    };

    // 2. Start Exec
    let start_options = bollard::exec::StartExecOptions {
        detach: false,
        tty: true,
        output_capacity: None,
    };

    match docker.start_exec(&exec.id, Some(start_options)).await {
        Ok(StartExecResults::Attached { mut output, mut input }) => {
            // Forward from Docker to WebSocket
            let mut send_task = tokio::spawn(async move {
                while let Some(Ok(msg)) = output.next().await {
                    let text = msg.to_string();
                    if sender.send(Message::Text(text.into())).await.is_err() {
                        break;
                    }
                }
            });

            // Forward from WebSocket to Docker
            let mut recv_task = tokio::spawn(async move {
                while let Some(Ok(msg)) = receiver.next().await {
                    if let Message::Text(text) = msg {
                        use tokio::io::AsyncWriteExt;
                        let _ = input.write_all(text.as_bytes()).await;
                    } else if let Message::Binary(bin) = msg {
                        use tokio::io::AsyncWriteExt;
                        let _ = input.write_all(&bin).await;
                    }
                }
            });

            tokio::select! {
                _ = (&mut send_task) => recv_task.abort(),
                _ = (&mut recv_task) => send_task.abort(),
            };
        },
        Ok(StartExecResults::Detached) => {
            let _ = sender.send(Message::Text("Exec started detached".into())).await;
        },
        Err(err) => {
            let _ = sender.send(Message::Text(format!("Failed to start exec: {}", err).into())).await;
        }
    }
}

pub async fn prune_networks(
    State(state): State<AppState>,
) -> impl IntoResponse {
    match state.docker.prune_networks(None::<bollard::query_parameters::PruneNetworksOptions>).await {
        Ok(_) => (StatusCode::OK, "Networks pruned successfully").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_env_entry() {
        // Valid cases
        assert!(valid_env_entry("KEY=value"));
        assert!(valid_env_entry("KEY=")); // Empty value is allowed
        assert!(valid_env_entry("MY_VAR_123=something"));
        assert!(valid_env_entry("_HIDDEN=123")); // Underscore prefix is allowed
        assert!(valid_env_entry("A=b=c")); // Multiple equals is allowed, split is on first

        // Invalid cases
        assert!(!valid_env_entry("=value")); // Empty key
        assert!(!valid_env_entry("123KEY=value")); // Starts with digit
        assert!(!valid_env_entry("KEY-1=value")); // Invalid char in key
        assert!(!valid_env_entry("NO_EQUALS")); // Missing =
    }

    #[test]
    fn test_calculate_cpu_percent() {
        // Normal case
        let pct = calculate_cpu_percent(200.0, 100.0, 1000.0, 500.0, 2.0);
        assert_eq!(pct, 40.0);

        // Negative CPU delta
        assert_eq!(calculate_cpu_percent(100.0, 200.0, 1000.0, 500.0, 2.0), 0.0);

        // Zero system delta
        assert_eq!(calculate_cpu_percent(200.0, 100.0, 500.0, 500.0, 2.0), 0.0);
        
        // Zero CPU delta
        assert_eq!(calculate_cpu_percent(100.0, 100.0, 1000.0, 500.0, 2.0), 0.0);
    }
}
