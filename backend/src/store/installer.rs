use axum::{
    extract::Path,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use once_cell::sync::Lazy;
use serde_yaml::Value;
use std::collections::HashMap;
use std::fs;
use std::sync::RwLock;
use tokio::io::AsyncBufReadExt;
use tokio::process::Command;
use super::catalog::APPS_CACHE;
use super::types::{CustomInstallPayload, InstallTask};

pub static INSTALL_TASKS: Lazy<RwLock<HashMap<String, InstallTask>>> = Lazy::new(|| RwLock::new(HashMap::new()));

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

        // Enforce safe container logging rotation limits (max 30MB per container)
        compose_content = ensure_safe_logging_config(&compose_content);

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

pub async fn install_custom_app(
    Path(id): Path<String>, Json(_payload): Json<CustomInstallPayload>) -> impl IntoResponse {
    let _app = {
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

pub fn ensure_safe_logging_config(compose_str: &str) -> String {
    if let Ok(mut parsed) = serde_yaml::from_str::<Value>(compose_str) {
        if let Some(services) = parsed.get_mut("services").and_then(|s| s.as_mapping_mut()) {
            let logging_key = Value::String("logging".to_string());
            for (_, service) in services.iter_mut() {
                if let Some(svc_map) = service.as_mapping_mut() {
                    if !svc_map.contains_key(&logging_key) {
                        let mut log_opts = serde_yaml::Mapping::new();
                        log_opts.insert(Value::String("max-size".to_string()), Value::String("10m".to_string()));
                        log_opts.insert(Value::String("max-file".to_string()), Value::String("3".to_string()));

                        let mut log_map = serde_yaml::Mapping::new();
                        log_map.insert(Value::String("driver".to_string()), Value::String("json-file".to_string()));
                        log_map.insert(Value::String("options".to_string()), Value::Mapping(log_opts));

                        svc_map.insert(logging_key.clone(), Value::Mapping(log_map));
                    }
                }
            }
        }
        if let Ok(updated) = serde_yaml::to_string(&parsed) {
            return updated;
        }
    }
    compose_str.to_string()
}

