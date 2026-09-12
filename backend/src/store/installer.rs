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
use super::types::{CustomInstallPayload, InstallTask, PortMapping, VolumeMapping};

pub static INSTALL_TASKS: Lazy<RwLock<HashMap<String, InstallTask>>> = Lazy::new(|| RwLock::new(HashMap::new()));

/// Sets permissions recursively on a directory using native Rust fs calls.
/// Replaces the previous `docker run alpine chmod -R 777` which required
/// an Alpine image pull and added 5-30s to every installation.
#[cfg(unix)]
fn set_permissions_recursive(dir: &std::path::Path) {
    use std::os::unix::fs::PermissionsExt;
    let _ = fs::set_permissions(dir, fs::Permissions::from_mode(0o777));
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o777));
            if path.is_dir() {
                set_permissions_recursive(&path);
            }
        }
    }
}

#[cfg(not(unix))]
fn set_permissions_recursive(_dir: &std::path::Path) {}

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
    spawn_compose_installation(id, app.compose_file.clone(), task_id_clone);

    // Return task_id immediately (202 Accepted)
    (StatusCode::ACCEPTED, Json(serde_json::json!({ "task_id": task_id }))).into_response()
}

pub fn spawn_compose_installation(id: String, raw_compose: String, task_id: String) {
    spawn_compose_installation_with_env(id, raw_compose, None, task_id);
}

pub fn spawn_compose_installation_with_env(id: String, raw_compose: String, custom_env: Option<String>, task_id: String) {
    let task_id_clone = task_id;
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

        let mut compose_content = raw_compose;
        compose_content = compose_content.replace("/DATA/AppData/$AppID", ".");
        compose_content = compose_content.replace("/DATA/AppData/${AppID}", ".");
        
        // Remove network_mode: host to enforce default bridge networking with explicit port mappings
        compose_content = compose_content.replace("network_mode: host", "");
        compose_content = compose_content.replace("network_mode: \"host\"", "");

        // NOTE: Do NOT force-replace image tags. Docker already defaults to :latest
        // when no tag is specified. Replacing breaks explicit tags like nginx:alpine,
        // duplicating them into nginx:latest:latest and pulling the wrong image.

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

        // Write .env file (custom or default)
        let env_content = match custom_env {
            Some(ref env) => env.clone(),
            None => format!("AppID={}\nTZ=UTC\nPUID=1000\nPGID=1000\n", id),
        };
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

        // Fix permissions using native Rust fs calls (O(1) — no docker run needed)
        set_permissions_recursive(std::path::Path::new(&app_dir));

        // Phase 2: Pull images with parallel layer downloads (10% -> 60%)
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
            .stdout(std::process::Stdio::null())
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
                            pull_progress = (pull_progress + 3).min(58);
                        } else if line.contains("Extracting") {
                            pull_progress = (pull_progress + 1).min(55);
                        } else if line.contains("Pulling") || line.contains("Downloading") {
                            pull_progress = (pull_progress + 1).min(45);
                        }
                        let formatted = format!("[PULL] {}", line);
                        let mut tasks = INSTALL_TASKS.write().unwrap();
                        if let Some(task) = tasks.get_mut(&task_id_clone) {
                            task.progress = pull_progress;
                            let is_progress = line.contains("Extracting") || line.contains("Downloading") || line.contains('%') || line.contains("MB/");
                            let should_replace = is_progress && task.logs.last().map(|l| l.starts_with("[PULL]") && (l.contains("Extracting") || l.contains("Downloading"))).unwrap_or(false);
                            if should_replace {
                                if let Some(last) = task.logs.last_mut() {
                                    *last = formatted;
                                }
                            } else {
                                task.logs.push(formatted);
                                if task.logs.len() > 200 { task.logs.remove(0); }
                            }
                        }
                    }
                }
            }
            let pull_status = child.wait().await;
            match pull_status {
                Ok(status) if !status.success() => {
                    let mut tasks = INSTALL_TASKS.write().unwrap();
                    if let Some(task) = tasks.get_mut(&task_id_clone) {
                        task.status = "error".to_string();
                        task.error = Some(format!("docker compose pull exited with error code: {}", status));
                        task.logs.push(format!("[ERROR] Falha ao baixar imagens Docker (código: {})", status));
                    }
                    return;
                }
                Err(e) => {
                    let mut tasks = INSTALL_TASKS.write().unwrap();
                    if let Some(task) = tasks.get_mut(&task_id_clone) {
                        task.status = "error".to_string();
                        task.error = Some(format!("Failed to wait for pull: {}", e));
                        task.logs.push(format!("[ERROR] Erro no processo de download: {}", e));
                    }
                    return;
                }
                _ => {}
            }
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
            .stdout(std::process::Stdio::null())
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

