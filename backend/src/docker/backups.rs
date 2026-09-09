use axum::{
    extract::{Multipart, Path as AxumPath},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use tokio::process::Command;
use tracing::{error, info};

pub static BACKUP_MUTEX: Lazy<tokio::sync::Mutex<()>> = Lazy::new(|| tokio::sync::Mutex::new(()));

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct BackupItem {
    pub id: String,
    pub app_id: String,
    pub app_name: String,
    pub filename: String,
    pub size_bytes: u64,
    pub created_at: String,
    pub status: String,      // "completed", "failed", "in_progress"
    pub backup_type: String, // "manual", "scheduled"
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct BackupScheduleConfig {
    pub enabled: bool,
    pub frequency: String, // "daily", "weekly"
    pub hour: u32,
    pub minute: u32,
    pub retention_count: usize, // e.g. 5
    pub target_apps: Vec<String>, // list of app_ids, empty means all installed
}

impl Default for BackupScheduleConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            frequency: "daily".to_string(),
            hour: 3,
            minute: 0,
            retention_count: 5,
            target_apps: Vec::new(),
        }
    }
}

#[derive(Deserialize)]
pub struct CreateBackupPayload {
    pub app_id: String,
    pub stop_container: Option<bool>,
}

#[derive(Serialize)]
pub struct BackupStats {
    pub total_backups: usize,
    pub total_bytes: u64,
    pub last_backup_date: Option<String>,
    pub schedule_enabled: bool,
}

pub fn get_backups_dir() -> PathBuf {
    let candidate = PathBuf::from("data/backups");
    let _ = fs::create_dir_all(&candidate);
    candidate
}

pub fn get_index_path() -> PathBuf {
    get_backups_dir().join("index.json")
}

pub fn get_schedule_path() -> PathBuf {
    get_backups_dir().join("schedule.json")
}

pub fn load_backup_index() -> Vec<BackupItem> {
    let path = get_index_path();
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(items) = serde_json::from_str::<Vec<BackupItem>>(&content) {
            // Filter out items whose physical file no longer exists
            let dir = get_backups_dir();
            return items
                .into_iter()
                .filter(|b| dir.join(&b.filename).exists())
                .collect();
        }
    }
    Vec::new()
}

pub fn save_backup_index(items: &[BackupItem]) {
    let path = get_index_path();
    if let Ok(content) = serde_json::to_string_pretty(items) {
        let _ = fs::write(&path, content);
    }
}

pub fn load_schedule_config() -> BackupScheduleConfig {
    let path = get_schedule_path();
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(config) = serde_json::from_str::<BackupScheduleConfig>(&content) {
            return config;
        }
    }
    BackupScheduleConfig::default()
}

pub fn save_schedule_config_internal(config: &BackupScheduleConfig) {
    let path = get_schedule_path();
    if let Ok(content) = serde_json::to_string_pretty(config) {
        let _ = fs::write(&path, content);
    }
}

pub async fn list_backups_handler() -> impl IntoResponse {
    let backups = load_backup_index();
    (StatusCode::OK, Json(backups))
}

pub async fn get_backup_stats_handler() -> impl IntoResponse {
    let backups = load_backup_index();
    let schedule = load_schedule_config();

    let total_bytes: u64 = backups.iter().map(|b| b.size_bytes).sum();
    let last_backup_date = backups
        .iter()
        .max_by_key(|b| &b.created_at)
        .map(|b| b.created_at.clone());

    let stats = BackupStats {
        total_backups: backups.len(),
        total_bytes,
        last_backup_date,
        schedule_enabled: schedule.enabled,
    };

    (StatusCode::OK, Json(stats))
}

