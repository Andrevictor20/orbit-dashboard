mod models;
pub mod ops;
pub mod scheduler;

pub use models::*;
pub use ops::*;
pub use scheduler::*;

use axum::{
    extract::{Multipart, Path as AxumPath},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use std::fs::File;
use std::io::{Read, Write};

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
    let stop = payload.stop_container.unwrap_or(true);
    match create_backup_internal(&payload.app_id, stop, "manual").await {
        Ok(item) => Ok(Json(item)),
        Err((code, msg)) => Err((code, Json(serde_json::json!({ "error": msg })))),
    }
}

pub async fn restore_backup_handler(
    AxumPath(id): AxumPath<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match restore_backup_internal(&id).await {
        Ok((app_id, restarted)) => Ok(Json(serde_json::json!({
            "success": true,
            "app_id": app_id,
            "restarted": restarted
        }))),
        Err((code, msg)) => Err((code, Json(serde_json::json!({ "error": msg })))),
    }
}

pub async fn delete_backup_handler(AxumPath(id): AxumPath<String>) -> impl IntoResponse {
    let mut items = load_backup_index();
    let dir = get_backups_dir();

    if let Some(pos) = items.iter().position(|b| b.id == id) {
        let removed = items.remove(pos);
        let path = dir.join(&removed.filename);
        let _ = std::fs::remove_file(path);
        save_backup_index(&items);
        (StatusCode::OK, Json(serde_json::json!({ "success": true })))
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Backup não encontrado" })),
        )
    }
}

pub async fn download_backup_handler(
    AxumPath(id): AxumPath<String>,
) -> Result<Response, StatusCode> {
    let items = load_backup_index();
    let backup = items
        .into_iter()
        .find(|b| b.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;
    let file_path = get_backups_dir().join(&backup.filename);

    if !file_path.exists() {
        return Err(StatusCode::NOT_FOUND);
    }

    let mut file = File::open(&file_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, "application/gzip".parse().unwrap());
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

pub async fn upload_backup_handler(
    mut multipart: Multipart,
) -> Result<Json<BackupItem>, StatusCode> {
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
            f.write_all(&data)
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

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
