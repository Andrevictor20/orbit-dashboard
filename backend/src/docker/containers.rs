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

pub fn get_host_platform() -> &'static str {
    match std::env::consts::ARCH {
        "aarch64" => "linux/arm64",
        "arm" => "linux/arm/v7",
        "x86_64" => "linux/amd64",
        "x86" => "linux/386",
        "riscv64" => "linux/riscv64",
        _ => "linux/amd64",
    }
}

pub fn parse_image_ref(image: &str) -> (String, String, String) {
    let (img, tag) = if let Some((name, t)) = image.rsplit_once(':') {
        if !name.contains('/') || name.rfind('/').unwrap() < image.rfind(':').unwrap_or(0) {
            (name.to_string(), t.to_string())
        } else {
            (image.to_string(), "latest".to_string())
        }
    } else {
        (image.to_string(), "latest".to_string())
    };

    if img.starts_with("ghcr.io/") {
        ("ghcr.io".to_string(), img.trim_start_matches("ghcr.io/").to_string(), tag)
    } else if img.contains('/') {
        if img.split('/').next().unwrap_or("").contains('.') {
            let parts: Vec<&str> = img.splitn(2, '/').collect();
            (parts[0].to_string(), parts[1].to_string(), tag)
        } else {
            ("registry-1.docker.io".to_string(), img, tag)
        }
    } else {
        ("registry-1.docker.io".to_string(), format!("library/{}", img), tag)
    }
}

pub async fn check_remote_registry_for_update(docker: &bollard::Docker, image: &str) -> bool {
    // 1. Inspect local image
    let inspect = match docker.inspect_image(image).await {
        Ok(i) => i,
        Err(_) => return false,
    };
    let local_digests = inspect.repo_digests.unwrap_or_default();
    
    // 2. Parse image: e.g. "nginx:latest", "linuxserver/qbittorrent", "ghcr.io/owner/repo:tag"
    let (registry, repo, tag) = parse_image_ref(image);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    // Get Auth Token if needed
    let token = if registry == "registry-1.docker.io" {
        let auth_url = format!("https://auth.docker.io/token?service=registry.docker.io&scope=repository:{}:pull", repo);
        if let Ok(res) = client.get(&auth_url).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                json.get("token").and_then(|t| t.as_str()).map(|s| s.to_string())
            } else { None }
        } else { None }
    } else if registry == "ghcr.io" {
        let auth_url = format!("https://ghcr.io/token?service=ghcr.io&scope=repository:{}:pull", repo);
        if let Ok(res) = client.get(&auth_url).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                json.get("token").and_then(|t| t.as_str()).map(|s| s.to_string())
            } else { None }
        } else { None }
    } else {
        None
    };

    // Query manifest HEAD
    let manifest_url = format!("https://{}/v2/{}/manifests/{}", registry, repo, tag);
    let mut req = client.head(&manifest_url)
        .header("Accept", "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json");

    if let Some(tok) = token {
        req = req.header("Authorization", format!("Bearer {}", tok));
    }

    if let Ok(res) = req.send().await {
        if res.status().is_success() {
            if let Some(remote_digest) = res.headers().get("docker-content-digest").and_then(|d| d.to_str().ok()) {
                let matches = local_digests.iter().any(|ld| ld.ends_with(remote_digest) || ld.contains(remote_digest));
                return !matches;
            }
        }
    }

    false
}

static UPDATE_CACHE: once_cell::sync::Lazy<std::sync::RwLock<std::collections::HashMap<String, (bool, u64)>>> = 
    once_cell::sync::Lazy::new(|| std::sync::RwLock::new(std::collections::HashMap::new()));

pub async fn check_single_image_update(docker: &bollard::Docker, image: &str) -> bool {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
    
    // Check cache (15 min TTL = 900s)
    if let Ok(cache) = UPDATE_CACHE.read() {
        if let Some((has_update, timestamp)) = cache.get(image) {
            if now.saturating_sub(*timestamp) < 900 {
                return *has_update;
            }
        }
    }

    let has_update = check_remote_registry_for_update(docker, image).await;
    
    if let Ok(mut cache) = UPDATE_CACHE.write() {
        cache.insert(image.to_string(), (has_update, now));
    }
    
    has_update
}

pub async fn check_container_updates(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let options = bollard::query_parameters::ListContainersOptions {
        all: true,
        ..Default::default()
    };
    let containers = state.docker.list_containers(Some(options)).await.unwrap_or_default();
    let mut update_results = std::collections::HashMap::new();

    for c in containers {
        if let (Some(id), Some(image)) = (c.id, c.image) {
            let short_id: String = id.chars().take(12).collect();
            let has_update = check_single_image_update(&state.docker, &image).await;
            update_results.insert(short_id, serde_json::json!({
                "image": image,
                "has_update": has_update
            }));
        }
    }

    (StatusCode::OK, Json(update_results)).into_response()
}

