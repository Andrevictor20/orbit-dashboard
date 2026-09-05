//! Remote container registry manifest inspection (Docker Hub, GHCR) and update availability checking.

use std::collections::HashMap;
use std::sync::RwLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use bollard::query_parameters::ListContainersOptions;
use bollard::Docker;
use once_cell::sync::Lazy;
use crate::state::AppState;

pub fn get_host_platform() -> &'static str {
    match std::env::consts::ARCH {
        "aarch64" => "linux/arm64",
        "arm" => "linux/arm/v7",
        "x86_64" => "linux/amd64",
        "x86" => "linux/386",
        "riscv64" => "linux/riscv64",
        _ => "linux/amd64",
    }
}

pub fn parse_image_ref(image: &str) -> (String, String, String) {
    let (img, tag) = if let Some((name, t)) = image.rsplit_once(':') {
        if !name.contains('/') || name.rfind('/').unwrap() < image.rfind(':').unwrap_or(0) {
            (name.to_string(), t.to_string())
        } else {
            (image.to_string(), "latest".to_string())
        }
    } else {
        (image.to_string(), "latest".to_string())
    };

    if img.starts_with("ghcr.io/") {
        ("ghcr.io".to_string(), img.trim_start_matches("ghcr.io/").to_string(), tag)
    } else if img.contains('/') {
        if img.split('/').next().unwrap_or("").contains('.') {
            let parts: Vec<&str> = img.splitn(2, '/').collect();
            (parts[0].to_string(), parts[1].to_string(), tag)
        } else {
            ("registry-1.docker.io".to_string(), img, tag)
        }
    } else {
        ("registry-1.docker.io".to_string(), format!("library/{}", img), tag)
    }
}

pub async fn check_remote_registry_for_update(docker: &Docker, image: &str) -> bool {
    // 1. Inspect local image
    let inspect = match docker.inspect_image(image).await {
        Ok(i) => i,
        Err(_) => return false,
    };
    let local_digests = inspect.repo_digests.unwrap_or_default();
    
    // 2. Parse image: e.g. "nginx:latest", "linuxserver/qbittorrent", "ghcr.io/owner/repo:tag"
    let (registry, repo, tag) = parse_image_ref(image);
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(4))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    // Get Auth Token if needed
    let token = if registry == "registry-1.docker.io" {
        let auth_url = format!("https://auth.docker.io/token?service=registry.docker.io&scope=repository:{}:pull", repo);
        if let Ok(res) = client.get(&auth_url).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                json.get("token").and_then(|t| t.as_str()).map(|s| s.to_string())
            } else { None }
        } else { None }
    } else if registry == "ghcr.io" {
        let auth_url = format!("https://ghcr.io/token?service=ghcr.io&scope=repository:{}:pull", repo);
        if let Ok(res) = client.get(&auth_url).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                json.get("token").and_then(|t| t.as_str()).map(|s| s.to_string())
            } else { None }
        } else { None }
    } else {
        None
    };

    // Query manifest HEAD
    let manifest_url = format!("https://{}/v2/{}/manifests/{}", registry, repo, tag);
    let mut req = client.head(&manifest_url)
        .header("Accept", "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json");

    if let Some(tok) = token {
        req = req.header("Authorization", format!("Bearer {}", tok));
    }

    if let Ok(res) = req.send().await {
        if res.status().is_success() {
            if let Some(remote_digest) = res.headers().get("docker-content-digest").and_then(|d| d.to_str().ok()) {
                let matches = local_digests.iter().any(|ld| ld.ends_with(remote_digest) || ld.contains(remote_digest));
                return !matches;
            }
        }
    }

    false
}

pub static UPDATE_CACHE: Lazy<RwLock<HashMap<String, (bool, u64)>>> = 
    Lazy::new(|| RwLock::new(HashMap::new()));

pub fn invalidate_update_cache(image: &str) {
    if let Ok(mut cache) = UPDATE_CACHE.write() {
        cache.remove(image);
    }
}

pub async fn check_single_image_update(docker: &Docker, image: &str) -> bool {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    
    // Check cache (15 min TTL = 900s)
    if let Ok(cache) = UPDATE_CACHE.read() {
        if let Some((has_update, timestamp)) = cache.get(image) {
            if now.saturating_sub(*timestamp) < 900 {
                return *has_update;
            }
        }
    }

    let has_update = check_remote_registry_for_update(docker, image).await;
    
    if let Ok(mut cache) = UPDATE_CACHE.write() {
        cache.insert(image.to_string(), (has_update, now));
    }
    
    has_update
}

pub async fn check_container_updates(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let options = ListContainersOptions {
        all: true,
        ..Default::default()
    };
    let containers = state.docker.list_containers(Some(options)).await.unwrap_or_default();
    let mut update_results = HashMap::new();

    for c in containers {
        if let (Some(id), Some(image)) = (c.id, c.image) {
            let short_id: String = id.chars().take(12).collect();
            let has_update = check_single_image_update(&state.docker, &image).await;
            update_results.insert(short_id, serde_json::json!({
                "image": image,
                "has_update": has_update
            }));
        }
    }

    (StatusCode::OK, Json(update_results)).into_response()
}

pub async fn check_single_container_update(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let inspect = match state.docker.inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>).await {
        Ok(i) => i,
        Err(e) => return (StatusCode::NOT_FOUND, format!("Container not found: {}", e)).into_response(),
    };

    let image = inspect.config.and_then(|c| c.image).unwrap_or_default();
    let has_update = check_single_image_update(&state.docker, &image).await;

    (StatusCode::OK, Json(serde_json::json!({
        "id": id,
        "image": image,
        "has_update": has_update
    }))).into_response()
}
