use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::RwLock;
use std::time::{Duration, Instant};
use once_cell::sync::Lazy;
use crate::state::AppState;
use crate::docker::get_host_platform;
use futures::StreamExt;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SystemUpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub platform: String,
    pub arch: String,
    pub release_name: String,
    pub release_notes: String,
    pub published_at: Option<String>,
    #[serde(default)]
    pub ci_status: Option<String>, // "building" | "ready" | "failed" | null
    #[serde(default)]
    pub ci_workflow_url: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SystemUpdateTask {
    pub status: String,        // "idle" | "pulling" | "recreating" | "done" | "error"
    pub progress: u8,          // 0-100
    pub current_step: String,
    pub logs: Vec<String>,
    pub error: Option<String>,
}

pub static UPDATE_CACHE: Lazy<RwLock<Option<(SystemUpdateInfo, Instant)>>> = Lazy::new(|| RwLock::new(None));
const CACHE_TTL: Duration = Duration::from_secs(30); // 30 seconds cache for responsive CI status

static SYSTEM_UPDATE_TASK: Lazy<RwLock<SystemUpdateTask>> = Lazy::new(|| RwLock::new(SystemUpdateTask {
    status: "idle".to_string(),
    progress: 0,
    current_step: "".to_string(),
    logs: Vec::new(),
    error: None,
}));

pub fn get_app_version() -> String {
    std::env::var("APP_VERSION")
        .or_else(|_| std::env::var("ORBIT_VERSION"))
        .unwrap_or_else(|_| env!("CARGO_PKG_VERSION").to_string())
}

pub async fn check_ghcr_image_manifest(client: &reqwest::Client, tag: &str) -> bool {
    let clean_tag = tag.trim_start_matches('v');
    let tags_to_check = [format!("v{}", clean_tag), clean_tag.to_string()];

    // Get anonymous token for ghcr.io
    let token_url = "https://ghcr.io/token?service=ghcr.io&scope=repository:andrevictor20/orbit-dashboard:pull";
    let token = match client.get(token_url).send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                json.get("token").and_then(|t| t.as_str()).map(|s| s.to_string())
            } else {
                None
            }
        }
        _ => None,
    };

    let accept_header = "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json";

    for t in &tags_to_check {
        let manifest_url = format!("https://ghcr.io/v2/andrevictor20/orbit-dashboard/manifests/{}", t);
        let mut req = client.head(&manifest_url).header("Accept", accept_header);
        if let Some(ref tok) = token {
            req = req.header("Authorization", format!("Bearer {}", tok));
        }

        if let Ok(resp) = req.send().await {
            if resp.status().is_success() {
                return true;
            }
        }
    }

    false
}

