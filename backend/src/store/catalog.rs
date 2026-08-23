use axum::{
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use once_cell::sync::Lazy;
use std::fs;
use std::io::{Cursor, Read};
use std::sync::RwLock;
use zip::ZipArchive;
use super::parser::parse_casaos_compose;
use super::types::AppStoreItem;

pub static APPS_CACHE: Lazy<RwLock<Vec<AppStoreItem>>> = Lazy::new(|| RwLock::new(Vec::new()));

const REPOSITORIES: &[(&str, &str)] = &[
    ("official", "https://github.com/IceWhaleTech/CasaOS-AppStore/archive/refs/heads/main.zip"),
    ("linuxserver", "https://casaos-appstore.paodayag.dev/linuxserver.zip"),
    ("bigbear", "https://github.com/bigbeartechworld/big-bear-casaos/archive/refs/heads/master.zip"),
    ("play", "https://github.com/CP0204/CasaOS-AppStore-Play/archive/refs/heads/main.zip"),
    ("edge", "https://paodayag.dev/casaos-appstore-edge.zip"),
    ("coolstore", "https://github.com/WisdomSky/CasaOS-Coolstore/archive/refs/heads/main.zip"),
    ("homeautomation", "https://github.com/mr-manuel/CasaOS-HomeAutomation-AppStore/archive/refs/heads/master.zip"),
];

pub async fn sync_repositories() {
    let client = reqwest::Client::builder()
        .user_agent("Orbit-Dashboard/1.0")
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let mut handles = Vec::new();

    for &(store_name, repo_url) in REPOSITORIES {
        let client = client.clone();
        let store_name = store_name.to_string();
        let repo_url = repo_url.to_string();

        handles.push(tokio::spawn(async move {
            tracing::info!("Syncing repository in parallel: {} ({})", repo_url, store_name);
            let mut repo_apps = Vec::new();

            let res = match client.get(&repo_url).send().await {
                Ok(r) => r,
                Err(e) => {
                    tracing::warn!("Failed to download {}: {}", repo_url, e);
                    return repo_apps;
                }
            };

            let bytes = match res.bytes().await {
                Ok(b) => b,
                Err(e) => {
                    tracing::warn!("Failed to read bytes from {}: {}", repo_url, e);
                    return repo_apps;
                }
            };

            let reader = Cursor::new(bytes.as_ref());
            let mut archive = match ZipArchive::new(reader) {
                Ok(a) => a,
                Err(e) => {
                    tracing::warn!("Failed to open zip archive from {}: {}", repo_url, e);
                    return repo_apps;
                }
            };

            for i in 0..archive.len() {
                let mut file = match archive.by_index(i) {
                    Ok(f) => f,
                    Err(_) => continue,
                };

                let name = file.name().to_string();
                let is_compose = (name.ends_with("docker-compose.yml") 
                    || name.ends_with("docker-compose.yaml") 
                    || name.ends_with("compose.yml") 
                    || name.ends_with("compose.yaml"))
                    && !name.contains("__MACOSX");

                if is_compose {
                    let mut contents = String::new();
                    if file.read_to_string(&mut contents).is_ok() {
                        if let Ok(item) = parse_casaos_compose(&contents, &store_name) {
                            repo_apps.push(item);
                        }
                    }
                }
            }
            repo_apps
        }));
    }

    let mut all_apps = Vec::new();
    for handle in handles {
        if let Ok(apps) = handle.await {
            all_apps.extend(apps);
        }
    }

    if !all_apps.is_empty() {
        if let Ok(mut cache) = APPS_CACHE.write() {
            *cache = all_apps.clone();
            tracing::info!("App Store cache updated with {} apps", cache.len());
        }
        
        // Save to disk
        if let Ok(json) = serde_json::to_string(&all_apps) {
            let _ = fs::write("data/cached_apps.json", json);
        }
    } else {
        tracing::warn!("No apps found during sync.");
    }
}

pub async fn sync_apps() -> impl IntoResponse {
    sync_repositories().await;
    let count = {
        let cache = APPS_CACHE.read().unwrap();
        cache.len()
    };
    (StatusCode::OK, Json(serde_json::json!({
        "message": "App Store synced successfully",
        "total_apps": count
    }))).into_response()
}

pub async fn list_apps() -> impl IntoResponse {
    let is_empty = {
        let cache = APPS_CACHE.read().unwrap();
        cache.is_empty()
    };

    if is_empty {
        // Try loading from disk first
        let loaded_from_disk = if let Ok(contents) = fs::read_to_string("data/cached_apps.json") {
            if let Ok(apps) = serde_json::from_str::<Vec<AppStoreItem>>(&contents) {
                if let Ok(mut cache) = APPS_CACHE.write() {
                    *cache = apps;
                    tracing::info!("App Store cache loaded from disk ({} apps)", cache.len());
                    true
                } else { false }
            } else { false }
        } else { false };

        if !loaded_from_disk {
            // Trigger background sync if not found
            sync_repositories().await;
        }
    }

    let cache = APPS_CACHE.read().unwrap();
    (StatusCode::OK, Json(cache.clone())).into_response()
}