pub async fn create_backup_handler(
    Json(payload): Json<CreateBackupPayload>,
) -> Result<Json<BackupItem>, (StatusCode, Json<serde_json::Value>)> {
    let _lock = BACKUP_MUTEX.lock().await;

    let app_id = payload.app_id.trim().replace("..", "").replace('/', "-");
    let app_dir = PathBuf::from("data/apps").join(&app_id);

    if !app_dir.exists() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Pasta do aplicativo não encontrada" })),
        ));
    }

    let stop = payload.stop_container.unwrap_or(true);
    let now = time::OffsetDateTime::now_utc();
    let timestamp_str = now
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default();
    let file_suffix = now
        .format(&time::macros::format_description!(
            "[year][month][day]_[hour][minute][second]"
        ))
        .unwrap_or_else(|_| "backup".to_string());

    let filename = format!("backup_{}_{}.tar.gz", app_id, file_suffix);
    let backup_dir = get_backups_dir();
    let backup_path = backup_dir.join(&filename);

    info!("Iniciando criação de backup para {} em {}", app_id, backup_path.display());

    // 1. Parada temporária se solicitada para consistência
    if stop {
        let _ = Command::new("docker")
            .arg("compose")
            .arg("stop")
            .current_dir(&app_dir)
            .output()
            .await;
    }

    // 2. Compactação tar.gz da pasta do app
    let tar_result = Command::new("tar")
        .args(["-czf", backup_path.to_str().unwrap_or(""), "-C", "data/apps", &app_id])
        .output()
        .await;

    // 3. Reiniciar stack se foi parada
    if stop {
        let _ = Command::new("docker")
            .arg("compose")
            .arg("start")
            .current_dir(&app_dir)
            .output()
            .await;
    }

    match tar_result {
        Ok(output) if output.status.success() => {
            let size = backup_path.metadata().map(|m| m.len()).unwrap_or(0);
            let backup_item = BackupItem {
                id: uuid::Uuid::new_v4().to_string(),
                app_id: app_id.clone(),
                app_name: app_id.clone(),
                filename: filename.clone(),
                size_bytes: size,
                created_at: timestamp_str,
                status: "completed".to_string(),
                backup_type: "manual".to_string(),
            };

            let mut current = load_backup_index();
            current.insert(0, backup_item.clone());

            // Enforce retention policy
            let config = load_schedule_config();
            prune_retention(&mut current, &app_id, config.retention_count);
            save_backup_index(&current);

            info!("Backup concluído com sucesso para {}: {} bytes", app_id, size);
            Ok(Json(backup_item))
        }
        Ok(output) => {
            let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
            error!("Falha ao gerar arquivo tar: {}", err_msg);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Falha no tar: {}", err_msg) })),
            ))
        }
        Err(e) => {
            error!("Erro ao executar comando tar: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Erro ao executar tar: {}", e) })),
            ))
        }
    }
}

pub fn prune_retention(items: &mut Vec<BackupItem>, app_id: &str, retention: usize) {
    if retention == 0 {
        return;
    }
    let mut count = 0;
    let dir = get_backups_dir();

    items.retain(|item| {
        if item.app_id == app_id {
            count += 1;
            if count > retention {
                let path = dir.join(&item.filename);
                let _ = fs::remove_file(path);
                false
            } else {
                true
            }
        } else {
            true
        }
    });
}

pub async fn restore_backup_handler(
    AxumPath(id): AxumPath<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let _lock = BACKUP_MUTEX.lock().await;

    let items = load_backup_index();
    let backup = match items.into_iter().find(|b| b.id == id) {
        Some(b) => b,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Backup não encontrado" })),
            ))
        }
    };

    let backup_path = get_backups_dir().join(&backup.filename);
    if !backup_path.exists() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Arquivo físico de backup ausente" })),
        ));
    }

    let app_dir = PathBuf::from("data/apps").join(&backup.app_id);

    info!("Restaurando backup {} para aplicativo {}", backup.filename, backup.app_id);

    // 1. Parar e descer contêineres se a pasta existir
    if app_dir.exists() {
        let _ = Command::new("docker")
            .arg("compose")
            .arg("down")
            .current_dir(&app_dir)
            .output()
            .await;
    }

    // 2. Descompactar tar.gz sobre data/apps
    let extract_output = Command::new("tar")
        .args(["-xzf", backup_path.to_str().unwrap_or(""), "-C", "data/apps"])
        .output()
        .await;

    match extract_output {
        Ok(out) if out.status.success() => {
            // 3. Subir a stack restaurada
            let up_output = Command::new("docker")
                .args(["compose", "up", "-d"])
                .current_dir(&app_dir)
                .output()
                .await;

            let up_status = up_output.map(|o| o.status.success()).unwrap_or(false);
            info!("Restauração do app {} concluída. docker compose up: {}", backup.app_id, up_status);

            Ok(Json(serde_json::json!({
                "success": true,
                "app_id": backup.app_id,
                "restarted": up_status
            })))
        }
        Ok(out) => {
            let err = String::from_utf8_lossy(&out.stderr);
            error!("Erro ao extrair tar no restore: {}", err);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Falha ao extrair backup: {}", err) })),
            ))
        }
        Err(e) => {
            error!("Erro ao chamar tar no restore: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Erro ao executar tar: {}", e) })),
            ))
        }
    }
}

