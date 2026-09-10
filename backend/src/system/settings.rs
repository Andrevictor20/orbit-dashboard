use axum::{
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct IntegrationsSettings {
    #[serde(default = "default_true")]
    pub homeassistant: bool,
    #[serde(default = "default_true")]
    pub pihole: bool,
    #[serde(default = "default_true")]
    pub cloudflare: bool,
}

impl Default for IntegrationsSettings {
    fn default() -> Self {
        Self {
            homeassistant: true,
            pihole: true,
            cloudflare: true,
        }
    }
}

fn default_true() -> bool {
    true
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SystemSettings {
    #[serde(default = "default_server_name")]
    pub server_name: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_page")]
    pub default_page: String,
    #[serde(default = "default_refresh_rate")]
    pub metrics_refresh_rate: u64,
    #[serde(default = "default_true")]
    pub show_weather_card: bool,
    #[serde(default)]
    pub weather_city: String,
    #[serde(default = "default_true")]
    pub confirm_dangerous_actions: bool,
    #[serde(default)]
    pub integrations: IntegrationsSettings,
}

fn default_server_name() -> String {
    "Orbit Dashboard".to_string()
}

fn default_port() -> u16 {
    std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(5172)
}

fn default_page() -> String {
    "/".to_string()
}

fn default_refresh_rate() -> u64 {
    5
}

impl Default for SystemSettings {
    fn default() -> Self {
        Self {
            server_name: default_server_name(),
            port: default_port(),
            default_page: default_page(),
            metrics_refresh_rate: default_refresh_rate(),
            show_weather_card: true,
            weather_city: String::new(),
            confirm_dangerous_actions: true,
            integrations: IntegrationsSettings::default(),
        }
    }
}

#[derive(Deserialize)]
pub struct CheckPortRequest {
    pub port: u16,
}

static SETTINGS_CACHE: Lazy<Arc<RwLock<SystemSettings>>> = Lazy::new(|| {
    let loaded = load_settings_from_disk();
    Arc::new(RwLock::new(loaded))
});

pub fn get_settings_path() -> PathBuf {
    let mut path = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    path.push("data");
    path.push("settings.json");
    path
}

fn load_settings_from_disk() -> SystemSettings {
    let path = get_settings_path();
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(settings) = serde_json::from_str::<SystemSettings>(&content) {
            return settings;
        }
    }
    SystemSettings::default()
}

fn save_settings_to_disk(settings: &SystemSettings) {
    let path = get_settings_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(settings) {
        let _ = fs::write(&path, json);
    }
}

pub fn get_configured_port() -> u16 {
    let guard = SETTINGS_CACHE.read().unwrap();
    guard.port
}

pub fn get_current_settings() -> SystemSettings {
    let guard = SETTINGS_CACHE.read().unwrap();
    guard.clone()
}

pub async fn get_settings_handler() -> impl IntoResponse {
    let current = get_current_settings();
    (StatusCode::OK, Json(current)).into_response()
}

pub async fn update_settings_handler(Json(payload): Json<SystemSettings>) -> impl IntoResponse {
    let mut new_settings = payload;

    // Validate port boundaries
    if new_settings.port == 0 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Port must be greater than 0" })),
        ).into_response();
    }

    if new_settings.server_name.trim().is_empty() {
        new_settings.server_name = default_server_name();
    }

    {
        let mut guard = SETTINGS_CACHE.write().unwrap();
        *guard = new_settings.clone();
    }

    save_settings_to_disk(&new_settings);

    (StatusCode::OK, Json(new_settings)).into_response()
}

pub async fn check_port_handler(Json(payload): Json<CheckPortRequest>) -> impl IntoResponse {
    let info = crate::docker::ports::check_port_availability(payload.port, "tcp");
    (StatusCode::OK, Json(info)).into_response()
}