/// Async non-blocking update for App Store apps.
/// Returns a task_id immediately (HTTP 202) so the frontend can poll progress
/// without blocking the connection for the entire pull+restart duration.
pub async fn update_app(Path(id): Path<String>) -> impl IntoResponse {
    let app_dir = format!("data/apps/{}", id);

    if !std::path::Path::new(&app_dir).exists() {
        return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "App directory not found"}))).into_response();
    }

    let task_id = uuid::Uuid::new_v4().to_string();
    {
        let mut tasks = INSTALL_TASKS.write().unwrap();
        tasks.insert(task_id.clone(), InstallTask {
            id: task_id.clone(),
            status: "pulling".to_string(),
            progress: 5,
            logs: vec![format!("[INFO] Starting update for app: {}", id)],
            error: None,
        });
    }

    let task_id_clone = task_id.clone();
    tokio::spawn(async move {
        // Phase 1: docker compose pull --parallel
        {
            let mut tasks = INSTALL_TASKS.write().unwrap();
            if let Some(task) = tasks.get_mut(&task_id_clone) {
                task.progress = 10;
                task.logs.push("[INFO] Pulling updated images (parallel)...".to_string());
            }
        }

        let pull_spawn = Command::new("docker")
            .arg("compose")
            .arg("pull")
            .current_dir(&app_dir)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::piped())
            .spawn();

        let pull_ok = match pull_spawn {
            Ok(mut child) => {
                if let Some(stderr) = child.stderr.take() {
                    let mut reader = tokio::io::BufReader::new(stderr).lines();
                    let mut pull_progress: u8 = 10;
                    while let Ok(Some(line)) = reader.next_line().await {
                        if !line.trim().is_empty() {
                            if line.contains("Pull complete") || line.contains("Already exists") {
                                pull_progress = (pull_progress + 3).min(58);
                            } else if line.contains("Extracting") {
                                pull_progress = (pull_progress + 1).min(55);
                            } else if line.contains("Pulling") || line.contains("Downloading") {
                                pull_progress = (pull_progress + 1).min(45);
                            }
                            let formatted = format!("[PULL] {}", line);
                            let mut tasks = INSTALL_TASKS.write().unwrap();
                            if let Some(task) = tasks.get_mut(&task_id_clone) {
                                task.progress = pull_progress;
                                let is_progress = line.contains("Extracting") || line.contains("Downloading") || line.contains('%') || line.contains("MB/");
                                let should_replace = is_progress && task.logs.last().map(|l| l.starts_with("[PULL]") && (l.contains("Extracting") || l.contains("Downloading"))).unwrap_or(false);
                                if should_replace {
                                    if let Some(last) = task.logs.last_mut() {
                                        *last = formatted;
                                    }
                                } else {
                                    task.logs.push(formatted);
                                    if task.logs.len() > 200 { task.logs.remove(0); }
                                }
                            }
                        }
                    }
                }
                child.wait().await.map(|s| s.success()).unwrap_or(false)
            }
            Err(e) => {
                let mut tasks = INSTALL_TASKS.write().unwrap();
                if let Some(task) = tasks.get_mut(&task_id_clone) {
                    task.status = "error".to_string();
                    task.error = Some(format!("Failed to start docker compose pull: {}", e));
                }
                return;
            }
        };

        if !pull_ok {
            let mut tasks = INSTALL_TASKS.write().unwrap();
            if let Some(task) = tasks.get_mut(&task_id_clone) {
                task.status = "error".to_string();
                task.error = Some("docker compose pull failed".to_string());
            }
            return;
        }

        // Phase 2: docker compose up -d
        {
            let mut tasks = INSTALL_TASKS.write().unwrap();
            if let Some(task) = tasks.get_mut(&task_id_clone) {
                task.status = "installing".to_string();
                task.progress = 60;
                task.logs.push("[INFO] Restarting containers with updated images...".to_string());
            }
        }

        let up_spawn = Command::new("docker")
            .arg("compose")
            .arg("up")
            .arg("-d")
            .current_dir(&app_dir)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::piped())
            .spawn();

        match up_spawn {
            Ok(mut child) => {
                if let Some(stderr) = child.stderr.take() {
                    let mut reader = tokio::io::BufReader::new(stderr).lines();
                    let mut up_progress: u8 = 60;
                    while let Ok(Some(line)) = reader.next_line().await {
                        if !line.trim().is_empty() {
                            if line.contains("Started") || line.contains("Created") || line.contains("Running") {
                                up_progress = (up_progress + 10).min(95);
                            }
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
                            task.logs.push("[INFO] App updated successfully!".to_string());
                        }
                    }
                    Ok(status) => {
                        let mut tasks = INSTALL_TASKS.write().unwrap();
                        if let Some(task) = tasks.get_mut(&task_id_clone) {
                            task.status = "error".to_string();
                            task.error = Some(format!("docker compose up exited with: {}", status));
                        }
                    }
                    Err(e) => {
                        let mut tasks = INSTALL_TASKS.write().unwrap();
                        if let Some(task) = tasks.get_mut(&task_id_clone) {
                            task.status = "error".to_string();
                            task.error = Some(format!("Process error: {}", e));
                        }
                    }
                }
            }
            Err(e) => {
                let mut tasks = INSTALL_TASKS.write().unwrap();
                if let Some(task) = tasks.get_mut(&task_id_clone) {
                    task.status = "error".to_string();
                    task.error = Some(format!("Failed to start docker compose up: {}", e));
                }
            }
        }
    });

    (StatusCode::ACCEPTED, Json(serde_json::json!({ "task_id": task_id }))).into_response()
}

