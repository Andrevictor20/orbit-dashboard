//! Asynchronous and synchronous Docker container update lifecycle runner.
//! Handles image pulling, compose integration, network rewiring, container replacement,
//! and background task status tracking.

use std::collections::HashMap;
use std::sync::{Arc, LazyLock, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio_util::sync::CancellationToken;

use crate::state::AppState;
use super::containers::resolve_compose_file;
use super::updates::{get_host_platform, invalidate_update_cache};

#[derive(Debug, Deserialize, Default)]
pub struct UpdateContainerQuery {
    pub wait: Option<bool>,
    pub force: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerUpdateTask {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String, // "pulling" | "recreating" | "success" | "error" | "cancelled"
    pub step: String,
    pub error: Option<String>,
    pub details: Option<String>,
    pub updated_at: u64,
}

pub static CONTAINER_UPDATE_TASKS: LazyLock<RwLock<HashMap<String, ContainerUpdateTask>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));

pub static UPDATE_TASK_TOKENS: LazyLock<RwLock<HashMap<String, CancellationToken>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));

pub fn update_task_status(
    id: &str,
    name: &str,
    image: &str,
    status: &str,
    step: &str,
    error: Option<String>,
    details: Option<String>,
) {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    if let Ok(mut tasks) = CONTAINER_UPDATE_TASKS.write() {
        tasks.insert(
            id.to_string(),
            ContainerUpdateTask {
                id: id.to_string(),
                name: name.to_string(),
                image: image.to_string(),
                status: status.to_string(),
                step: step.to_string(),
                error,
                details,
                updated_at: now,
            },
        );
    }
}

fn clean_cli_output(line: &str) -> String {
    let re_ansi = regex::Regex::new(r"\x1B\[[0-?]*[ -/]*[@-~]").unwrap();
    let cleaned = re_ansi.replace_all(line, "");
    cleaned.trim_matches(|c: char| c == '\r' || c == '\n' || c.is_whitespace()).to_string()
}

