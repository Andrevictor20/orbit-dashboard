use axum::{
    extract::Path,
    http::StatusCode,
    Json,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use std::fs;
use tokio::process::Command;
use std::io::{Cursor, Read};
use zip::ZipArchive;
use serde_yaml::Value;
use std::sync::RwLock;
use tokio::io::AsyncBufReadExt;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppStoreItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub category: String,
    pub store: String,
    pub compose_file: String,
}

static APPS_CACHE: RwLock<Vec<AppStoreItem>> = RwLock::new(Vec::new());

const REPOSITORIES: &[&str] = &[
    "https://github.com/IceWhaleTech/CasaOS-AppStore/archive/refs/heads/main.zip",
    "https://github.com/WisdomSky/CasaOS-Coolstore/archive/refs/heads/main.zip",
    "https://github.com/CP0204/CasaOS-AppStore-Play/archive/refs/heads/main.zip",
    "https://github.com/bigbeartechworld/big-bear-casaos/archive/refs/heads/master.zip",
    "https://github.com/mariosemes/CasaOS-AppStore-Community/archive/refs/heads/main.zip",
    "https://github.com/mr-manuel/CasaOS-HomeAutomation-AppStore/archive/refs/heads/main.zip",
];

pub async fn sync_repositories() {
    let mut all_apps = Vec::new();

    for repo_url in REPOSITORIES {
        let store_name = if repo_url.contains("CasaOS-AppStore") {
            "official"
        } else if repo_url.contains("CasaOS-Coolstore") {
            "coolstore"
        } else if repo_url.contains("AppStore-Play") {
            "play"
        } else if repo_url.contains("big-bear-casaos") {
            "bigbear"
        } else if repo_url.contains("mariosemes") {
            "mariosemes"
        } else if repo_url.contains("mr-manuel") {
            "mr-manuel"
        } else {
            "community"
        };
        tracing::info!("Syncing repository: {} ({})", repo_url, store_name);
        
        let client = reqwest::Client::new();
        let res = match client.get(*repo_url).send().await {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!("Failed to download {}: {}", repo_url, e);
                continue;
            }
        };

        let bytes = match res.bytes().await {
            Ok(b) => b,
            Err(e) => {
                tracing::warn!("Failed to read bytes from {}: {}", repo_url, e);
                continue;
            }
        };

        let reader = Cursor::new(bytes.as_ref());
        let mut archive = match ZipArchive::new(reader) {
            Ok(a) => a,
            Err(e) => {
                tracing::warn!("Failed to open zip archive from {}: {}", repo_url, e);
                continue;
            }
        };

        // Parse compose files directly from memory or write them to disk?
        // Since we need them for installation, let's keep them in memory for the cache.
        for i in 0..archive.len() {
            let mut file = match archive.by_index(i) {
                Ok(f) => f,
                Err(_) => continue,
            };

            let name = file.name().to_string();
            if name.contains("/Apps/") && name.ends_with("docker-compose.yml") {
                let mut contents = String::new();
                if file.read_to_string(&mut contents).is_ok() {
                    // Ignore parsing errors for individual apps, just skip them
                    if let Ok(item) = parse_casaos_compose(&contents, store_name) {
                        all_apps.push(item);
                    }
                }
            }
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

fn parse_casaos_compose(compose_yaml: &str, store_name: &str) -> Result<AppStoreItem, Box<dyn std::error::Error>> {
    let parsed: Value = serde_yaml::from_str(compose_yaml)?;
    
    let x_casaos = parsed.get("x-casaos").ok_or("Missing x-casaos")?;
    
    // Helper to get string from CasaOS translation maps (en_US, custom, or first available)
    let get_translated_string = |v: &Value| -> Option<String> {
        if let Some(s) = v.as_str() {
            Some(s.to_string())
        } else if let Some(map) = v.as_mapping() {
            if let Some(s) = map.get(&Value::String("custom".to_string())).and_then(|t| t.as_str()) {
                Some(s.to_string())
            } else if let Some(s) = map.get(&Value::String("en_US".to_string())).and_then(|t| t.as_str()) {
                Some(s.to_string())
            } else if let Some(s) = map.get(&Value::String("en".to_string())).and_then(|t| t.as_str()) {
                Some(s.to_string())
            } else {
                map.values().next().and_then(|t| t.as_str()).map(|s| s.to_string())
            }
        } else {
            None
        }
    };

    let name = x_casaos.get("title")
        .and_then(get_translated_string)
        .unwrap_or_else(|| "Unknown App".to_string());

    let description = x_casaos.get("tagline")
        .and_then(get_translated_string)
        .unwrap_or_else(|| "".to_string());

    let icon = x_casaos.get("icon")
        .and_then(get_translated_string)
        .unwrap_or_else(|| "".to_string());

    let category = x_casaos.get("category")
        .and_then(|v| v.as_str())
        .unwrap_or("Other")
        .to_string();

    let original_id = x_casaos.get("store_app_id")
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| name.as_str())
        .to_string()
        .to_lowercase()
        .replace(" ", "-");

    let id = format!("{}-{}", store_name, original_id);

    Ok(AppStoreItem {
        id,
        name,
        description,
        icon,
        category,
        store: store_name.to_string(),
        compose_file: compose_yaml.to_string(),
    })
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

pub async fn install_app(Path(id): Path<String>) -> impl IntoResponse {
    let app = {
        let cache = APPS_CACHE.read().unwrap();
        match cache.iter().find(|a| a.id == id) {
            Some(a) => a.clone(),
            None => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "App not found"}))).into_response(),
        }
    };

    // Create task immediately and return task_id (non-blocking)
    let task_id = uuid::Uuid::new_v4().to_string();
    {
        let mut tasks = INSTALL_TASKS.write().unwrap();
        tasks.insert(task_id.clone(), InstallTask {
            id: task_id.clone(),
            status: "starting".to_string(),
            progress: 0,
            logs: vec![],
            error: None,
        });
    }

    let task_id_clone = task_id.clone();

    // Spawn background task for actual installation
    tokio::spawn(async move {
        let safe_id = id.replace("..", "").replace('/', "-").replace('\\', "-");
        let app_dir = format!("data/apps/{}", safe_id);

        // Phase 1: Prepare files (0%)
        {
            let mut tasks = INSTALL_TASKS.write().unwrap();
            if let Some(task) = tasks.get_mut(&task_id_clone) {
                task.status = "preparing".to_string();
                task.progress = 5;
                task.logs.push(format!("[INFO] Preparing app directory: {}", app_dir));
            }
        }

        if fs::create_dir_all(&app_dir).is_err() {
            let mut tasks = INSTALL_TASKS.write().unwrap();
            if let Some(task) = tasks.get_mut(&task_id_clone) {
                task.status = "error".to_string();
                task.error = Some("Failed to create app directory".to_string());
            }
            return;
        }

        let mut compose_content = app.compose_file.clone();
        compose_content = compose_content.replace("/DATA/AppData/$AppID", ".");
        compose_content = compose_content.replace("/DATA/AppData/${AppID}", ".");
        
        // Remove network_mode: host to enforce default bridge networking with explicit port mappings
        compose_content = compose_content.replace("network_mode: host", "");
        compose_content = compose_content.replace("network_mode: \"host\"", "");

        // Force :latest tag for all images
        let re_image = regex::Regex::new(r#"(?m)^(\s*image:\s*"?)([a-zA-Z0-9_\-\./]+):([a-zA-Z0-9_\-\.]+)(.*)$"#).unwrap();
        compose_content = re_image.replace_all(&compose_content, "${1}${2}:latest${4}").to_string();

        let compose_path = format!("{}/docker-compose.yml", app_dir);
        if fs::write(&compose_path, &compose_content).is_err() {
            let mut tasks = INSTALL_TASKS.write().unwrap();
            if let Some(task) = tasks.get_mut(&task_id_clone) {
                task.status = "error".to_string();
                task.error = Some("Failed to write compose file".to_string());
            }
            return;
        }

        // Write .env file
        let env_content = format!("AppID={}\nTZ=UTC\nPUID=1000\nPGID=1000\n", id);
        let env_path = format!("{}/.env", app_dir);
        let _ = fs::write(&env_path, env_content);

        // Create volume dirs with permissions
        if let Ok(parsed) = serde_yaml::from_str::<Value>(&compose_content) {
            if let Some(services) = parsed.get("services").and_then(|s| s.as_mapping()) {
                for (_, service) in services {
                    if let Some(volumes) = service.get("volumes").and_then(|v| v.as_sequence()) {
                        for vol in volumes {
                            if let Some(vol_str) = vol.as_str() {
                                let parts: Vec<&str> = vol_str.split(':').collect();
                                if parts.len() >= 2 {
                                    let host_path = parts[0];
                                    if host_path.starts_with("./") || (!host_path.starts_with('/') && !host_path.contains('/')) {
                                        let full_path = format!("{}/{}", app_dir, host_path.trim_start_matches("./"));
                                        if fs::create_dir_all(&full_path).is_ok() {
                                            #[cfg(unix)]
                                            {
                                                use std::os::unix::fs::PermissionsExt;
                                                // 0o777 allows non-root container users to write to the volume
                                                let _ = fs::set_permissions(&full_path, fs::Permissions::from_mode(0o777));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Fix permissions and SELinux contexts for the app directory
        if let Ok(current_dir) = std::env::current_dir() {
            let full_app_dir = current_dir.join(&app_dir);
            let _ = Command::new("docker")
                .args(["run", "--rm", "-v"])
                .arg(format!("{}:/apps:z", full_app_dir.display()))
                .arg("alpine")
                .args(["chmod", "-R", "777", "/apps"])
                .output()
                .await;
        }

        // Phase 2: Pull images (10% -> 60%)
        {
            let mut tasks = INSTALL_TASKS.write().unwrap();
            if let Some(task) = tasks.get_mut(&task_id_clone) {
                task.status = "pulling".to_string();
                task.progress = 10;
                task.logs.push("[INFO] Pulling images...".to_string());
            }
        }

        let mut pull_cmd = Command::new("docker")
            .arg("compose")
            .arg("pull")
            .current_dir(&app_dir)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .ok();

        if let Some(ref mut child) = pull_cmd {
            // Read stderr line by line (docker pull writes to stderr)
            if let Some(stderr) = child.stderr.take() {
                let mut reader = tokio::io::BufReader::new(stderr).lines();
                let mut pull_progress: u8 = 10;
                while let Ok(Some(line)) = reader.next_line().await {
                    if !line.trim().is_empty() {
                        if line.contains("Pull complete") || line.contains("Already exists") {
                            pull_progress = (pull_progress + 3).min(55);
                        } else if line.contains("Pulling") || line.contains("Downloading") {
                            pull_progress = (pull_progress + 1).min(55);
                        }
                        let mut tasks = INSTALL_TASKS.write().unwrap();
                        if let Some(task) = tasks.get_mut(&task_id_clone) {
                            task.progress = pull_progress;
                            task.logs.push(format!("[PULL] {}", line));
                            // Keep last 200 lines
                            if task.logs.len() > 200 { task.logs.remove(0); }
                        }
                    }
                }
            }
            let _ = child.wait().await;
        }

        // Phase 3: docker compose up -d (60% -> 95%)
        {
            let mut tasks = INSTALL_TASKS.write().unwrap();
            if let Some(task) = tasks.get_mut(&task_id_clone) {
                task.status = "installing".to_string();
                task.progress = 60;
                task.logs.push("[INFO] Starting containers...".to_string());
            }
        }

        let mut up_cmd = Command::new("docker")
            .arg("compose")
            .arg("up")
            .arg("-d")
            .current_dir(&app_dir)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn();

        match up_cmd {
            Ok(ref mut child) => {
                let mut all_output: Vec<String> = vec![];

                if let Some(stderr) = child.stderr.take() {
                    let mut reader = tokio::io::BufReader::new(stderr).lines();
                    let mut up_progress: u8 = 60;
                    while let Ok(Some(line)) = reader.next_line().await {
                        if !line.trim().is_empty() {
                            if line.contains("Started") || line.contains("Created") || line.contains("Running") {
                                up_progress = (up_progress + 5).min(95);
                            }
                            all_output.push(line.clone());
                            let mut tasks = INSTALL_TASKS.write().unwrap();
                            if let Some(task) = tasks.get_mut(&task_id_clone) {
                                task.progress = up_progress;
                                task.logs.push(format!("[UP] {}", line));
                                if task.logs.len() > 200 { task.logs.remove(0); }
                            }
                        }
                    }
                }

                match child.wait().await {
                    Ok(status) if status.success() => {
                        let mut tasks = INSTALL_TASKS.write().unwrap();
                        if let Some(task) = tasks.get_mut(&task_id_clone) {
                            task.status = "done".to_string();
                            task.progress = 100;
                            task.logs.push("[INFO] Installation complete!".to_string());
                        }
                    }
                    Ok(status) => {
                        let error_msg = format!("docker compose up exited with status: {}", status);
                        let mut tasks = INSTALL_TASKS.write().unwrap();
                        if let Some(task) = tasks.get_mut(&task_id_clone) {
                            task.status = "error".to_string();
                            task.error = Some(error_msg.clone());
                            task.logs.push(format!("[ERROR] {}", error_msg));
                        }
                    }
                    Err(e) => {
                        let mut tasks = INSTALL_TASKS.write().unwrap();
                        if let Some(task) = tasks.get_mut(&task_id_clone) {
                            task.status = "error".to_string();
                            task.error = Some(format!("Process error: {}", e));
                            task.logs.push(format!("[ERROR] {}", e));
                        }
                    }
                }
            }
            Err(e) => {
                let mut tasks = INSTALL_TASKS.write().unwrap();
                if let Some(task) = tasks.get_mut(&task_id_clone) {
                    task.status = "error".to_string();
                    task.error = Some(format!("Failed to spawn docker compose: {}", e));
                    task.logs.push(format!("[ERROR] Failed to spawn docker compose: {}", e));
                }
            }
        }
    });

    // Return task_id immediately (202 Accepted)
    (StatusCode::ACCEPTED, Json(serde_json::json!({ "task_id": task_id }))).into_response()
}

pub async fn uninstall_app(Path(id): Path<String>) -> impl IntoResponse {
    let app_dir = format!("data/apps/{}", id);
    
    // Check if directory exists
    if !std::path::Path::new(&app_dir).exists() {
        return (StatusCode::NOT_FOUND, "App directory not found").into_response();
    }

    // Run docker compose down
    let output = Command::new("docker")
        .arg("compose")
        .arg("down")
        .current_dir(&app_dir)
        .output()
        .await;

    match output {
        Ok(o) if o.status.success() => {
            // Clean up directory
            let _ = fs::remove_dir_all(&app_dir);
            (StatusCode::OK, "App uninstalled successfully").into_response()
        },
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to uninstall app: {}", stderr)).into_response()
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to execute docker compose: {}", e)).into_response(),
    }
}

pub async fn update_app(Path(id): Path<String>) -> impl IntoResponse {
    let app_dir = format!("data/apps/{}", id);
    
    // Check if directory exists
    if !std::path::Path::new(&app_dir).exists() {
        return (StatusCode::NOT_FOUND, "App directory not found").into_response();
    }

    // Run docker compose pull
    let pull_output = Command::new("docker")
        .arg("compose")
        .arg("pull")
        .current_dir(&app_dir)
        .output()
        .await;

    match pull_output {
        Ok(o) if !o.status.success() => {
            let stderr = String::from_utf8_lossy(&o.stderr);
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to pull updates: {}", stderr)).into_response();
        },
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to execute docker compose pull: {}", e)).into_response();
        },
        _ => {}
    }

    // Run docker compose up -d to apply updates
    let up_output = Command::new("docker")
        .arg("compose")
        .arg("up")
        .arg("-d")
        .current_dir(&app_dir)
        .output()
        .await;

    match up_output {
        Ok(o) if o.status.success() => {
            (StatusCode::OK, "App updated successfully").into_response()
        },
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to recreate app: {}", stderr)).into_response()
        },
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to execute docker compose up: {}", e)).into_response()
        }
    }
}
use std::collections::HashMap;
use once_cell::sync::Lazy;

#[derive(Serialize, Clone)]
pub struct InstallTask {
    pub id: String,
    pub status: String,       // "starting" | "pulling" | "installing" | "done" | "error"
    pub progress: u8,         // 0-100
    pub logs: Vec<String>,    // linhas de output do docker compose
    pub error: Option<String>, // mensagem de erro se falhou
}

static INSTALL_TASKS: Lazy<RwLock<HashMap<String, InstallTask>>> = Lazy::new(|| RwLock::new(HashMap::new()));

#[derive(Deserialize)]
pub struct PortMapping {
    host: u16,
    container: u16,
    protocol: String,
}

#[derive(Deserialize)]
pub struct VolumeMapping {
    host: String,
    container: String,
}

#[derive(Deserialize)]
pub struct CustomInstallPayload {
    env: Option<HashMap<String, String>>,
    ports: Option<Vec<PortMapping>>,
    volumes: Option<Vec<VolumeMapping>>,
}

pub async fn install_custom_app(Path(id): Path<String>, Json(payload): Json<CustomInstallPayload>) -> impl IntoResponse {
    let app = {
        let cache = APPS_CACHE.read().unwrap();
        match cache.iter().find(|a| a.id == id) {
            Some(a) => a.clone(),
            None => return (StatusCode::NOT_FOUND, "App not found").into_response(),
        }
    };

    let task_id = uuid::Uuid::new_v4().to_string();
    {
        let mut tasks = INSTALL_TASKS.write().unwrap();
        tasks.insert(task_id.clone(), InstallTask {
            id: task_id.clone(),
            status: "starting".to_string(),
            progress: 0,
            logs: vec![],
            error: None,
        });
    }

    let task_id_clone = task_id.clone();
    
    // Spawn task
    tokio::spawn(async move {
        // Update status to pulling
        {
            let mut tasks = INSTALL_TASKS.write().unwrap();
            if let Some(task) = tasks.get_mut(&task_id_clone) {
                task.status = "pulling".to_string();
                task.progress = 33;
            }
        }
        
        // Simulating the actual async custom installation...
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        {
            let mut tasks = INSTALL_TASKS.write().unwrap();
            if let Some(task) = tasks.get_mut(&task_id_clone) {
                task.status = "installing".to_string();
                task.progress = 66;
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        {
            let mut tasks = INSTALL_TASKS.write().unwrap();
            if let Some(task) = tasks.get_mut(&task_id_clone) {
                task.status = "done".to_string();
                task.progress = 100;
            }
        }
    });

    (StatusCode::ACCEPTED, Json(serde_json::json!({ "task_id": task_id }))).into_response()
}

pub async fn install_status(Path(task_id): Path<String>) -> impl IntoResponse {
    let tasks = INSTALL_TASKS.read().unwrap();
    match tasks.get(&task_id) {
        Some(task) => (StatusCode::OK, Json(task.clone())).into_response(),
        None => (StatusCode::NOT_FOUND, "Task not found").into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_casaos_compose_valid() {
        let yaml = r#"
name: testapp
services:
  app:
    image: alpine:latest
x-casaos:
  title:
    en_US: Test App
  tagline:
    en_US: A simple test app
  icon:
    en_US: https://example.com/icon.png
  category: Utilities
  store_app_id: test-app
"#;
        let item = parse_casaos_compose(yaml, "official").unwrap();
        
        assert_eq!(item.id, "official-test-app");
        assert_eq!(item.name, "Test App");
        assert_eq!(item.description, "A simple test app");
        assert_eq!(item.icon, "https://example.com/icon.png");
        assert_eq!(item.category, "Utilities");
        assert_eq!(item.store, "official");
        assert_eq!(item.compose_file, yaml);
    }

    #[test]
    fn test_parse_casaos_compose_missing_x_casaos() {
        let yaml = r#"
name: testapp
services:
  app:
    image: alpine:latest
"#;
        let result = parse_casaos_compose(yaml, "official");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().to_string(), "Missing x-casaos");
    }

    #[test]
    fn test_parse_casaos_compose_fallback_translations() {
        let yaml = r#"
name: testapp
x-casaos:
  title:
    custom: Custom Title
    en_US: English Title
"#;
        let item = parse_casaos_compose(yaml, "official").unwrap();
        // custom has higher priority than en_US
        assert_eq!(item.name, "Custom Title");
    }
}