pub async fn inspect_app_config(Path(id): Path<String>) -> impl IntoResponse {
    let app = {
        let cache = APPS_CACHE.read().unwrap();
        match cache.iter().find(|a| a.id == id) {
            Some(a) => a.clone(),
            None => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "App not found"}))).into_response(),
        }
    };

    let (ports, volumes, env) = extract_compose_config(&app.compose_file, &id);
    let inspection = super::types::AppConfigInspection {
        id: app.id,
        name: app.name,
        ports,
        volumes,
        env,
        raw_compose: app.compose_file,
    };

    (StatusCode::OK, Json(inspection)).into_response()
}

pub fn extract_compose_config(raw_compose: &str, _app_id: &str) -> (Vec<PortMapping>, Vec<VolumeMapping>, HashMap<String, String>) {
    let mut ports = Vec::new();
    let mut volumes = Vec::new();
    let mut env = HashMap::new();

    env.insert("TZ".to_string(), "UTC".to_string());
    env.insert("PUID".to_string(), "1000".to_string());
    env.insert("PGID".to_string(), "1000".to_string());

    if let Ok(parsed) = serde_yaml::from_str::<Value>(raw_compose) {
        if let Some(services) = parsed.get("services").and_then(|s| s.as_mapping()) {
            for (_, service) in services {
                // Ports
                if let Some(p_seq) = service.get("ports").and_then(|p| p.as_sequence()) {
                    for p in p_seq {
                        if let Some(p_str) = p.as_str() {
                            let mut proto = "tcp".to_string();
                            let clean_str = if let Some((head, pr)) = p_str.split_once('/') {
                                proto = pr.to_lowercase();
                                head
                            } else {
                                p_str
                            };
                            let parts: Vec<&str> = clean_str.split(':').collect();
                            if parts.len() == 2 {
                                if let (Ok(h), Ok(c)) = (parts[0].parse::<u16>(), parts[1].parse::<u16>()) {
                                    if !ports.iter().any(|existing: &PortMapping| existing.host == h && existing.container == c) {
                                        ports.push(PortMapping { host: h, container: c, protocol: proto });
                                    }
                                }
                            } else if parts.len() == 1 {
                                if let Ok(c) = parts[0].parse::<u16>() {
                                    ports.push(PortMapping { host: c, container: c, protocol: proto });
                                }
                            }
                        } else if let Some(p_num) = p.as_u64() {
                            let c = p_num as u16;
                            ports.push(PortMapping { host: c, container: c, protocol: "tcp".to_string() });
                        }
                    }
                }

                // Volumes
                if let Some(v_seq) = service.get("volumes").and_then(|v| v.as_sequence()) {
                    for v in v_seq {
                        if let Some(v_str) = v.as_str() {
                            let parts: Vec<&str> = v_str.split(':').collect();
                            if parts.len() >= 2 {
                                let h = parts[0].to_string();
                                let c = parts[1].to_string();
                                if !volumes.iter().any(|existing: &VolumeMapping| existing.container == c) {
                                    volumes.push(VolumeMapping { host: h, container: c });
                                }
                            }
                        }
                    }
                }

                // Environment
                if let Some(e_val) = service.get("environment") {
                    if let Some(e_seq) = e_val.as_sequence() {
                        for item in e_seq {
                            if let Some(item_str) = item.as_str() {
                                if let Some((k, v)) = item_str.split_once('=') {
                                    let clean_k = k.trim().to_string();
                                    let clean_v = v.trim().to_string();
                                    if !clean_k.is_empty() {
                                        env.insert(clean_k, clean_v);
                                    }
                                }
                            }
                        }
                    } else if let Some(e_map) = e_val.as_mapping() {
                        for (k, v) in e_map {
                            if let Some(k_str) = k.as_str() {
                                let v_str = match v {
                                    Value::String(s) => s.clone(),
                                    Value::Number(n) => n.to_string(),
                                    Value::Bool(b) => b.to_string(),
                                    _ => "".to_string(),
                                };
                                env.insert(k_str.to_string(), v_str);
                            }
                        }
                    }
                }
            }
        }
    }

    (ports, volumes, env)
}

