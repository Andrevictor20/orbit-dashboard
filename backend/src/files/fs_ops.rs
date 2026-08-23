use axum::{
    extract::Query,
    http::StatusCode,
    Json,
};
use std::fs::{self, File};
use std::path::Path;
use super::path_utils::{get_mime_type, sanitize_path, to_display_path};
use super::types::{
    CopyMoveRequest, CreateFileRequest, DeleteRequest, FileItem, ListFilesQuery, ListFilesResponse,
    MkdirRequest, RenameRequest,
};

pub async fn list_files(Query(q): Query<ListFilesQuery>) -> Result<Json<ListFilesResponse>, StatusCode> {
    let target_dir = q.path.as_deref().unwrap_or("/");
    let path = sanitize_path(target_dir)?;

    if !path.exists() {
        return Err(StatusCode::NOT_FOUND);
    }

    let entries = match fs::read_dir(&path) {
        Ok(e) => e,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let mut items: Vec<FileItem> = Vec::new();

    for entry in entries.flatten() {
        let meta = entry.metadata().ok();
        let name = entry.file_name().to_string_lossy().to_string();
        let is_hidden = name.starts_with('.');
        let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        
        let modified = meta.and_then(|m| m.modified().ok())
            .map(|t| {
                let dur = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                time::OffsetDateTime::from_unix_timestamp(dur.as_secs() as i64)
                    .map(|dt| dt.format(&time::format_description::well_known::Rfc3339).unwrap_or_default())
                    .unwrap_or_default()
            })
            .unwrap_or_default();

        let p = entry.path();
        let extension = p.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        let mime_type = if is_dir {
            "inode/directory".to_string()
        } else {
            get_mime_type(&extension).to_string()
        };

        items.push(FileItem {
            name,
            path: to_display_path(&p),
            is_dir,
            size,
            modified,
            extension,
            mime_type,
            is_hidden,
        });
    }

    // Sort: directories first, then alphabetical by name or size
    let sort_by = q.sort.as_deref().unwrap_or("name");
    let is_desc = q.order.as_deref().unwrap_or("asc") == "desc";

    items.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            return b.is_dir.cmp(&a.is_dir);
        }
        let ord = match sort_by {
            "size" => a.size.cmp(&b.size),
            "modified" => a.modified.cmp(&b.modified),
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        };
        if is_desc { ord.reverse() } else { ord }
    });

    let total_items = items.len();
    if let (Some(page), Some(limit)) = (q.page, q.limit) {
        if limit > 0 && page > 0 {
            let start = (page - 1) * limit;
            if start < items.len() {
                let end = (start + limit).min(items.len());
                items = items[start..end].to_vec();
            } else {
                items.clear();
            }
        }
    }

    Ok(Json(ListFilesResponse {
        current_path: to_display_path(&path),
        items,
        total_items,
    }))
}

pub async fn mkdir(Json(req): Json<MkdirRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let path = sanitize_path(&req.path)?;
    if path.exists() {
        return Err(StatusCode::CONFLICT);
    }
    fs::create_dir_all(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn create_file(Json(req): Json<CreateFileRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let path = sanitize_path(&req.path)?;
    if path.exists() {
        return Err(StatusCode::CONFLICT);
    }
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    File::create(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn rename_file(Json(req): Json<RenameRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let old_p = sanitize_path(&req.old_path)?;
    let new_p = sanitize_path(&req.new_path)?;
    if !old_p.exists() {
        return Err(StatusCode::NOT_FOUND);
    }
    fs::rename(&old_p, &new_p).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "success": true })))
}

pub fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}

pub async fn copy_file(Json(req): Json<CopyMoveRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let src = sanitize_path(&req.source)?;
    let dst = sanitize_path(&req.destination)?;
    if !src.exists() {
        return Err(StatusCode::NOT_FOUND);
    }
    if src.is_dir() {
        copy_dir_all(&src, &dst).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    } else {
        if let Some(parent) = dst.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::copy(&src, &dst).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn move_file(Json(req): Json<CopyMoveRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let src = sanitize_path(&req.source)?;
    let dst = sanitize_path(&req.destination)?;
    if !src.exists() {
        return Err(StatusCode::NOT_FOUND);
    }
    if let Some(parent) = dst.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if fs::rename(&src, &dst).is_err() {
        // Fallback for cross-device moves
        if src.is_dir() {
            copy_dir_all(&src, &dst).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            fs::remove_dir_all(&src).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        } else {
            fs::copy(&src, &dst).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            fs::remove_file(&src).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        }
    }
    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn delete_files(Json(req): Json<DeleteRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    for p_str in &req.paths {
        let path = sanitize_path(p_str)?;
        if path.exists() {
            if path.is_dir() {
                let _ = fs::remove_dir_all(&path);
            } else {
                let _ = fs::remove_file(&path);
            }
        }
    }
    Ok(Json(serde_json::json!({ "success": true })))
}
