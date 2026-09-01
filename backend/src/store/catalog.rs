use axum::{
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use once_cell::sync::Lazy;
use std::fs;
use std::io::{Cursor, Read};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::RwLock;
use tracing::{info, warn};
use zip::ZipArchive;
use super::parser::parse_casaos_compose;
use super::types::AppStoreItem;

pub static APPS_CACHE: Lazy<RwLock<Vec<AppStoreItem>>> = Lazy::new(|| RwLock::new(Vec::new()));
static SYNCING: AtomicBool = AtomicBool::new(false);

const REPOSITORIES: &[(&str, &str); 7] = &[
    ("official", "https://github.com/IceWhaleTech/CasaOS-AppStore/archive/refs/heads/main.zip"),
    ("linuxserver", "https://casaos-appstore.paodayag.dev/linuxserver.zip"),
    ("bigbear", "https://github.com/bigbeartechworld/big-bear-casaos/archive/refs/heads/master.zip"),
    ("play", "https://github.com/CP0204/CasaOS-AppStore-Play/archive/refs/heads/main.zip"),
    ("edge", "https://paodayag.dev/casaos-appstore-edge.zip"),
    ("coolstore", "https://github.com/WisdomSky/CasaOS-Coolstore/archive/refs/heads/main.zip"),
    ("homeautomation", "https://github.com/mr-manuel/CasaOS-HomeAutomation-AppStore/archive/refs/heads/master.zip"),
];

/// Reclaim glibc arena memory back to the Linux kernel.
pub fn trim_memory() {
    #[cfg(target_os = "linux")]
    unsafe {
        libc::malloc_trim(0);
    }
}

/// Load cache from disk if available to avoid cold-start memory spikes.
pub fn load_cached_apps_from_disk() -> bool {
    if let Ok(contents) = fs::read_to_string("data/cached_apps.json") {
        if let Ok(apps) = serde_json::from_str::<Vec<AppStoreItem>>(&contents) {
            if !apps.is_empty() {
                if let Ok(mut cache) = APPS_CACHE.write() {
                    *cache = apps;
                    info!("App Store cache loaded from disk ({} apps)", cache.len());
                    trim_memory();
                    return true;
                }
            }
        }
    }
    false
}

pub async fn sync_repositories() {
    if SYNCING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        info!("App Store sync already in progress, skipping redundant sync.");
        return;
    }
    let client = reqwest::Client::builder()
        .user_agent("Orbit-Dashboard/1.0")
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let mut all_apps = Vec::new();

    // Process repositories sequentially with immediate memory cleanup per archive
    for &(store_name, repo_url) in REPOSITORIES {
        info!("Syncing repository: {} ({})", repo_url, store_name);

        let res = match client.get(repo_url).send().await {
            Ok(r) => r,
            Err(e) => {
                warn!("Failed to download {}: {}", repo_url, e);
                continue;
            }
        };

        let bytes = match res.bytes().await {
            Ok(b) => b,
            Err(e) => {
                warn!("Failed to read bytes from {}: {}", repo_url, e);
                continue;
            }
        };

        {
            let reader = Cursor::new(bytes);
            let mut archive = match ZipArchive::new(reader) {
                Ok(a) => a,
                Err(e) => {
                    warn!("Failed to open zip archive from {}: {}", repo_url, e);
                    continue;
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
                        if let Ok(item) = parse_casaos_compose(&contents, store_name) {
                            all_apps.push(item);
                        }
                    }
                }
            }
        }

        // Periodic memory trim between large repository archives
        trim_memory();
    }

    if !all_apps.is_empty() {
        if let Ok(mut cache) = APPS_CACHE.write() {
            *cache = all_apps.clone();
            info!("App Store cache updated with {} apps", cache.len());
        }
        
        // Save to disk
        if let Ok(json) = serde_json::to_string(&all_apps) {
            let _ = fs::write("data/cached_apps.json", json);
        }
    } else {
        warn!("No apps found during sync.");
    }

    // Reset syncing flag
    SYNCING.store(false, Ordering::SeqCst);

    // Free heap memory back to OS immediately
    trim_memory();
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

fn get_bootstrap_apps() -> Vec<AppStoreItem> {
    vec![
        AppStoreItem {
            id: "nginx".to_string(),
            name: "Nginx".to_string(),
            description: "High-performance HTTP and reverse proxy server.".to_string(),
            icon: "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/nginx.png".to_string(),
            category: "Network".to_string(),
            store: "Official".to_string(),
            compose_file: "version: '3.8'\nservices:\n  nginx:\n    image: nginx:alpine\n    ports:\n      - '80:80'\n    restart: unless-stopped".to_string(),
        },
        AppStoreItem {
            id: "portainer".to_string(),
            name: "Portainer CE".to_string(),
            description: "Powerful Docker container management interface.".to_string(),
            icon: "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/portainer.png".to_string(),
            category: "Utilities".to_string(),
            store: "Official".to_string(),
            compose_file: "version: '3.8'\nservices:\n  portainer:\n    image: portainer/portainer-ce:latest\n    ports:\n      - '9000:9000'\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock\n    restart: unless-stopped".to_string(),
        },
        AppStoreItem {
            id: "wireguard".to_string(),
            name: "WireGuard".to_string(),
            description: "Fast, modern and secure VPN tunnel.".to_string(),
            icon: "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/wireguard.png".to_string(),
            category: "Network".to_string(),
            store: "Official".to_string(),
            compose_file: "version: '3.8'\nservices:\n  wireguard:\n    image: linuxserver/wireguard:latest\n    restart: unless-stopped".to_string(),
        },
    ]
}

pub async fn list_apps() -> impl IntoResponse {
    let is_empty = {
        let cache = APPS_CACHE.read().unwrap();
        cache.is_empty()
    };

    if is_empty {
        let loaded = load_cached_apps_from_disk();
        if !loaded {
            // Seed with bootstrap apps immediately so client/tests never hang on cold start
            if let Ok(mut cache) = APPS_CACHE.write() {
                if cache.is_empty() {
                    *cache = get_bootstrap_apps();
                }
            }
            tokio::spawn(async {
                sync_repositories().await;
            });
        }
    }

    let cache = APPS_CACHE.read().unwrap();
    (StatusCode::OK, Json(cache.clone())).into_response()
}