pub async fn check_single_container_update(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let inspect = match state.docker.inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>).await {
        Ok(i) => i,
        Err(e) => return (StatusCode::NOT_FOUND, format!("Container not found: {}", e)).into_response(),
    };

    let image = inspect.config.and_then(|c| c.image).unwrap_or_default();
    let has_update = check_single_image_update(&state.docker, &image).await;

    (StatusCode::OK, Json(serde_json::json!({
        "id": id,
        "image": image,
        "has_update": has_update
    }))).into_response()
}

pub async fn update_container(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let docker = &state.docker;

    // 1. Inspect existing container
    let inspect = match docker.inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>).await {
        Ok(i) => i,
        Err(e) => return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "id": id,
                "status": "error",
                "message": format!("Container não encontrado: {}", e),
                "details": e.to_string()
            }))
        ).into_response(),
    };

    let name = inspect.name.clone().unwrap_or_else(|| id.clone());
    let clean_name = name.trim_start_matches('/').to_string();

    // Check if it is a compose app in /data/apps/ or host directories
    let compose_dir = inspect.config.as_ref()
        .and_then(|c| c.labels.as_ref())
        .and_then(|l| l.get("com.docker.compose.project.working_dir"));

    if let Some(dir) = compose_dir {
        let host_dir_candidate = format!("/host{}", dir);
        let actual_dir = if std::path::Path::new(dir).exists() {
            Some(dir.as_str())
        } else if std::path::Path::new(&host_dir_candidate).exists() {
            Some(host_dir_candidate.as_str())
        } else {
            None
        };

        if let Some(target_dir) = actual_dir {
            tracing::info!("Updating compose app in directory: {}", target_dir);
            let pull_res = tokio::process::Command::new("docker")
                .arg("compose")
                .arg("pull")
                .current_dir(target_dir)
                .output()
                .await;

            if let Ok(o) = pull_res {
                if o.status.success() {
                    let up_res = tokio::process::Command::new("docker")
                        .arg("compose")
                        .arg("up")
                        .arg("-d")
                        .current_dir(target_dir)
                        .output()
                        .await;

                    if let Ok(uo) = up_res {
                        if uo.status.success() {
                            return (StatusCode::OK, Json(serde_json::json!({
                                "id": id,
                                "name": clean_name,
                                "status": "success",
                                "message": "Container atualizado e reiniciado com sucesso via Docker Compose!"
                            }))).into_response();
                        } else {
                            let stderr_msg = String::from_utf8_lossy(&uo.stderr).to_string();
                            tracing::warn!("docker compose up failed: {}", stderr_msg);
                        }
                    }
                } else {
                    let stderr_msg = String::from_utf8_lossy(&o.stderr).to_string();
                    tracing::warn!("docker compose pull failed: {}", stderr_msg);
                }
            }
        }
    }

    // Standard standalone container update:
    let config = match inspect.config {
        Some(c) => c,
        None => return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "id": id,
                "name": clean_name,
                "status": "error",
                "message": "Falha ao ler configuração do container",
                "details": "Container inspect retornou config vazia"
            }))
        ).into_response(),
    };

    let image_name = match &config.image {
        Some(img) => img.clone(),
        None => return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "id": id,
                "name": clean_name,
                "status": "error",
                "message": "Container não possui imagem definida",
                "details": "Nenhum nome de imagem foi especificado na configuração"
            }))
        ).into_response(),
    };

    let platform = get_host_platform();
    tracing::info!("Pulling updated image {} for platform {}", image_name, platform);

    // 2. Safe Image Pull with stream validation BEFORE touching the existing container
    let create_image_options = bollard::query_parameters::CreateImageOptions {
        from_image: Some(image_name.clone()),
        platform: platform.to_string(),
        ..Default::default()
    };
    let mut pull_stream = docker.create_image(Some(create_image_options), None, None);
    let mut pull_failed = false;
    let mut pull_error_msg = String::new();

    while let Some(res) = pull_stream.next().await {
        match res {
            Ok(info) => {
                if let Some(err) = info.error_detail.and_then(|ed| ed.message) {
                    pull_failed = true;
                    pull_error_msg = err;
                    break;
                }
            }
            Err(e) => {
                pull_failed = true;
                pull_error_msg = e.to_string();
                break;
            }
        }
    }

    // If pull with platform failed (e.g. registry doesn't accept platform parameter or single-arch image), retry without platform constraint
    if pull_failed {
        tracing::warn!("Pull with platform {} for {} failed ({}), retrying without platform parameter...", platform, image_name, pull_error_msg);
        let fallback_options = bollard::query_parameters::CreateImageOptions {
            from_image: Some(image_name.clone()),
            ..Default::default()
        };
        let mut fallback_stream = docker.create_image(Some(fallback_options), None, None);
        let mut fallback_failed = false;
        let mut fallback_error_msg = String::new();

        while let Some(res) = fallback_stream.next().await {
            match res {
                Ok(info) => {
                    if let Some(err) = info.error_detail.and_then(|ed| ed.message) {
                        fallback_failed = true;
                        fallback_error_msg = err;
                        break;
                    }
                }
                Err(e) => {
                    fallback_failed = true;
                    fallback_error_msg = e.to_string();
                    break;
                }
            }
        }

        if fallback_failed {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "id": id,
                    "name": clean_name,
                    "image": image_name,
                    "status": "error",
                    "message": format!("Falha ao baixar imagem atualizada '{}'", image_name),
                    "details": fallback_error_msg
                }))
            ).into_response();
        }
    }

    // 3. Multi-Network Handling & Sanitization
    // Docker daemon create_container only accepts 1 network in NetworkingConfig.
    // We isolate the first network for create_container and attach additional networks after creation.
    let all_networks = inspect.network_settings
        .and_then(|ns| ns.networks)
        .unwrap_or_default();

    let mut net_iter = all_networks.into_iter();
    let primary_network = net_iter.next();
    let secondary_networks: Vec<(String, bollard::models::EndpointSettings)> = net_iter.collect();

    let initial_networking_config = primary_network.map(|(net_name, ep)| {
        let sanitized_ep = bollard::models::EndpointSettings {
            aliases: ep.aliases,
            ipam_config: ep.ipam_config,
            links: ep.links,
            ..Default::default()
        };
        let mut map = std::collections::HashMap::new();
        map.insert(net_name, sanitized_ep);
        bollard::models::NetworkingConfig {
            endpoints_config: Some(map),
        }
    });

    let new_config = bollard::models::ContainerCreateBody {
        hostname: config.hostname,
        domainname: config.domainname,
        image: Some(image_name.clone()),
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
        host_config: inspect.host_config,
        networking_config: initial_networking_config,
        ..Default::default()
    };

    // 4. Stop container with graceful timeout
    let stop_options = bollard::query_parameters::StopContainerOptions {
        t: Some(10),
        ..Default::default()
    };
    let _ = docker.stop_container(&id, Some(stop_options)).await;

    // 5. Remove old container
    let remove_options = bollard::query_parameters::RemoveContainerOptions {
        force: true,
        v: false,
        link: false,
    };
    if let Err(e) = docker.remove_container(&id, Some(remove_options)).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "id": id,
                "name": clean_name,
                "image": image_name,
                "status": "error",
                "message": format!("Falha ao remover container antigo: {}", e),
                "details": e.to_string()
            }))
        ).into_response();
    }

    // 6. Create new container
    let create_options = bollard::query_parameters::CreateContainerOptions {
        name: Some(clean_name.to_string()),
        platform: platform.to_string(),
        ..Default::default()
    };

    let created = match docker.create_container(Some(create_options), new_config.clone()).await {
        Ok(c) => c,
        Err(e) => {
            // If creation failed with platform error, retry create without platform parameter
            let fallback_create_options = bollard::query_parameters::CreateContainerOptions {
                name: Some(clean_name.to_string()),
                ..Default::default()
            };
            match docker.create_container(Some(fallback_create_options), new_config).await {
                Ok(c) => c,
                Err(e2) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({
                            "id": id,
                            "name": clean_name,
                            "image": image_name,
                            "status": "error",
                            "message": format!("Falha ao recriar container: {}", e2),
                            "details": format!("Primary create error: {}. Fallback error: {}", e, e2)
                        }))
                    ).into_response();
                }
            }
        }
    };

    // 7. Attach secondary networks if any
    for (sec_net_name, sec_ep) in secondary_networks {
        let sanitized_sec_ep = bollard::models::EndpointSettings {
            aliases: sec_ep.aliases,
            ipam_config: sec_ep.ipam_config,
            links: sec_ep.links,
            ..Default::default()
        };
        let connect_opts = bollard::models::NetworkConnectRequest {
            container: created.id.clone(),
            endpoint_config: Some(sanitized_sec_ep),
        };
        if let Err(e) = docker.connect_network(&sec_net_name, connect_opts).await {
            tracing::warn!("Failed to attach secondary network {} to container {}: {}", sec_net_name, created.id, e);
        }
    }

    // 8. Start new container
    match docker.start_container(&created.id, None::<bollard::query_parameters::StartContainerOptions>).await {
        Ok(_) => {
            // Invalidate memory update cache for this image
            if let Ok(mut cache) = UPDATE_CACHE.write() {
                cache.remove(&image_name);
            }

            // Prune dangling images asynchronously to keep storage clean
            let docker_clone = docker.clone();
            tokio::spawn(async move {
                let mut filters = std::collections::HashMap::new();
                filters.insert("dangling".to_string(), vec!["true".to_string()]);
                let _ = docker_clone.prune_images(Some(bollard::query_parameters::PruneImagesOptions { filters: Some(filters) })).await;
            });

            (StatusCode::OK, Json(serde_json::json!({
                "id": created.id,
                "name": clean_name,
                "image": image_name,
                "status": "success",
                "message": "Container atualizado e reiniciado com sucesso!"
            }))).into_response()
        },
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "id": created.id,
                "name": clean_name,
                "image": image_name,
                "status": "error",
                "message": format!("Falha ao iniciar container atualizado: {}", e),
                "details": e.to_string()
            }))
        ).into_response(),
    }
}