pub async fn execute_container_update(
    docker: Arc<bollard::Docker>,
    id: String,
    clean_name: String,
    inspect: bollard::models::ContainerInspectResponse,
    cancel_token: CancellationToken,
) -> (StatusCode, Json<Value>) {
    let compose_dir = inspect.config.as_ref()
        .and_then(|c| c.labels.as_ref())
        .and_then(|l| l.get("com.docker.compose.project.working_dir"))
        .map(|s| s.as_str());

    let compose_file_label = inspect.config.as_ref()
        .and_then(|c| c.labels.as_ref())
        .and_then(|l| l.get("com.docker.compose.project.config_files"))
        .map(|s| s.as_str())
        .unwrap_or("docker-compose.yml");

    let compose_service = inspect.config.as_ref()
        .and_then(|c| c.labels.as_ref())
        .and_then(|l| l.get("com.docker.compose.service"))
        .map(|s| s.as_str());

    let is_compose_project = inspect.config.as_ref()
        .and_then(|c| c.labels.as_ref())
        .map(|l| l.contains_key("com.docker.compose.project"))
        .unwrap_or(false);

    let config = match &inspect.config {
        Some(c) => c,
        None => {
            update_task_status(
                &id,
                &clean_name,
                "",
                "error",
                "Falha ao ler configuração do container",
                Some("Configuração vazia retornada pelo Docker".to_string()),
                None,
            );
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "id": id,
                    "name": clean_name,
                    "status": "error",
                    "message": "Falha ao ler configuração do container",
                    "details": "Container inspect retornou config vazia"
                }))
            );
        }
    };

    let image_name = match &config.image {
        Some(img) => img.clone(),
        None => {
            update_task_status(
                &id,
                &clean_name,
                "",
                "error",
                "Container não possui imagem definida",
                Some("Nenhum nome de imagem foi especificado na configuração".to_string()),
                None,
            );
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "id": id,
                    "name": clean_name,
                    "status": "error",
                    "message": "Container não possui imagem definida",
                    "details": "Nenhum nome de imagem foi especificado na configuração"
                }))
            );
        }
    };

    if is_compose_project || compose_dir.is_some() {
        if let Some((compose_file_path, project_dir)) = resolve_compose_file(compose_dir, compose_file_label) {
            tracing::info!("Found compose file: {:?} in project dir: {:?} (service: {:?})", compose_file_path, project_dir, compose_service);
            let host_project_dir = project_dir.to_string_lossy();
            let host_project_dir_arg = host_project_dir.strip_prefix("/host").unwrap_or(&host_project_dir);

            update_task_status(
                &id,
                &clean_name,
                &image_name,
                "pulling",
                &format!("Baixando imagem atualizada via Docker Compose (serviço: {})...", compose_service.unwrap_or("todos")),
                None,
                None,
            );

            let mut pull_cmd = tokio::process::Command::new("docker");
            pull_cmd.arg("compose")
                .arg("-f").arg(&compose_file_path)
                .arg("--project-directory").arg(&project_dir)
                .arg("pull");
            if let Some(svc) = compose_service {
                pull_cmd.arg(svc);
            }
            pull_cmd.stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped());

            let mut compose_succeeded = false;
            let pull_spawn = pull_cmd.spawn();

            if let Ok(mut child) = pull_spawn {
                let stderr = child.stderr.take();
                let stdout = child.stdout.take();
                let id_clone = id.clone();
                let name_clone = clean_name.clone();
                let img_clone = image_name.clone();
                let token_clone = cancel_token.clone();

                let reader_task = tokio::spawn(async move {
                    if let Some(stderr) = stderr {
                        let mut lines = BufReader::new(stderr).lines();
                        while let Ok(Some(line)) = lines.next_line().await {
                            if token_clone.is_cancelled() {
                                break;
                            }
                            let clean = clean_cli_output(&line);
                            if !clean.is_empty() {
                                update_task_status(
                                    &id_clone,
                                    &name_clone,
                                    &img_clone,
                                    "pulling",
                                    &clean,
                                    None,
                                    None,
                                );
                            }
                        }
                    } else if let Some(stdout) = stdout {
                        let mut lines = BufReader::new(stdout).lines();
                        while let Ok(Some(line)) = lines.next_line().await {
                            if token_clone.is_cancelled() {
                                break;
                            }
                            let clean = clean_cli_output(&line);
                            if !clean.is_empty() {
                                update_task_status(
                                    &id_clone,
                                    &name_clone,
                                    &img_clone,
                                    "pulling",
                                    &clean,
                                    None,
                                    None,
                                );
                            }
                        }
                    }
                });

                let pull_wait = child.wait();
                let pull_ok = tokio::select! {
                    res = pull_wait => {
                        let _ = reader_task.await;
                        res.map(|st| st.success()).unwrap_or(false)
                    }
                    _ = cancel_token.cancelled() => {
                        let _ = child.kill().await;
                        reader_task.abort();
                        update_task_status(
                            &id,
                            &clean_name,
                            &image_name,
                            "cancelled",
                            "Atualização cancelada pelo usuário",
                            None,
                            None,
                        );
                        return (StatusCode::OK, Json(serde_json::json!({
                            "id": id,
                            "name": clean_name,
                            "status": "cancelled",
                            "message": "Atualização cancelada pelo usuário"
                        })));
                    }
                    _ = tokio::time::sleep(std::time::Duration::from_secs(600)) => {
                        let _ = child.kill().await;
                        reader_task.abort();
                        tracing::warn!("Docker compose pull timed out after 600s for container '{}'. Falling back to standalone.", clean_name);
                        false
                    }
                };

                if pull_ok {
                    update_task_status(
                        &id,
                        &clean_name,
                        &image_name,
                        "recreating",
                        &format!("Recriando container via Docker Compose (serviço: {})...", compose_service.unwrap_or("todos")),
                        None,
                        None,
                    );

                    let mut up_cmd = tokio::process::Command::new("docker");
                    up_cmd.arg("compose")
                        .arg("-f").arg(&compose_file_path)
                        .arg("--project-directory").arg(host_project_dir_arg)
                        .arg("up")
                        .arg("-d")
                        .arg("--no-deps");
                    if let Some(svc) = compose_service {
                        up_cmd.arg(svc);
                    }
                    up_cmd.stdin(std::process::Stdio::null())
                        .stdout(std::process::Stdio::piped())
                        .stderr(std::process::Stdio::piped());

                    if let Ok(mut up_child) = up_cmd.spawn() {
                        let up_wait = up_child.wait();
                        tokio::select! {
                            res = up_wait => {
                                if let Ok(uo) = res {
                                    if uo.success() {
                                        compose_succeeded = true;
                                    } else {
                                        tracing::warn!("docker compose up exited with error code {:?}. Falling back to standalone.", uo.code());
                                    }
                                }
                            }
                            _ = cancel_token.cancelled() => {
                                let _ = up_child.kill().await;
                                update_task_status(
                                    &id,
                                    &clean_name,
                                    &image_name,
                                    "cancelled",
                                    "Atualização cancelada pelo usuário",
                                    None,
                                    None,
                                );
                                return (StatusCode::OK, Json(serde_json::json!({
                                    "id": id,
                                    "name": clean_name,
                                    "status": "cancelled",
                                    "message": "Atualização cancelada pelo usuário"
                                })));
                            }
                            _ = tokio::time::sleep(std::time::Duration::from_secs(180)) => {
                                let _ = up_child.kill().await;
                                tracing::warn!("docker compose up timed out after 180s. Falling back to standalone.");
                            }
                        }
                    }
                } else {
                    tracing::warn!("docker compose pull failed or timed out for '{}'. Falling back to standalone update.", clean_name);
                }
            } else {
                tracing::warn!("Failed to spawn docker compose pull for '{}'. Falling back to standalone update.", clean_name);
            }

            if compose_succeeded {
                update_task_status(
                    &id,
                    &clean_name,
                    &image_name,
                    "success",
                    "Container atualizado e reiniciado com sucesso via Docker Compose!",
                    None,
                    None,
                );
                invalidate_update_cache(&image_name);
                return (StatusCode::OK, Json(serde_json::json!({
                    "id": id,
                    "name": clean_name,
                    "image": image_name,
                    "status": "success",
                    "message": "Container atualizado e reiniciado com sucesso via Docker Compose!"
                })));
            }
        } else {
            tracing::warn!(
                "Compose labels present for container '{}' (dir: {:?}, file: {}), but compose file not found on disk. Falling back to standalone update.",
                clean_name,
                compose_dir,
                compose_file_label
            );
        }
    }

    // Standard standalone container update:
    let platform = get_host_platform();
    tracing::info!("Pulling updated image {} (host platform: {})", image_name, platform);

    update_task_status(
        &id,
        &clean_name,
        &image_name,
        "pulling",
        &format!("Baixando imagem atualizada '{}'...", image_name),
        None,
        None,
    );

    // 2. Safe Image Pull with stream validation BEFORE touching the existing container
    let create_image_options = bollard::query_parameters::CreateImageOptions {
        from_image: Some(image_name.clone()),
        ..Default::default()
    };
    let mut pull_stream = docker.create_image(Some(create_image_options), None, None);
    let mut pull_failed = false;
    let mut pull_error_msg = String::new();
    let mut last_progress_time = std::time::Instant::now();

    while let Some(res) = pull_stream.next().await {
        if cancel_token.is_cancelled() {
            update_task_status(
                &id,
                &clean_name,
                &image_name,
                "cancelled",
                "Atualização cancelada pelo usuário",
                None,
                None,
            );
            return (StatusCode::OK, Json(serde_json::json!({
                "id": id,
                "name": clean_name,
                "status": "cancelled",
                "message": "Atualização cancelada pelo usuário"
            })));
        }

        match res {
            Ok(info) => {
                if let Some(err) = info.error_detail.and_then(|ed| ed.message) {
                    pull_failed = true;
                    pull_error_msg = err;
                    break;
                }

                if let Some(status) = info.status {
                    let progress = if let Some(pd) = &info.progress_detail {
                        if let (Some(cur), Some(tot)) = (pd.current, pd.total) {
                            if tot > 0 {
                                format!(" ({:.1}MB / {:.1}MB)", cur as f64 / 1_048_576.0, tot as f64 / 1_048_576.0)
                            } else {
                                String::new()
                            }
                        } else {
                            String::new()
                        }
                    } else {
                        String::new()
                    };
                    let layer = info.id.map(|lid| format!("{}: ", lid)).unwrap_or_default();
                    let step_text = if !progress.is_empty() {
                        format!("{}{}{}", layer, status, progress)
                    } else if !layer.is_empty() {
                        format!("{}{}", layer, status)
                    } else {
                        status.clone()
                    };

                    if last_progress_time.elapsed().as_millis() >= 600 || status.contains("complete") || status.contains("Downloaded") {
                        last_progress_time = std::time::Instant::now();
                        update_task_status(
                            &id,
                            &clean_name,
                            &image_name,
                            "pulling",
                            &step_text,
                            None,
                            None,
                        );
                    }
                }
            }
            Err(e) => {
                pull_failed = true;
                pull_error_msg = e.to_string();
                break;
            }
        }
    }

    // If default pull failed, retry with platform constraint
    if pull_failed {
        tracing::warn!("Default pull for {} failed ({}), retrying with explicit platform {}...", image_name, pull_error_msg, platform);
        let fallback_options = bollard::query_parameters::CreateImageOptions {
            from_image: Some(image_name.clone()),
            platform: platform.to_string(),
            ..Default::default()
        };
        let mut fallback_stream = docker.create_image(Some(fallback_options), None, None);
        let mut fallback_failed = false;
        let mut fallback_error_msg = String::new();

        while let Some(res) = fallback_stream.next().await {
            if cancel_token.is_cancelled() {
                update_task_status(
                    &id,
                    &clean_name,
                    &image_name,
                    "cancelled",
                    "Atualização cancelada pelo usuário",
                    None,
                    None,
                );
                return (StatusCode::OK, Json(serde_json::json!({
                    "id": id,
                    "name": clean_name,
                    "status": "cancelled",
                    "message": "Atualização cancelada pelo usuário"
                })));
            }

            match res {
                Ok(info) => {
                    if let Some(err) = info.error_detail.and_then(|ed| ed.message) {
                        fallback_failed = true;
                        fallback_error_msg = err;
                        break;
                    }

                    if let Some(status) = info.status {
                        let progress = if let Some(pd) = &info.progress_detail {
                            if let (Some(cur), Some(tot)) = (pd.current, pd.total) {
                                if tot > 0 {
                                    format!(" ({:.1}MB / {:.1}MB)", cur as f64 / 1_048_576.0, tot as f64 / 1_048_576.0)
                                } else {
                                    String::new()
                                }
                            } else {
                                String::new()
                            }
                        } else {
                            String::new()
                        };
                        let layer = info.id.map(|lid| format!("{}: ", lid)).unwrap_or_default();
                        let step_text = if !progress.is_empty() {
                            format!("{}{}{}", layer, status, progress)
                        } else if !layer.is_empty() {
                            format!("{}{}", layer, status)
                        } else {
                            status.clone()
                        };

                        if last_progress_time.elapsed().as_millis() >= 600 || status.contains("complete") || status.contains("Downloaded") {
                            last_progress_time = std::time::Instant::now();
                            update_task_status(
                                &id,
                                &clean_name,
                                &image_name,
                                "pulling",
                                &step_text,
                                None,
                                None,
                            );
                        }
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
            let final_err = if !fallback_error_msg.is_empty() {
                fallback_error_msg
            } else {
                pull_error_msg
            };
            update_task_status(
                &id,
                &clean_name,
                &image_name,
                "error",
                &format!("Falha ao baixar imagem '{}'", image_name),
                Some(final_err.clone()),
                Some(final_err.clone()),
            );
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "id": id,
                    "name": clean_name,
                    "image": image_name,
                    "status": "error",
                    "message": format!("Falha ao baixar imagem atualizada '{}'", image_name),
                    "details": final_err
                }))
            );
        }
    }

    update_task_status(
        &id,
        &clean_name,
        &image_name,
        "recreating",
        "Parando e recriando container...",
        None,
        None,
    );

    // 3. Multi-Network Handling & Sanitization
    let is_host_or_special_network = inspect.host_config.as_ref()
        .and_then(|h| h.network_mode.as_deref())
        .map(|m| m.eq_ignore_ascii_case("host") || m.eq_ignore_ascii_case("none") || m.starts_with("container:"))
        .unwrap_or(false);

    let (initial_networking_config, secondary_networks) = if is_host_or_special_network {
        (None, Vec::new())
    } else {
        let all_networks = inspect.network_settings.as_ref()
            .and_then(|ns| ns.networks.clone())
            .unwrap_or_default();

        let mut net_iter = all_networks.into_iter();
        let primary_network = net_iter.next();
        let secondary: Vec<(String, bollard::models::EndpointSettings)> = net_iter.collect();

        let initial_cfg = primary_network.map(|(net_name, ep)| {
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

        (initial_cfg, secondary)
    };

    let new_config = bollard::models::ContainerCreateBody {
        hostname: config.hostname.clone(),
        domainname: config.domainname.clone(),
        image: Some(image_name.clone()),
        cmd: config.cmd.clone(),
        entrypoint: config.entrypoint.clone(),
        user: config.user.clone(),
        working_dir: config.working_dir.clone(),
        labels: config.labels.clone(),
        env: config.env.clone(),
        exposed_ports: config.exposed_ports.clone(),
        tty: config.tty,
        open_stdin: config.open_stdin,
        stdin_once: config.stdin_once,
        healthcheck: config.healthcheck.clone(),
        stop_signal: config.stop_signal.clone(),
        stop_timeout: config.stop_timeout,
        shell: config.shell.clone(),
        host_config: inspect.host_config.clone(),
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
        let err_str = e.to_string();
        update_task_status(
            &id,
            &clean_name,
            &image_name,
            "error",
            "Falha ao remover container antigo",
            Some(err_str.clone()),
            Some(err_str.clone()),
        );
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "id": id,
                "name": clean_name,
                "image": image_name,
                "status": "error",
                "message": format!("Falha ao remover container antigo: {}", e),
                "details": err_str
            }))
        );
    }

    // 6. Create new container
    let create_options = bollard::query_parameters::CreateContainerOptions {
        name: Some(clean_name.to_string()),
        ..Default::default()
    };

    let created = match docker.create_container(Some(create_options), new_config.clone()).await {
        Ok(c) => c,
        Err(e) => {
            let fallback_create_options = bollard::query_parameters::CreateContainerOptions {
                name: Some(clean_name.to_string()),
                platform: platform.to_string(),
                ..Default::default()
            };
            match docker.create_container(Some(fallback_create_options), new_config).await {
                Ok(c) => c,
                Err(e2) => {
                    let err_str = format!("Primary create error: {}. Fallback error: {}", e, e2);
                    update_task_status(
                        &id,
                        &clean_name,
                        &image_name,
                        "error",
                        "Falha ao recriar container",
                        Some(err_str.clone()),
                        Some(err_str.clone()),
                    );
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({
                            "id": id,
                            "name": clean_name,
                            "image": image_name,
                            "status": "error",
                            "message": format!("Falha ao recriar container: {}", e),
                            "details": err_str
                        }))
                    );
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
            invalidate_update_cache(&image_name);

            let docker_clone = docker.clone();
            tokio::spawn(async move {
                let mut filters = std::collections::HashMap::new();
                filters.insert("dangling".to_string(), vec!["true".to_string()]);
                let _ = docker_clone.prune_images(Some(bollard::query_parameters::PruneImagesOptions { filters: Some(filters) })).await;
            });

            update_task_status(
                &id,
                &clean_name,
                &image_name,
                "success",
                "Container atualizado e reiniciado com sucesso!",
                None,
                None,
            );

            (StatusCode::OK, Json(serde_json::json!({
                "id": created.id,
                "name": clean_name,
                "image": image_name,
                "status": "success",
                "message": "Container atualizado e reiniciado com sucesso!"
            })))
        },
        Err(e) => {
            let err_str = e.to_string();
            update_task_status(
                &id,
                &clean_name,
                &image_name,
                "error",
                "Falha ao iniciar container atualizado",
                Some(err_str.clone()),
                Some(err_str.clone()),
            );
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "id": created.id,
                    "name": clean_name,
                    "image": image_name,
                    "status": "error",
                    "message": format!("Falha ao iniciar container atualizado: {}", e),
                    "details": err_str
                }))
            )
        }
    }
}