pub async fn get_system_update_info() -> SystemUpdateInfo {
    // Check cache
    if let Ok(guard) = UPDATE_CACHE.read() {
        if let Some((ref info, instant)) = *guard {
            if instant.elapsed() < CACHE_TTL {
                return info.clone();
            }
        }
    }

    let current_version = get_app_version();
    let platform = get_host_platform().to_string();
    let arch = std::env::consts::ARCH.to_string();

    const DEFAULT_RELEASE_NOTES: &str = "# Orbit Dashboard\n\n### ✨ Novidades\n- **Painel Geral Modernizado:** Novo visual com monitoramento em tempo real e lançador de aplicativos com busca instantânea.\n- **Analisador de Espaço em Disco:** Nova aba para descobrir facilmente o que mais consome espaço no armazenamento e atalhos para examinar qualquer pasta.\n- **Gerenciador de Arquivos & Loja de Aplicativos:** Visual remodelado, navegação mais ágil e organizada.\n\n### ⚡ Desempenho\n- **Sistema Muito Mais Rápido:** Redução drástica no uso de processador (CPU) e memória em segundo plano.\n- **Rolagem e Animações Suaves:** Interface fluida a 60 FPS sem travamentos ou engasgos.\n\n### 🛠️ Correções\n- **Reconhecimento de HDs e Armazenamento:** Identificação correta de HDs externos e cartões de memória.\n- **Estabilidade Geral:** Fim de travamentos durante análises de disco e melhorias de segurança.\n";

    let mut latest_version = current_version.clone();
    let mut release_name = format!("Orbit Dashboard v{}", current_version);
    
    // Check local filesystem first
    let mut release_notes = std::fs::read_to_string("/app/LATEST_RELEASE.md")
        .or_else(|_| std::fs::read_to_string("LATEST_RELEASE.md"))
        .or_else(|_| std::fs::read_to_string("../LATEST_RELEASE.md"))
        .unwrap_or_else(|_| DEFAULT_RELEASE_NOTES.to_string());

    let mut published_at = None;
    let mut has_update = false;
    let mut ci_status = None;
    let mut ci_workflow_url = None;

    // Fetch from GitHub Releases API with robust timeout
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .user_agent("Orbit-Dashboard")
        .build();

    if let Ok(client) = client {
        // 1. Try fetching latest curated human-friendly release notes from GitHub main branch
        let raw_notes_url = "https://raw.githubusercontent.com/Andrevictor20/orbit-dashboard/main/LATEST_RELEASE.md";
        if let Ok(resp) = client.get(raw_notes_url).send().await {
            if resp.status().is_success() {
                if let Ok(text) = resp.text().await {
                    if !text.trim().is_empty() {
                        release_notes = text;
                    }
                }
            }
        }

        // 2. Try releases/latest for tag version and release metadata
        let release_url = "https://api.github.com/repos/Andrevictor20/orbit-dashboard/releases/latest";
        if let Ok(resp) = client.get(release_url).send().await {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(tag) = json.get("tag_name").and_then(|v| v.as_str()) {
                        let clean_tag = tag.trim_start_matches('v');
                        latest_version = clean_tag.to_string();
                        if let Some(name) = json.get("name").and_then(|v| v.as_str()) {
                            release_name = name.to_string();
                        }
                        if let Some(pub_at) = json.get("published_at").and_then(|v| v.as_str()) {
                            published_at = Some(pub_at.to_string());
                        }

                        if clean_tag != current_version {
                            has_update = true;
                        }
                    }
                }
            }
        }

        // 3. Inspect GitHub Container Registry (GHCR) and GitHub Actions runs
        if has_update {
            // First: Verify directly if the multi-arch image for latest_version is already published on GHCR
            let image_ready_on_ghcr = check_ghcr_image_manifest(&client, &latest_version).await;

            // Second: Fetch CD workflow status from GitHub Actions API
            let cd_actions_url = "https://api.github.com/repos/Andrevictor20/orbit-dashboard/actions/workflows/cd.yml/runs?branch=main&per_page=1";
            let mut latest_cd_run = None;
            if let Ok(resp) = client.get(cd_actions_url).send().await {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(runs) = json.get("workflow_runs").and_then(|v| v.as_array()) {
                            latest_cd_run = runs.first().cloned();
                        }
                    }
                }
            }

            // Fallback to general workflow runs if cd.yml runs query was empty
            if latest_cd_run.is_none() {
                let general_actions_url = "https://api.github.com/repos/Andrevictor20/orbit-dashboard/actions/runs?branch=main&per_page=3";
                if let Ok(resp) = client.get(general_actions_url).send().await {
                    if resp.status().is_success() {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            if let Some(runs) = json.get("workflow_runs").and_then(|v| v.as_array()) {
                                latest_cd_run = runs.first().cloned();
                            }
                        }
                    }
                }
            }

            if let Some(run) = latest_cd_run {
                let status = run.get("status").and_then(|v| v.as_str()).unwrap_or("");
                let conclusion = run.get("conclusion").and_then(|v| v.as_str());
                ci_workflow_url = run.get("html_url").and_then(|v| v.as_str()).map(|s| s.to_string());

                if image_ready_on_ghcr {
                    ci_status = Some("ready".to_string());
                } else if status == "in_progress" || status == "queued" {
                    ci_status = Some("building".to_string());
                } else if conclusion == Some("failure") || conclusion == Some("timed_out") {
                    ci_status = Some("failed".to_string());
                } else {
                    // Image not in GHCR yet: CD is still starting or compiling
                    ci_status = Some("building".to_string());
                }
            } else if image_ready_on_ghcr {
                ci_status = Some("ready".to_string());
            } else {
                ci_status = Some("building".to_string());
            }
        }
    }

    let info = SystemUpdateInfo {
        current_version,
        latest_version,
        has_update,
        platform,
        arch,
        release_name,
        release_notes,
        published_at,
        ci_status,
        ci_workflow_url,
    };

    // Store in cache
    let mut guard = match UPDATE_CACHE.write() {
        Ok(g) => g,
        Err(p) => p.into_inner(),
    };
    *guard = Some((info.clone(), Instant::now()));

    info
}

