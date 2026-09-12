use axum::http::StatusCode;
use once_cell::sync::Lazy;
use std::fs;
use std::path::PathBuf;
use tokio::process::Command;
use tracing::{error, info};

use super::models::{BackupItem, BackupScheduleConfig};

pub static BACKUP_MUTEX: Lazy<tokio::sync::Mutex<()>> = Lazy::new(|| tokio::sync::Mutex::new(()));

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

pub async fn create_backup_internal(
    app_id_raw: &str,
    stop: bool,
    backup_type: &str,
) -> Result<BackupItem, (StatusCode, String)> {
    let _lock = BACKUP_MUTEX.lock().await;

    let app_id = app_id_raw.trim().replace("..", "").replace('/', "-");
    let app_dir = PathBuf::from("data/apps").join(&app_id);

    if !app_dir.exists() {
        return Err((
            StatusCode::NOT_FOUND,
            "Pasta do aplicativo não encontrada".to_string(),
        ));
    }

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

    info!(
        "Iniciando criação de backup para {} em {}",
        app_id,
        backup_path.display()
    );

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
        .args([
            "-czf",
            backup_path.to_str().unwrap_or(""),
            "-C",
            "data/apps",
            &app_id,
        ])
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
                backup_type: backup_type.to_string(),
            };

            let mut current = load_backup_index();
            current.insert(0, backup_item.clone());

            // Enforce retention policy
            let config = load_schedule_config();
            prune_retention(&mut current, &app_id, config.retention_count);
            save_backup_index(&current);

            info!("Backup concluído com sucesso para {}: {} bytes", app_id, size);
            Ok(backup_item)
        }
        Ok(output) => {
            let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
            error!("Falha ao gerar arquivo tar: {}", err_msg);
            Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Falha no tar: {}", err_msg)))
        }
        Err(e) => {
            error!("Erro ao executar comando tar: {}", e);
            Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Erro ao executar tar: {}", e)))
        }
    }
}

pub async fn restore_backup_internal(id: &str) -> Result<(String, bool), (StatusCode, String)> {
    let _lock = BACKUP_MUTEX.lock().await;

    let items = load_backup_index();
    let backup = match items.into_iter().find(|b| b.id == id) {
        Some(b) => b,
        None => return Err((StatusCode::NOT_FOUND, "Backup não encontrado".to_string())),
    };

    let backup_path = get_backups_dir().join(&backup.filename);
    if !backup_path.exists() {
        return Err((
            StatusCode::NOT_FOUND,
            "Arquivo físico de backup ausente".to_string(),
        ));
    }

    let app_dir = PathBuf::from("data/apps").join(&backup.app_id);

    info!(
        "Restaurando backup {} para aplicativo {}",
        backup.filename, backup.app_id
    );

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
            info!(
                "Restauração do app {} concluída. docker compose up: {}",
                backup.app_id, up_status
            );

            Ok((backup.app_id, up_status))
        }
        Ok(out) => {
            let err = String::from_utf8_lossy(&out.stderr);
            error!("Erro ao extrair tar no restore: {}", err);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Falha ao extrair backup: {}", err),
            ))
        }
        Err(e) => {
            error!("Erro ao chamar tar no restore: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erro ao executar tar: {}", e),
            ))
        }
    }
}
