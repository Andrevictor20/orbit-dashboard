use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use futures::StreamExt;
use std::time::Duration;

use crate::docker::get_host_platform;
use crate::state::AppState;
use super::checker::{get_app_version, get_system_update_info};
use super::{append_task_log, SystemUpdateTask, SYSTEM_UPDATE_TASK, UPDATE_CACHE};
use super::detector::{discover_compose_context, find_active_saturn_container};
use super::script_generator::{generate_helper_script, HelperScriptParams};

#[derive(serde::Deserialize, Default, Debug)]
pub struct UpdateQuery {
    pub version: Option<String>,
}

pub async fn perform_system_update(
    State(state): State<AppState>,
    Query(query): Query<UpdateQuery>,
) -> impl IntoResponse {
    // Check if task is already running
    {
        let task = match SYSTEM_UPDATE_TASK.read() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        if task.status == "pulling" || task.status == "recreating" {
            return (
                StatusCode::CONFLICT,
                Json(serde_json::json!({
                    "message": "Uma atualização já está em andamento."
                })),
            )
                .into_response();
        }
    }

    // Safety Gate: Block update if new multi-arch image is still compiling in GitHub Actions
    let update_info = get_system_update_info().await;
    if update_info.has_update && update_info.ci_status.as_deref() == Some("building") {
        return (
            StatusCode::PRECONDITION_FAILED,
            Json(serde_json::json!({
                "message": "A imagem da nova versão ainda está sendo compilada e empacotada no GitHub Actions. Aguarde alguns instantes até a conclusão do processo.",
                "error": "Imagem multi-arch ainda em compilação no GitHub Actions."
            })),
        )
            .into_response();
    }

    // Reset task state
    {
        let mut task = match SYSTEM_UPDATE_TASK.write() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        *task = SystemUpdateTask {
            status: "pulling".to_string(),
            progress: 5,
            current_step: "Iniciando verificação e download...".to_string(),
            logs: vec![
                "🚀 [INFO] Iniciando atualização transparente do Saturn Dashboard...".to_string(),
            ],
            error: None,
        };
    }

    let docker = state.docker.clone();
    let target_version_param = query.version.clone();

    // Spawn background worker
    tokio::spawn(async move {
        let platform = get_host_platform();
        let detected_container = find_active_saturn_container(&docker).await;
        let mut image_name = detected_container.image_name;
        let current_container_id = detected_container.id;
        let current_container_name = detected_container.name;
        let inspect_result = detected_container.inspect;

        if let Some(ver) = target_version_param.as_deref() {
            let clean_ver = ver.trim().trim_start_matches('v');
            if !clean_ver.is_empty() && image_name.ends_with(":latest") {
                let base = image_name.trim_end_matches(":latest");
                image_name = format!("{}:v{}", base, clean_ver);
            }
        }

        append_task_log(
            format!("ℹ️ [INFO] Plataforma de destino confirmada: {}", platform),
            Some(10),
            Some("Baixando imagem multi-arch..."),
        );

        // 1. Pull the new multi-arch image specifying platform
        let create_options = bollard::query_parameters::CreateImageOptions {
            from_image: Some(image_name.clone()),
            platform: platform.to_string(),
            ..Default::default()
        };

        append_task_log(
            format!("📥 [PULL] Conectando ao Registry ({})", image_name),
            Some(15),
            None,
        );

        let mut pull_stream = docker.create_image(Some(create_options), None, None);
        let mut pull_progress = 15u8;
        let mut last_status = String::new();
        let mut had_error = false;
        let mut consecutive_timeouts = 0;

        loop {
            let next_chunk = tokio::time::timeout(Duration::from_secs(45), pull_stream.next()).await;
            match next_chunk {
                Ok(Some(Ok(info))) => {
                    consecutive_timeouts = 0;
                    let status = info.status.unwrap_or_default();
                    let id = info.id.unwrap_or_default();
                    let progress_detail = if let Some(ref p) = info.progress_detail {
                        if let (Some(cur), Some(tot)) = (p.current, p.total) {
                            if tot > 0 {
                                format!(
                                    "({:.1} MB / {:.1} MB)",
                                    cur as f64 / (1024.0 * 1024.0),
                                    tot as f64 / (1024.0 * 1024.0)
                                )
                            } else {
                                String::new()
                            }
                        } else {
                            String::new()
                        }
                    } else {
                        String::new()
                    };

                    if !status.is_empty()
                        && (status != last_status || !progress_detail.is_empty())
                    {
                        let log_line = if !id.is_empty() {
                            format!("   ↳ [{}] {} {}", id, status, progress_detail)
                        } else {
                            format!("   ↳ {} {}", status, progress_detail)
                        };

                        if status.contains("Download complete")
                            || status.contains("Pull complete")
                            || status.contains("Already exists")
                        {
                            pull_progress = (pull_progress + 5).min(80);
                            append_task_log(log_line, Some(pull_progress), None);
                        } else if status != last_status {
                            append_task_log(log_line, None, None);
                        }
                        last_status = status;
                    }
                }
                Ok(Some(Err(e))) => {
                    had_error = true;
                    append_task_log(
                        format!("⚠️ [WARN] Aviso no pull da imagem: {}", e),
                        None,
                        None,
                    );
                }
                Ok(None) => {
                    break;
                }
                Err(_) => {
                    consecutive_timeouts += 1;
                    if consecutive_timeouts >= 4 {
                        had_error = true;
                        append_task_log(
                            "⚠️ [WARN] Timeout de 180s ao aguardar stream do Container Registry. Prosseguindo com fallback...".to_string(),
                            None,
                            None,
                        );
                        break;
                    }
                }
            }
        }

        if had_error && pull_progress <= 15 {
            let mut task = match SYSTEM_UPDATE_TASK.write() {
                Ok(g) => g,
                Err(p) => p.into_inner(),
            };
            task.status = "error".to_string();
            task.error = Some(
                "Não foi possível baixar a imagem do Container Registry. Verifique a conexão com o registro.".to_string(),
            );
            task.logs
                .push("❌ [ERROR] Falha durante o download da nova imagem.".to_string());
            return;
        }

        append_task_log(
            "✅ [SUCCESS] Imagem multi-arch baixada e verificada com sucesso!",
            Some(85),
            Some("Preparando reinicialização sem downtime..."),
        );

        // 2. Discover host compose directory, compose project and active data mount
        let compose_ctx = discover_compose_context(inspect_result.as_ref());
        let host_compose_dir = compose_ctx.host_compose_dir;
        let compose_file_name = compose_ctx.compose_file_name;
        let compose_project_name = compose_ctx.compose_project_name;
        let detected_data_mount = compose_ctx.detected_data_mount;

        if let Some(ref d) = host_compose_dir {
            append_task_log(
                format!(
                    "📁 [CONFIG] Diretório Compose detectado: {} (arquivo: {})",
                    d, compose_file_name
                ),
                Some(90),
                None,
            );
        } else {
            append_task_log(
                format!(
                    "📁 [CONFIG] Fallback Docker Engine ativado (volume: {}).",
                    detected_data_mount
                ),
                Some(90),
                None,
            );
        }

        // 3. Mark state as recreating
        {
            let mut task = match SYSTEM_UPDATE_TASK.write() {
                Ok(g) => g,
                Err(p) => p.into_inner(),
            };
            task.status = "recreating".to_string();
            task.progress = 95;
            task.current_step = "Reiniciando serviço Saturn com a nova versão...".to_string();
            task.logs.push(
                "⚙️ [RESTART] Aplicando nova imagem ao contêiner em segundo plano...".to_string(),
            );
            task.logs.push(
                "🔄 [RESTART] Aguarde enquanto o novo contêiner inicializa...".to_string(),
            );
        }

        // Invalidate cache
        if let Ok(mut guard) = UPDATE_CACHE.write() {
            *guard = None;
        }

        // 4. Trigger compose / container recreation via an independent detached helper container ("saturn-updater").
        tokio::time::sleep(Duration::from_millis(400)).await;

        let host_dir_val = host_compose_dir.unwrap_or_default();
        let project_flag = compose_project_name
            .as_ref()
            .map(|p| format!("-p \"{}\"", p))
            .unwrap_or_default();

        let new_container_name = match current_container_name.as_deref() {
            Some(name)
                if name.eq_ignore_ascii_case("saturn")
                    || name == "saturn-dashboard"
                     =>
            {
                name.to_string()
            }
            Some(name)
                if !name.is_empty() && !name.contains('_') && !name.ends_with("-1") =>
            {
                name.to_string()
            }
            _ => "saturn".to_string(),
        };
        let current_id_val = current_container_id.unwrap_or_default();
        let current_name_val = current_container_name.unwrap_or_default();

        let helper_script = generate_helper_script(HelperScriptParams {
            host_dir: &host_dir_val,
            compose_file: &compose_file_name,
            project_flag: &project_flag,
            data_mount: &detected_data_mount,
            image_name: &image_name,
            current_id: &current_id_val,
            current_name: &current_name_val,
            new_container_name: &new_container_name,
        });

        append_task_log(
            "🐳 [UPDATER] Criando segundo contêiner independente ('saturn-updater') para orquestrar e monitorar a reinicialização...",
            Some(96),
            Some("saturn-updater ativo: aplicando nova imagem..."),
        );

        // Remove previous updater container if any residual exists
        let _ = docker
            .remove_container(
                "saturn-updater",
                Some(bollard::query_parameters::RemoveContainerOptions {
                    force: true,
                    ..Default::default()
                }),
            )
            .await;

        let host_config = bollard::models::HostConfig {
            privileged: Some(true),
            network_mode: Some("host".to_string()),
            binds: Some(vec![
                "/var/run/docker.sock:/var/run/docker.sock".to_string(),
                "/:/host:rslave".to_string(),
            ]),
            auto_remove: Some(false),
            ..Default::default()
        };

        let updater_body = bollard::models::ContainerCreateBody {
            image: Some(image_name.clone()),
            cmd: Some(vec![
                "sh".to_string(),
                "-c".to_string(),
                helper_script.clone(),
            ]),
            host_config: Some(host_config),
            ..Default::default()
        };

        let mut updater_started = false;
        match docker
            .create_container(
                Some(bollard::query_parameters::CreateContainerOptions {
                    name: Some("saturn-updater".to_string()),
                    ..Default::default()
                }),
                updater_body,
            )
            .await
        {
            Ok(c) => {
                if let Err(e) = docker
                    .start_container(
                        &c.id,
                        None::<bollard::query_parameters::StartContainerOptions>,
                    )
                    .await
                {
                    append_task_log(
                        format!("⚠️ [WARN] Falha ao iniciar saturn-updater via Docker API: {}. Tentando fallback...", e),
                        None,
                        None,
                    );
                } else {
                    append_task_log(
                        "⚙️ [UPDATER] Contêiner saturn-updater iniciado com sucesso! Aguarde a finalização...",
                        Some(98),
                        None,
                    );
                    updater_started = true;
                }
            }
            Err(e) => {
                append_task_log(
                    format!("⚠️ [WARN] Falha ao criar saturn-updater via Docker API: {}. Tentando fallback...", e),
                    None,
                    None,
                );
            }
        }

        if !updater_started {
            let _ = tokio::process::Command::new("docker")
                .args([
                    "run",
                    "--rm",
                    "-d",
                    "--name",
                    "saturn-updater",
                    "--privileged",
                    "--net=host",
                    "-v",
                    "/var/run/docker.sock:/var/run/docker.sock",
                    "-v",
                    "/:/host:rslave",
                    &image_name,
                    "sh",
                    "-c",
                    &helper_script,
                ])
                .output()
                .await;
        }
    });

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "message": "Atualização iniciada com sucesso",
            "status": "pulling"
        })),
    )
        .into_response()
}

pub async fn get_system_version_handler() -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "version": get_app_version(),
            "platform": get_host_platform(),
            "arch": std::env::consts::ARCH
        })),
    )
        .into_response()
}