#[derive(Deserialize, Debug, Default)]
pub struct CheckUpdateParams {
    pub force: Option<bool>,
}

pub async fn check_update_handler(
    Query(params): Query<CheckUpdateParams>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    if params.force.unwrap_or(false) {
        if let Ok(mut guard) = UPDATE_CACHE.write() {
            *guard = None;
        }
    }

    let mut info = get_system_update_info().await;

    // Check remote registry digest on ghcr.io
    let image_name = "ghcr.io/andrevictor20/orbit-dashboard:latest";
    let image_has_update = crate::docker::containers::check_single_image_update(&state.docker, image_name).await;
    if image_has_update {
        info.has_update = true;
    }

    (StatusCode::OK, Json(info)).into_response()
}

pub async fn get_update_status_handler() -> impl IntoResponse {
    let task = match SYSTEM_UPDATE_TASK.read() {
        Ok(g) => g.clone(),
        Err(p) => p.into_inner().clone(),
    };
    (StatusCode::OK, Json(task)).into_response()
}

fn append_task_log(msg: impl Into<String>, progress: Option<u8>, step: Option<&str>) {
    let mut task = match SYSTEM_UPDATE_TASK.write() {
        Ok(g) => g,
        Err(p) => p.into_inner(),
    };
    let msg_str = msg.into();
    tracing::info!("[SystemUpdate] {}", msg_str);
    task.logs.push(msg_str);
    if let Some(p) = progress {
        task.progress = p;
    }
    if let Some(s) = step {
        task.current_step = s.to_string();
    }
}