pub fn apply_custom_config(
    raw_compose: &str,
    payload: &CustomInstallPayload,
    app_id: &str,
) -> (String, String) {
    let mut compose = raw_compose.to_string();

    // 1. Port overrides
    if let Some(ref ports) = payload.ports {
        for p in ports {
            let pattern = format!(r#"(?m)(^\s*-\s*["']?)\d+:({})(?:/([a-z]+))?(["']?\s*$)"#, p.container);
            if let Ok(re) = regex::Regex::new(&pattern) {
                compose = re.replace_all(&compose, |caps: &regex::Captures| {
                    let prefix = caps.get(1).map_or("", |m| m.as_str());
                    let proto = caps.get(3).map_or("", |m| m.as_str());
                    let suffix = caps.get(4).map_or("", |m| m.as_str());
                    if proto.is_empty() {
                        format!("{}{}:{}{}", prefix, p.host, p.container, suffix)
                    } else {
                        format!("{}{}:{}/{}{}", prefix, p.host, p.container, proto, suffix)
                    }
                }).to_string();
            }
        }
    }

    // 2. Volume overrides
    if let Some(ref vols) = payload.volumes {
        for v in vols {
            let pattern = format!(r#"(?m)(^\s*-\s*["']?)(?:[^:\s"']+):({})(?::([a-zA-Z0-9_-]+))?(["']?\s*$)"#, regex::escape(&v.container));
            if let Ok(re) = regex::Regex::new(&pattern) {
                compose = re.replace_all(&compose, |caps: &regex::Captures| {
                    let prefix = caps.get(1).map_or("", |m| m.as_str());
                    let mode = caps.get(3).map_or("", |m| m.as_str());
                    let suffix = caps.get(4).map_or("", |m| m.as_str());
                    if mode.is_empty() {
                        format!("{}{}:{}{}", prefix, v.host, v.container, suffix)
                    } else {
                        format!("{}{}:{}:{}{}", prefix, v.host, v.container, mode, suffix)
                    }
                }).to_string();
            }
        }
    }

    // 3. Environment to .env
    let mut env_map = HashMap::new();
    env_map.insert("AppID".to_string(), app_id.to_string());
    env_map.insert("TZ".to_string(), "UTC".to_string());
    env_map.insert("PUID".to_string(), "1000".to_string());
    env_map.insert("PGID".to_string(), "1000".to_string());

    if let Some(ref user_env) = payload.env {
        for (k, v) in user_env {
            env_map.insert(k.clone(), v.clone());
        }
    }

    let mut env_lines = Vec::new();
    for (k, v) in env_map {
        env_lines.push(format!("{}={}", k, v));
    }
    env_lines.sort();
    let env_content = env_lines.join("\n") + "\n";

    (compose, env_content)
}

pub async fn install_custom_app(
    Path(id): Path<String>,
    Json(payload): Json<CustomInstallPayload>,
) -> impl IntoResponse {
    let app = {
        let cache = APPS_CACHE.read().unwrap();
        match cache.iter().find(|a| a.id == id) {
            Some(a) => a.clone(),
            None => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "App not found"}))).into_response(),
        }
    };

    let task_id = uuid::Uuid::new_v4().to_string();
    {
        let mut tasks = INSTALL_TASKS.write().unwrap();
        tasks.insert(task_id.clone(), InstallTask {
            id: task_id.clone(),
            status: "starting".to_string(),
            progress: 0,
            logs: vec![format!("[INFO] Iniciando instalação personalizada de {}", app.name)],
            error: None,
        });
    }

    let (custom_compose, custom_env) = apply_custom_config(&app.compose_file, &payload, &id);
    let task_id_clone = task_id.clone();
    spawn_compose_installation_with_env(id, custom_compose, Some(custom_env), task_id_clone);

    (StatusCode::ACCEPTED, Json(serde_json::json!({ "task_id": task_id }))).into_response()
}

pub async fn install_status(Path(task_id): Path<String>) -> impl IntoResponse {
    let tasks = INSTALL_TASKS.read().unwrap();
    match tasks.get(&task_id) {
        Some(task) => (StatusCode::OK, Json(task.clone())).into_response(),
        None => (StatusCode::NOT_FOUND, "Task not found").into_response(),
    }
}

pub async fn active_install_tasks() -> impl IntoResponse {
    let tasks = INSTALL_TASKS.read().unwrap();
    let list: Vec<InstallTask> = tasks.values().cloned().collect();
    (StatusCode::OK, Json(list)).into_response()
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

