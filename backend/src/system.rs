use axum::{
    extract::State,
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
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SystemUpdateResponse {
    pub success: bool,
    pub message: String,
    pub platform: String,
    pub image: String,
}

static UPDATE_CACHE: Lazy<RwLock<Option<(SystemUpdateInfo, Instant)>>> = Lazy::new(|| RwLock::new(None));
const CACHE_TTL: Duration = Duration::from_secs(180); // 3 minutes cache

pub async fn get_system_update_info() -> SystemUpdateInfo {
    // Check cache
    if let Ok(guard) = UPDATE_CACHE.read() {
        if let Some((ref info, instant)) = *guard {
            if instant.elapsed() < CACHE_TTL {
                return info.clone();
            }
        }
    }

    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let platform = get_host_platform().to_string();
    let arch = std::env::consts::ARCH.to_string();

    let mut latest_version = current_version.clone();
    let mut release_name = format!("Orbit Dashboard v{}", current_version);
    let mut release_notes = "Versão atual instalada e atualizada.".to_string();
    let mut published_at = None;
    let mut has_update = false;

    // Fetch from GitHub Releases API
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .user_agent("Orbit-Dashboard")
        .build();

    if let Ok(client) = client {
        // 1. Try releases/latest
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
                        if let Some(body) = json.get("body").and_then(|v| v.as_str()) {
                            if !body.trim().is_empty() {
                                release_notes = body.to_string();
                            }
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

        // 2. If no release tag difference found, check latest commit message
        if !has_update {
            let commits_url = "https://api.github.com/repos/Andrevictor20/orbit-dashboard/commits/main";
            if let Ok(resp) = client.get(commits_url).send().await {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(commit) = json.get("commit") {
                            let message = commit.get("message").and_then(|v| v.as_str()).unwrap_or("");
                            let date = commit.get("committer").and_then(|c| c.get("date")).and_then(|d| d.as_str());
                            if let Some(d) = date {
                                published_at = Some(d.to_string());
                            }
                            if !message.is_empty() {
                                release_notes = format!("Últimas alterações no repositório:\n\n{}", message);
                                release_name = "Versão Mais Recente (GitHub Main)".to_string();
                            }
                        }
                    }
                }
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
    };

    // Store in cache
    if let Ok(mut guard) = UPDATE_CACHE.write() {
        *guard = Some((info.clone(), Instant::now()));
    }

    info
}

pub async fn check_update_handler(State(state): State<AppState>) -> impl IntoResponse {
    let mut info = get_system_update_info().await;

    // Also check remote registry for image updates if docker is available
    let image_name = "ghcr.io/andrevictor20/orbit-dashboard:latest";
    let image_has_update = crate::docker::containers::check_single_image_update(&state.docker, image_name).await;
    if image_has_update {
        info.has_update = true;
    }

    (StatusCode::OK, Json(info)).into_response()
}

pub async fn perform_system_update(State(state): State<AppState>) -> impl IntoResponse {
    let platform = get_host_platform();
    let image_name = "ghcr.io/andrevictor20/orbit-dashboard:latest";

    tracing::info!("Iniciando atualização completa do Orbit para plataforma {}", platform);

    // 1. Pull the new multi-arch image specifying platform
    let create_options = bollard::query_parameters::CreateImageOptions {
        from_image: Some(image_name.to_string()),
        platform: platform.to_string(),
        ..Default::default()
    };

    let mut pull_stream = state.docker.create_image(Some(create_options), None, None);
    while let Some(res) = pull_stream.next().await {
        if let Err(e) = res {
            tracing::warn!("Aviso no pull do Orbit: {}", e);
        }
    }

    // 2. Try docker compose in standard directories on host
    let mut compose_updated = false;
    let candidate_dirs = ["/host/root/orbit", "/host/home", "/app", "."];
    for base in candidate_dirs {
        let dir = if base == "/host/home" {
            // Find user dir
            if let Ok(entries) = std::fs::read_dir(base) {
                let user_orbit: Vec<_> = entries.flatten()
                    .map(|e| e.path().join("orbit"))
                    .filter(|p| p.join("docker-compose.yml").exists())
                    .collect();
                user_orbit.first().map(|p| p.to_string_lossy().to_string())
            } else {
                None
            }
        } else {
            let p = std::path::Path::new(base).join("docker-compose.yml");
            if p.exists() {
                Some(base.to_string())
            } else {
                None
            }
        };

        if let Some(d) = dir {
            let chroot_res = tokio::process::Command::new("chroot")
                .arg("/host")
                .arg("docker")
                .arg("compose")
                .arg("up")
                .arg("-d")
                .arg("--force-recreate")
                .output()
                .await;

            if let Ok(o) = chroot_res {
                if o.status.success() {
                    compose_updated = true;
                    break;
                }
            }

            let cmd_res = tokio::process::Command::new("docker")
                .arg("compose")
                .arg("up")
                .arg("-d")
                .arg("--force-recreate")
                .current_dir(&d)
                .output()
                .await;

            if let Ok(o) = cmd_res {
                if o.status.success() {
                    compose_updated = true;
                    break;
                }
            }
        }
    }

    // Invalidate cache
    if let Ok(mut guard) = UPDATE_CACHE.write() {
        *guard = None;
    }

    (StatusCode::OK, Json(SystemUpdateResponse {
        success: true,
        message: if compose_updated {
            "Orbit atualizado com sucesso via Docker Compose!".to_string()
        } else {
            format!("Imagem {} ({}) baixada com sucesso. O Orbit reiniciará com a nova versão.", image_name, platform)
        },
        platform: platform.to_string(),
        image: image_name.to_string(),
    })).into_response()
}

pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/system/update/check", axum::routing::get(check_update_handler))
        .route("/api/system/update", axum::routing::post(perform_system_update))
}