pub async fn update_container(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<UpdateContainerQuery>,
) -> impl IntoResponse {
    let docker = state.docker.clone();

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

    if clean_name == "orbit-dashboard" || clean_name == "orbit" {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "id": id,
                "name": clean_name,
                "status": "error",
                "message": "O Orbit Dashboard possui um ciclo de vida próprio e não pode ser recriado diretamente nesta fila para não derrubar a sessão ativa. Utilize o Atualizador do Sistema no topo da página.",
                "details": "Orbit container cannot self-terminate in batch updates"
            }))
        ).into_response();
    }

    let image_name = inspect.config.as_ref()
        .and_then(|c| c.image.as_ref())
        .cloned()
        .unwrap_or_default();

    // Manage cancellation token for this container task
    let cancel_token = {
        let mut tokens = UPDATE_TASK_TOKENS.write().unwrap();
        if query.force.unwrap_or(false) {
            if let Some(old) = tokens.get(&id) {
                old.cancel();
            }
        }
        let token = CancellationToken::new();
        tokens.insert(id.clone(), token.clone());
        token
    };

    // If caller explicitly wants synchronous execution (e.g. tests or CLI with ?wait=true)
    if query.wait.unwrap_or(false) {
        return execute_container_update(docker, id, clean_name, inspect, cancel_token).await.into_response();
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Prevent duplicate concurrent updates on the same container unless force=true or stale (> 60s)
    if !query.force.unwrap_or(false) {
        if let Ok(tasks) = CONTAINER_UPDATE_TASKS.read() {
            if let Some(task) = tasks.get(&id) {
                if (task.status == "pulling" || task.status == "recreating") && (now - task.updated_at < 60) {
                    return (
                        StatusCode::OK,
                        Json(serde_json::json!({
                            "id": id,
                            "name": clean_name,
                            "image": image_name,
                            "status": "started",
                            "message": "Atualização já está em andamento para este container"
                        }))
                    ).into_response();
                }
            }
        }
    }

    update_task_status(
        &id,
        &clean_name,
        &image_name,
        "pulling",
        &format!("Iniciando download da imagem '{}'", image_name),
        None,
        None,
    );

    let task_id = id.clone();
    let task_name = clean_name.clone();
    let token_clone = cancel_token.clone();
    tokio::spawn(async move {
        let _ = execute_container_update(docker, task_id, task_name, inspect, token_clone).await;
    });

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "id": id,
            "name": clean_name,
            "image": image_name,
            "status": "started",
            "message": "Atualização iniciada em segundo plano"
        }))
    ).into_response()
}

