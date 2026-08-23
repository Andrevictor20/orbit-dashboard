use axum::{
    extract::Query,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use std::fs::{self, File};
use std::io::Read;
use super::path_utils::{get_mime_type, sanitize_path};
use super::types::{DownloadQuery, FileContentQuery, FileContentResponse, UpdateContentRequest};

pub async fn get_file_content(Query(q): Query<FileContentQuery>) -> Result<Json<FileContentResponse>, StatusCode> {
    let path = sanitize_path(&q.path)?;
    if !path.exists() || path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let meta = path.metadata().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if meta.len() > 10 * 1024 * 1024 {
        // > 10MB limit for text editor
        return Err(StatusCode::PAYLOAD_TOO_LARGE);
    }

    let content = fs::read_to_string(&path).map_err(|_| StatusCode::BAD_REQUEST)?;

    Ok(Json(FileContentResponse {
        path: path.to_string_lossy().to_string(),
        content,
        size: meta.len(),
    }))
}

pub async fn update_file_content(Json(req): Json<UpdateContentRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let path = sanitize_path(&req.path)?;
    if !path.exists() || path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    fs::write(&path, req.content.as_bytes()).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn get_raw_file(Query(q): Query<DownloadQuery>) -> Result<Response, StatusCode> {
    let path = sanitize_path(&q.path)?;
    if !path.exists() || path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let mut file = File::open(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let mime = get_mime_type(ext);

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, mime.parse().unwrap());
    headers.insert(header::CONTENT_DISPOSITION, "inline".parse().unwrap());
    headers.insert(header::CONTENT_LENGTH, contents.len().to_string().parse().unwrap());

    Ok((headers, contents).into_response())
}
