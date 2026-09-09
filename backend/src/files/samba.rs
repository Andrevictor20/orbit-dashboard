use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde::{Deserialize, Serialize};
use std::path::Path as FsPath;
use crate::state::AppState;
use crate::files::path_utils::sanitize_path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SambaShare {
    pub name: String,
    pub path: String,
    pub read_only: bool,
    pub guest_ok: bool,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SambaConfig {
    pub enabled: bool,
    pub workgroup: String,
    pub server_string: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub shares: Vec<SambaShare>,
}

impl Default for SambaConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            workgroup: "WORKGROUP".to_string(),
            server_string: "Orbit Homelab Storage".to_string(),
            username: Some("orbit".to_string()),
            password: Some("orbit".to_string()),
            shares: vec![
                SambaShare {
                    name: "public".to_string(),
                    path: "/DATA".to_string(),
                    read_only: false,
                    guest_ok: true,
                    comment: Some("Orbit Shared Storage".to_string()),
                }
            ],
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SambaStatus {
    pub running: bool,
    pub enabled: bool,
    pub lan_ip: String,
    pub active_shares: usize,
    pub smb_url_windows: String,
    pub smb_url_mac: String,
    pub workgroup: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateSharePayload {
    pub name: String,
    pub path: String,
    pub read_only: Option<bool>,
    pub guest_ok: Option<bool>,
    pub comment: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ToggleSambaPayload {
    pub enabled: bool,
}

fn get_samba_config_path() -> std::path::PathBuf {
    if FsPath::new("/data").is_dir() {
        std::path::PathBuf::from("/data/config/samba.json")
    } else {
        std::path::PathBuf::from("data/config/samba.json")
    }
}

fn load_samba_config() -> SambaConfig {
    let path = get_samba_config_path();
    if let Ok(content) = std::fs::read_to_string(&path) {
        if let Ok(config) = serde_json::from_str::<SambaConfig>(&content) {
            return config;
        }
    }
    SambaConfig::default()
}

fn save_samba_config(config: &SambaConfig) -> Result<(), std::io::Error> {
    let path = get_samba_config_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(config)?;
    std::fs::write(&path, json)
}

fn detect_lan_ip() -> String {
    // Attempt to detect primary IP or fallback
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                return addr.ip().to_string();
            }
        }
    }
    "127.0.0.1".to_string()
}

pub async fn get_samba_status(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let config = load_samba_config();
    let lan_ip = detect_lan_ip();

    // Check if orbit-samba container is running
    let mut running = false;
    if let Ok(inspect) = state.docker.inspect_container("orbit-samba", None).await {
        running = inspect.state.and_then(|s| s.running).unwrap_or(false);
    }

    let status = SambaStatus {
        running: running || config.enabled,
        enabled: config.enabled,
        lan_ip: lan_ip.clone(),
        active_shares: config.shares.len(),
        smb_url_windows: format!("\\\\{}", lan_ip),
        smb_url_mac: format!("smb://{}", lan_ip),
        workgroup: config.workgroup,
    };

    Ok(Json(status))
}

pub async fn list_samba_shares() -> Result<impl IntoResponse, (StatusCode, String)> {
    let config = load_samba_config();
    Ok(Json(config.shares))
}

pub async fn create_samba_share(
    State(state): State<AppState>,
    Json(payload): Json<CreateSharePayload>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let clean_name: String = payload
        .name
        .trim()
        .to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect();
    if clean_name.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Nome do compartilhamento inválido".to_string()));
    }

    let target_path = sanitize_path(&payload.path)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Caminho de pasta inválido".to_string()))?;

    let mut config = load_samba_config();

    // Check if share already exists and update or append
    let share = SambaShare {
        name: clean_name.clone(),
        path: target_path.to_string_lossy().to_string(),
        read_only: payload.read_only.unwrap_or(false),
        guest_ok: payload.guest_ok.unwrap_or(true),
        comment: payload.comment,
    };

    if let Some(pos) = config.shares.iter().position(|s| s.name == clean_name) {
        config.shares[pos] = share;
    } else {
        config.shares.push(share);
    }

    save_samba_config(&config)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // If enabled, apply container update in background
    if config.enabled {
        let docker = state.docker.clone();
        tokio::spawn(async move {
            let _ = apply_samba_container(&docker).await;
        });
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Compartilhamento '{}' salvo com sucesso", clean_name),
        "smb_path_windows": format!("\\\\{}\\{}", detect_lan_ip(), clean_name),
        "smb_path_mac": format!("smb://{}/{}", detect_lan_ip(), clean_name),
    })))
}

pub async fn delete_samba_share(
    Path(name): Path<String>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut config = load_samba_config();
    let initial_len = config.shares.len();
    config.shares.retain(|s| s.name != name);

    if config.shares.len() == initial_len {
        return Err((StatusCode::NOT_FOUND, "Compartilhamento não encontrado".to_string()));
    }

    save_samba_config(&config)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if config.enabled {
        let docker = state.docker.clone();
        tokio::spawn(async move {
            let _ = apply_samba_container(&docker).await;
        });
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn toggle_samba_service(
    State(state): State<AppState>,
    Json(payload): Json<ToggleSambaPayload>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut config = load_samba_config();
    config.enabled = payload.enabled;

    save_samba_config(&config)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let docker = state.docker.clone();
    tokio::spawn(async move {
        if payload.enabled {
            let _ = apply_samba_container(&docker).await;
        } else {
            let _ = docker.stop_container("orbit-samba", None).await;
        }
    });

    Ok(Json(serde_json::json!({
        "success": true,
        "enabled": payload.enabled,
        "message": if payload.enabled { "Serviço Samba ativado" } else { "Serviço Samba desativado" }
    })))
}

async fn apply_samba_container(docker: &bollard::Docker) -> Result<(), bollard::errors::Error> {
    // Graceful inspection and lifecycle management for orbit-samba container
    let config = load_samba_config();
    if !config.enabled {
        return Ok(());
    }

    // Try inspecting if container exists
    if let Ok(inspect) = docker.inspect_container("orbit-samba", None).await {
        if inspect.state.and_then(|s| s.running).unwrap_or(false) {
            // Container is already running
            return Ok(());
        }
        // Try starting it
        let _ = docker.start_container("orbit-samba", None::<bollard::query_parameters::StartContainerOptions>).await;
    }

    Ok(())
}
