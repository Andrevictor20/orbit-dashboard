use axum::{
    http::StatusCode,
    Json,
};
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;
use super::fs_ops::copy_dir_all;
use super::path_utils::sanitize_path;
use super::storage::get_dir_size_recursive;
use super::types::{MoveToTrashRequest, RestoreTrashRequest, TrashItem, TrashListResponse};

pub fn get_trash_dir() -> PathBuf {
    let candidate = PathBuf::from("/app/data/.trash");
    if fs::create_dir_all(&candidate).is_ok() {
        candidate
    } else {
        let fallback = std::env::temp_dir().join("orbit_trash");
        let _ = fs::create_dir_all(&fallback);
        fallback
    }
}

pub fn get_trash_metadata_file() -> PathBuf {
    get_trash_dir().join("trash_metadata.json")
}

pub fn load_trash_items() -> Vec<TrashItem> {
    let file = get_trash_metadata_file();
    if let Ok(content) = fs::read_to_string(&file) {
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    }
}

pub fn save_trash_items(items: &[TrashItem]) {
    let file = get_trash_metadata_file();
    if let Ok(content) = serde_json::to_string_pretty(items) {
        let _ = fs::write(&file, content);
    }
}

pub async fn list_trash() -> Json<TrashListResponse> {
    let items = load_trash_items();
    let total_size = items.iter().map(|i| i.size).sum();
    Json(TrashListResponse { items, total_size })
}

pub fn move_path_or_copy(src: &Path, dst: &Path) -> std::io::Result<()> {
    if let Some(parent) = dst.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if fs::rename(src, dst).is_err() {
        if src.is_dir() {
            copy_dir_all(src, dst)?;
            let _ = fs::remove_dir_all(src);
        } else {
            fs::copy(src, dst)?;
            let _ = fs::remove_file(src);
        }
    }
    Ok(())
}

pub async fn move_to_trash(Json(req): Json<MoveToTrashRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let trash_dir = get_trash_dir();
    let mut items = load_trash_items();
    let now = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default();

    for p in &req.paths {
        let src = sanitize_path(p)?;
        if !src.exists() {
            continue;
        }

        let meta = src.metadata().ok();
        let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size = if is_dir { get_dir_size_recursive(&src) } else { meta.map(|m| m.len()).unwrap_or(0) };
        let file_name = src.file_name().unwrap_or_default().to_string_lossy().to_string();
        let id = Uuid::new_v4().to_string();
        let trash_target = trash_dir.join(format!("{}_{}", id, file_name));

        if move_path_or_copy(&src, &trash_target).is_ok() {
            items.push(TrashItem {
                id,
                name: file_name,
                original_path: p.clone(),
                trash_path: trash_target.to_string_lossy().to_string(),
                is_dir,
                size,
                deleted_at: now.clone(),
            });
        }
    }

    save_trash_items(&items);
    Ok(Json(serde_json::json!({ "success": true, "count": req.paths.len() })))
}

pub async fn restore_trash(Json(req): Json<RestoreTrashRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut items = load_trash_items();
    let mut restored_count = 0;

    for id in &req.ids {
        if let Some(pos) = items.iter().position(|i| &i.id == id) {
            let item = items.remove(pos);
            let trash_path = PathBuf::from(&item.trash_path);
            let original_path = match sanitize_path(&item.original_path) {
                Ok(p) => p,
                Err(_) => continue,
            };

            if move_path_or_copy(&trash_path, &original_path).is_ok() {
                restored_count += 1;
            }
        }
    }

    save_trash_items(&items);
    Ok(Json(serde_json::json!({ "success": true, "restored": restored_count })))
}

pub async fn empty_trash() -> Result<Json<serde_json::Value>, StatusCode> {
    let trash_dir = get_trash_dir();
    let items = load_trash_items();

    for item in items {
        let p = PathBuf::from(&item.trash_path);
        if p.is_dir() {
            let _ = fs::remove_dir_all(&p);
        } else if p.exists() {
            let _ = fs::remove_file(&p);
        }
    }

    save_trash_items(&[]);
    let _ = fs::remove_file(get_trash_metadata_file());
    let _ = fs::remove_dir_all(&trash_dir);
    let _ = fs::create_dir_all(&trash_dir);

    Ok(Json(serde_json::json!({ "success": true })))
}