pub async fn cancel_container_update(
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Ok(tokens) = UPDATE_TASK_TOKENS.read() {
        if let Some(token) = tokens.get(&id) {
            token.cancel();
        }
    }
    if let Ok(mut tasks) = CONTAINER_UPDATE_TASKS.write() {
        if let Some(task) = tasks.get_mut(&id) {
            task.status = "cancelled".to_string();
            task.step = "Atualização cancelada pelo usuário".to_string();
        }
    }
    (StatusCode::OK, Json(serde_json::json!({
        "id": id,
        "status": "cancelled",
        "message": "Cancelamento solicitado"
    }))).into_response()
}

pub async fn cancel_all_container_updates() -> impl IntoResponse {
    if let Ok(tokens) = UPDATE_TASK_TOKENS.read() {
        for token in tokens.values() {
            token.cancel();
        }
    }
    if let Ok(mut tasks) = CONTAINER_UPDATE_TASKS.write() {
        for task in tasks.values_mut() {
            if task.status == "pulling" || task.status == "recreating" {
                task.status = "cancelled".to_string();
                task.step = "Cancelamento solicitado pelo usuário".to_string();
            }
        }
    }
    (StatusCode::OK, Json(serde_json::json!({
        "status": "cancelled",
        "message": "Todas as atualizações ativas foram canceladas"
    }))).into_response()
}

pub async fn get_container_update_status(
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Ok(tasks) = CONTAINER_UPDATE_TASKS.read() {
        if let Some(task) = tasks.get(&id) {
            return (StatusCode::OK, Json(serde_json::to_value(task).unwrap_or_default())).into_response();
        }
    }

    (StatusCode::OK, Json(serde_json::json!({
        "id": id,
        "status": "idle",
        "step": "Nenhuma atualização ativa",
        "error": null,
        "details": null
    }))).into_response()
}
