use once_cell::sync::Lazy;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::Duration;

use super::models::{CachedEntities, CachedMeta, HomeAssistantConfig};

pub static HA_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
});

pub static HA_CONFIG_CACHE: Lazy<Arc<RwLock<Option<HomeAssistantConfig>>>> = Lazy::new(|| {
    let path = get_config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(config) = serde_json::from_str::<HomeAssistantConfig>(&data) {
            return Arc::new(RwLock::new(Some(config)));
        }
    }
    Arc::new(RwLock::new(None))
});

pub static HA_ENTITIES_CACHE: Lazy<Arc<RwLock<Option<CachedEntities>>>> =
    Lazy::new(|| Arc::new(RwLock::new(None)));

pub static HA_META_CACHE: Lazy<Arc<RwLock<Option<CachedMeta>>>> =
    Lazy::new(|| Arc::new(RwLock::new(None)));

pub fn invalidate_ha_caches() {
    if let Ok(mut guard) = HA_ENTITIES_CACHE.write() {
        *guard = None;
    }
    if let Ok(mut guard) = HA_META_CACHE.write() {
        *guard = None;
    }
}

pub fn invalidate_ha_entities_cache() {
    if let Ok(mut guard) = HA_ENTITIES_CACHE.write() {
        *guard = None;
    }
}

pub fn get_config_path() -> PathBuf {
    let mut path = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    path.push("data");
    path.push("homeassistant.json");
    path
}

pub fn save_config_to_disk(config: &Option<HomeAssistantConfig>) {
    let path = get_config_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Some(cfg) = config {
        if let Ok(json) = serde_json::to_string_pretty(cfg) {
            let _ = fs::write(&path, json);
        }
    } else if path.exists() {
        let _ = fs::remove_file(&path);
    }
}

pub fn get_current_config() -> Option<HomeAssistantConfig> {
    let guard = HA_CONFIG_CACHE.read().unwrap();
    guard.clone()
}
