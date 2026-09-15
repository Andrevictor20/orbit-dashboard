use axum::{http::StatusCode, response::IntoResponse, Json};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CustomizationConfig {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_color")]
    pub color: String,
    #[serde(default)]
    pub custom_avatar: Option<String>,
    #[serde(default)]
    pub wallpaper_url: Option<String>,
    #[serde(default = "default_wallpaper_opacity")]
    pub wallpaper_opacity: f32,
    #[serde(default)]
    pub wallpaper_blur: u32,
}

fn default_theme() -> String {
    "dark".to_string()
}

fn default_color() -> String {
    "zinc".to_string()
}

fn default_wallpaper_opacity() -> f32 {
    0.5
}

impl Default for CustomizationConfig {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            color: default_color(),
            custom_avatar: None,
            wallpaper_url: None,
            wallpaper_opacity: default_wallpaper_opacity(),
            wallpaper_blur: 0,
        }
    }
}

pub fn get_customization_path() -> PathBuf {
    crate::system::data_migrator::get_active_data_dir().join("customization.json")
}

pub static CUSTOMIZATION_CACHE: Lazy<Arc<RwLock<CustomizationConfig>>> = Lazy::new(|| {
    let path = get_customization_path();
    let config = if let Ok(data) = fs::read_to_string(&path) {
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        CustomizationConfig::default()
    };
    Arc::new(RwLock::new(config))
});

pub fn reload_customization_from_disk() {
    let path = get_customization_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(config) = serde_json::from_str::<CustomizationConfig>(&data) {
            if let Ok(mut lock) = CUSTOMIZATION_CACHE.write() {
                *lock = config;
            }
        }
    }
}

pub async fn get_customization_handler() -> impl IntoResponse {
    let config = {
        let lock = CUSTOMIZATION_CACHE.read().unwrap();
        lock.clone()
    };
    (StatusCode::OK, Json(config))
}

pub async fn update_customization_handler(
    Json(payload): Json<CustomizationConfig>,
) -> impl IntoResponse {
    {
        let mut lock = CUSTOMIZATION_CACHE.write().unwrap();
        *lock = payload.clone();
    }

    let path = get_customization_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Ok(serialized) = serde_json::to_string_pretty(&payload) {
        let _ = fs::write(&path, serialized);
    }

    (StatusCode::OK, Json(payload))
}
