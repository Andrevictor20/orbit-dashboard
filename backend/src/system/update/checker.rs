use axum::{
    extract::Query,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

use crate::docker::get_host_platform;
use super::{CACHE_TTL, UPDATE_CACHE};

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

#[derive(Deserialize, Debug, Default)]
pub struct CheckUpdateParams {
    pub force: Option<bool>,
}

pub fn is_newer_version(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> (u64, u64, u64) {
        let clean = v.trim_start_matches('v').trim();
        let parts: Vec<&str> = clean.split('.').collect();
        let major = parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
        let minor = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
        let patch = parts
            .get(2)
            .and_then(|s| s.split('-').next().unwrap_or("0").parse().ok())
            .unwrap_or(0);
        (major, minor, patch)
    };
    parse(latest) > parse(current)
}

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
                json.get("token")
                    .and_then(|t| t.as_str())
                    .map(|s| s.to_string())
            } else {
                None
            }
        }
        _ => None,
    };

    let accept_header = "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json";

    for t in &tags_to_check {
        let manifest_url = format!(
            "https://ghcr.io/v2/andrevictor20/orbit-dashboard/manifests/{}",
            t
        );
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
    // Check cache in isolated block so RwLockReadGuard is dropped before any .await
    {
        let guard = match UPDATE_CACHE.read() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
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
        let release_url =
            "https://api.github.com/repos/Andrevictor20/orbit-dashboard/releases/latest";
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

                        if is_newer_version(clean_tag, &current_version) {
                            has_update = true;
                        } else {
                            has_update = false;
                        }
                    }
                }
            }
        }

        // 3. Inspect GitHub Container Registry (GHCR) and GitHub Actions runs
        if has_update {
            let image_ready_on_ghcr = check_ghcr_image_manifest(&client, &latest_version).await;

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
                ci_workflow_url = run
                    .get("html_url")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                if image_ready_on_ghcr {
                    ci_status = Some("ready".to_string());
                } else if status == "in_progress" || status == "queued" {
                    ci_status = Some("building".to_string());
                } else if conclusion == Some("failure") || conclusion == Some("timed_out") {
                    ci_status = Some("failed".to_string());
                } else {
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

    let mut guard = match UPDATE_CACHE.write() {
        Ok(g) => g,
        Err(p) => p.into_inner(),
    };
    *guard = Some((info.clone(), Instant::now()));

    info
}

pub async fn check_update_handler(
    Query(params): Query<CheckUpdateParams>,
) -> (StatusCode, Json<SystemUpdateInfo>) {
    if params.force.unwrap_or(false) {
        let mut guard = match UPDATE_CACHE.write() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        *guard = None;
    }

    let mut info = get_system_update_info().await;
    info.has_update = is_newer_version(&info.latest_version, &info.current_version);

    (StatusCode::OK, Json(info))
}