pub async fn perform_system_update(State(state): State<AppState>) -> impl IntoResponse {
    // Check if task is already running
    {
        let task = match SYSTEM_UPDATE_TASK.read() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        if task.status == "pulling" || task.status == "recreating" {
            return (StatusCode::CONFLICT, Json(serde_json::json!({
                "message": "Uma atualização já está em andamento."
            }))).into_response();
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
        ).into_response();
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
                "🚀 [INFO] Iniciando atualização transparente do Orbit Dashboard...".to_string(),
            ],
            error: None,
        };
    }

    let docker = state.docker.clone();

    // Spawn background worker
    tokio::spawn(async move {
        let platform = get_host_platform();
        let image_name = "ghcr.io/andrevictor20/orbit-dashboard:latest";

        append_task_log(format!("ℹ️ [INFO] Plataforma de destino confirmada: {}", platform), Some(10), Some("Baixando imagem multi-arch..."));

        // 1. Pull the new multi-arch image specifying platform
        let create_options = bollard::query_parameters::CreateImageOptions {
            from_image: Some(image_name.to_string()),
            platform: platform.to_string(),
            ..Default::default()
        };

        append_task_log(format!("📥 [PULL] Conectando ao GitHub Container Registry ({})", image_name), Some(15), None);

        let mut pull_stream = docker.create_image(Some(create_options), None, None);
        let mut pull_progress = 15u8;
        let mut last_status = String::new();
        let mut had_error = false;

        while let Some(res) = pull_stream.next().await {
            match res {
                Ok(info) => {
                    let status = info.status.unwrap_or_default();
                    let id = info.id.unwrap_or_default();
                    let progress_detail = if let Some(ref p) = info.progress_detail {
                        if let (Some(cur), Some(tot)) = (p.current, p.total) {
                            if tot > 0 {
                                format!("({:.1} MB / {:.1} MB)", cur as f64 / (1024.0 * 1024.0), tot as f64 / (1024.0 * 1024.0))
                            } else {
                                String::new()
                            }
                        } else {
                            String::new()
                        }
                    } else {
                        String::new()
                    };

                    if !status.is_empty() && (status != last_status || !progress_detail.is_empty()) {
                        let log_line = if !id.is_empty() {
                            format!("   ↳ [{}] {} {}", id, status, progress_detail)
                        } else {
                            format!("   ↳ {} {}", status, progress_detail)
                        };

                        if status.contains("Download complete") || status.contains("Pull complete") || status.contains("Already exists") {
                            pull_progress = (pull_progress + 5).min(80);
                            append_task_log(log_line, Some(pull_progress), None);
                        } else if status != last_status {
                            append_task_log(log_line, None, None);
                        }
                        last_status = status;
                    }
                }
                Err(e) => {
                    had_error = true;
                    append_task_log(format!("⚠️ [WARN] Aviso no pull da imagem: {}", e), None, None);
                }
            }
        }

        if had_error && pull_progress <= 15 {
            let mut task = match SYSTEM_UPDATE_TASK.write() {
                Ok(g) => g,
                Err(p) => p.into_inner(),
            };
            task.status = "error".to_string();
            task.error = Some("Não foi possível baixar a imagem do GitHub Container Registry.".to_string());
            task.logs.push("❌ [ERROR] Falha durante o download da nova imagem.".to_string());
            return;
        }

        append_task_log("✅ [SUCCESS] Imagem multi-arch baixada e verificada com sucesso!", Some(85), Some("Preparando reinicialização sem downtime..."));

        // 2. Discover host compose directory and compose file name
        let mut host_compose_dir = None;
        let mut compose_file_name = "docker-compose.yml".to_string();

        // 2.1 First attempt: inspect container 'orbit-dashboard' via Docker API to read Docker Compose labels
        // NOTE: container_name in docker-compose.yml is 'orbit-dashboard', not 'orbit'.
        // 'orbit' is only the compose project/service name — the actual running container is 'orbit-dashboard'.
        let container_names = ["orbit-dashboard", "orbit"];
        let mut inspect_result = None;
        for cname in &container_names {
            if let Ok(ins) = docker.inspect_container(cname, None::<bollard::query_parameters::InspectContainerOptions>).await {
                inspect_result = Some(ins);
                break;
            }
        }
        if let Some(inspect) = inspect_result {
            if let Some(labels) = inspect.config.and_then(|c| c.labels) {
                if let Some(work_dir) = labels.get("com.docker.compose.project.working_dir") {
                    if !work_dir.trim().is_empty() {
                        host_compose_dir = Some(work_dir.clone());
                    }
                }
                if let Some(cfg_files) = labels.get("com.docker.compose.project.config_files") {
                    if let Some(first_file) = cfg_files.split(',').next() {
                        let p = std::path::Path::new(first_file.trim());
                        if let Some(fname) = p.file_name() {
                            compose_file_name = fname.to_string_lossy().to_string();
                        }
                    }
                }
            }
        }

        // 2.2 Second attempt: Scan common host paths if not discovered via Docker Compose labels
        if host_compose_dir.is_none() {
            let candidate_bases = [
                "/host/DATA/orbit",
                "/host/data/orbit",
                "/host/root/orbit",
                "/host/opt/orbit",
                "/host/srv/orbit",
            ];
            for base in candidate_bases {
                if std::path::Path::new(base).join(&compose_file_name).exists() {
                    let cleaned = base.strip_prefix("/host").unwrap_or(base).to_string();
                    host_compose_dir = Some(cleaned);
                    break;
                }
            }

            if host_compose_dir.is_none() {
                if let Ok(entries) = std::fs::read_dir("/host/home") {
                    for entry in entries.flatten() {
                        let orbit_path = entry.path().join("orbit");
                        if orbit_path.join(&compose_file_name).exists() {
                            let host_str = orbit_path.to_string_lossy();
                            let cleaned = host_str.strip_prefix("/host").unwrap_or(&host_str).to_string();
                            host_compose_dir = Some(cleaned);
                            break;
                        }
                    }
                }
            }
        }

        if let Some(ref d) = host_compose_dir {
            append_task_log(format!("📁 [CONFIG] Diretório Compose detectado: {} (arquivo: {})", d, compose_file_name), Some(90), None);
        } else {
            append_task_log("📁 [CONFIG] Nenhum compose detectado, fallback para recriação direta via Docker Engine.", Some(90), None);
        }

        // 3. Mark state as recreating
        {
            let mut task = match SYSTEM_UPDATE_TASK.write() {
                Ok(g) => g,
                Err(p) => p.into_inner(),
            };
            task.status = "recreating".to_string();
            task.progress = 95;
            task.current_step = "Reiniciando serviço Orbit com a nova versão...".to_string();
            task.logs.push("⚙️ [RESTART] Aplicando nova imagem ao contêiner em segundo plano...".to_string());
            task.logs.push("🔄 [RESTART] Aguarde enquanto o novo contêiner inicializa...".to_string());
        }

        // Invalidate cache
        if let Ok(mut guard) = UPDATE_CACHE.write() {
            *guard = None;
        }

        // 4. Trigger compose / container recreation via an independent detached helper container.
        // Wait 1.5s so the HTTP response is safely flushed and delivered to the web browser.
        tokio::time::sleep(Duration::from_millis(1500)).await;

        let host_dir_val = host_compose_dir.unwrap_or_default();

        let helper_script = format!(
            r#"sleep 1 && (
if [ -n "{host_dir}" ] && [ -f "/host{host_dir}/{compose_file}" ]; then
  cd "/host{host_dir}" && docker compose -f "{compose_file}" pull && docker compose -f "{compose_file}" up -d --force-recreate
elif [ -f "/host/DATA/orbit/docker-compose.yml" ]; then
  cd "/host/DATA/orbit" && docker compose pull && docker compose up -d --force-recreate
elif [ -f "/host/root/orbit/docker-compose.yml" ]; then
  cd "/host/root/orbit" && docker compose pull && docker compose up -d --force-recreate
else
  docker stop orbit-dashboard 2>/dev/null || true
  docker rm orbit-dashboard 2>/dev/null || true
  docker run -d --name orbit-dashboard --restart unless-stopped \
    --privileged \
    --pid host \
    --add-host host.docker.internal:host-gateway \
    -p 5172:5172 \
    -p 5173:5172 \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v orbit_data:/app/data \
    -v /:/host:rslave \
    -v /mnt:/mnt:rslave \
    -v /media:/media:rslave \
    -e RUST_LOG=info \
    -e SSH_HOST=host.docker.internal \
    "{image_name}"
fi
)"#,
            host_dir = host_dir_val,
            compose_file = compose_file_name,
            image_name = image_name
        );

        // Spawn a detached transient updater container using the newly pulled image (already present locally!)
        let _ = tokio::process::Command::new("docker")
            .args([
                "run",
                "--rm",
                "-d",
                "-v", "/var/run/docker.sock:/var/run/docker.sock",
                "-v", "/:/host",
                image_name,
                "sh", "-c",
                &helper_script,
            ])
            .output()
            .await;
    });

    (StatusCode::OK, Json(serde_json::json!({
        "message": "Atualização iniciada com sucesso",
        "status": "pulling"
    }))).into_response()
}

pub async fn get_system_version_handler() -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "version": get_app_version(),
            "platform": get_host_platform(),
            "arch": std::env::consts::ARCH
        }))
    ).into_response()
}

pub mod processes;
pub mod alerts;

pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/system/version", axum::routing::get(get_system_version_handler))
        .route("/api/system/update/check", axum::routing::get(check_update_handler))
        .route("/api/system/update/status", axum::routing::get(get_update_status_handler))
        .route("/api/system/update", axum::routing::post(perform_system_update))
        .route("/api/system/processes", axum::routing::get(processes::get_processes_handler))
        .route("/api/system/processes/{pid}/kill", axum::routing::post(processes::kill_process_handler))
        .route("/api/system/alerts", axum::routing::get(alerts::get_alerts_handler))
}