pub async fn delete_backup_handler(AxumPath(id): AxumPath<String>) -> impl IntoResponse {
    let mut items = load_backup_index();
    let dir = get_backups_dir();

    if let Some(pos) = items.iter().position(|b| b.id == id) {
        let removed = items.remove(pos);
        let path = dir.join(&removed.filename);
        let _ = fs::remove_file(path);
        save_backup_index(&items);
        (StatusCode::OK, Json(serde_json::json!({ "success": true })))
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Backup não encontrado" })),
        )
    }
}

pub async fn download_backup_handler(AxumPath(id): AxumPath<String>) -> Result<Response, StatusCode> {
    let items = load_backup_index();
    let backup = items.into_iter().find(|b| b.id == id).ok_or(StatusCode::NOT_FOUND)?;
    let file_path = get_backups_dir().join(&backup.filename);

    if !file_path.exists() {
        return Err(StatusCode::NOT_FOUND);
    }

    let mut file = File::open(&file_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        "application/gzip".parse().unwrap(),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        format!("attachment; filename=\"{}\"", backup.filename)
            .parse()
            .unwrap(),
    );
    headers.insert(
        header::CONTENT_LENGTH,
        contents.len().to_string().parse().unwrap(),
    );

    Ok((headers, contents).into_response())
}

pub async fn upload_backup_handler(mut multipart: Multipart) -> Result<Json<BackupItem>, StatusCode> {
    let dir = get_backups_dir();
    let mut uploaded_filename = String::new();
    let mut app_id = "uploaded-app".to_string();

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            let original_name = field.file_name().unwrap_or("backup.tar.gz").to_string();
            let safe_name = original_name.replace("..", "").replace('/', "");
            
            // Extract app_id from backup_<app_id>_<timestamp>.tar.gz if possible
            if safe_name.starts_with("backup_") {
                let parts: Vec<&str> = safe_name.split('_').collect();
                if parts.len() >= 2 {
                    app_id = parts[1].to_string();
                }
            }

            let dest_path = dir.join(&safe_name);
            let data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;

            let mut f = File::create(&dest_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            f.write_all(&data).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            uploaded_filename = safe_name;
            break;
        }
    }

    if uploaded_filename.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let full_path = dir.join(&uploaded_filename);
    let size = full_path.metadata().map(|m| m.len()).unwrap_or(0);
    let now = time::OffsetDateTime::now_utc();
    let timestamp_str = now
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default();

    let backup_item = BackupItem {
        id: uuid::Uuid::new_v4().to_string(),
        app_id: app_id.clone(),
        app_name: app_id,
        filename: uploaded_filename,
        size_bytes: size,
        created_at: timestamp_str,
        status: "completed".to_string(),
        backup_type: "manual".to_string(),
    };

    let mut current = load_backup_index();
    current.insert(0, backup_item.clone());
    save_backup_index(&current);

    Ok(Json(backup_item))
}

pub async fn get_schedule_handler() -> impl IntoResponse {
    let config = load_schedule_config();
    (StatusCode::OK, Json(config))
}

pub async fn save_schedule_handler(
    Json(config): Json<BackupScheduleConfig>,
) -> impl IntoResponse {
    save_schedule_config_internal(&config);
    (StatusCode::OK, Json(serde_json::json!({ "success": true })))
}

pub fn start_backup_scheduler() {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
        let mut last_executed_day = None;

        loop {
            interval.tick().await;

            let config = load_schedule_config();
            if !config.enabled {
                continue;
            }

            let now = time::OffsetDateTime::now_utc();
            let current_day = now.date();
            let hour = now.hour() as u32;
            let minute = now.minute() as u32;

            if hour == config.hour && minute == config.minute {
                if last_executed_day == Some(current_day) {
                    continue; // Already ran today
                }

                info!("Disparando rotina de backup agendado ({} apps)", config.target_apps.len());
                last_executed_day = Some(current_day);

                // Determine target apps (either explicit or scan data/apps)
                let apps_to_backup: Vec<String> = if !config.target_apps.is_empty() {
                    config.target_apps.clone()
                } else {
                    let mut detected = Vec::new();
                    if let Ok(entries) = fs::read_dir("data/apps") {
                        for entry in entries.flatten() {
                            if entry.path().is_dir() {
                                detected.push(entry.file_name().to_string_lossy().to_string());
                            }
                        }
                    }
                    detected
                };

                for app in apps_to_backup {
                    let payload = CreateBackupPayload {
                        app_id: app,
                        stop_container: Some(true),
                    };
                    let _ = create_backup_handler(Json(payload)).await;
                }
            }
        }
    });
}
