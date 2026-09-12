use axum::{
    extract::Path,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::fs;
use std::path::PathBuf;
use once_cell::sync::Lazy;

#[derive(Serialize, Deserialize)]
pub struct LinkPayload {
    pub url: String,
}

pub type LinksDb = Arc<Mutex<HashMap<String, String>>>;

// OPT-B8: In-memory cache — load once at first access, persist after writes.
// Eliminates disk I/O on every GET /api/docker/links request.
static LINKS_CACHE: Lazy<LinksDb> = Lazy::new(|| {
    let path = get_links_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(links) = serde_json::from_str(&data) {
            return Arc::new(Mutex::new(links));
        }
    }
    Arc::new(Mutex::new(HashMap::new()))
});

pub fn get_links_path() -> PathBuf {
    crate::system::data_migrator::get_active_data_dir().join("custom_links.json")
}

fn save_links_to_disk(db: &LinksDb) {
    let path = get_links_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(guard) = db.lock() {
        if let Ok(json) = serde_json::to_string_pretty(&*guard) {
            let _ = fs::write(path, json);
        }
    }
}

pub async fn get_links() -> impl IntoResponse {
    let links = LINKS_CACHE.lock().unwrap().clone();
    (StatusCode::OK, Json(links))
}

pub async fn set_link(
    Path(id): Path<String>,
    Json(payload): Json<LinkPayload>,
) -> impl IntoResponse {
    {
        let mut guard = LINKS_CACHE.lock().unwrap();
        if payload.url.is_empty() {
            guard.remove(&id);
        } else {
            // Validate URL schema
            if payload.url.starts_with("http://") || payload.url.starts_with("https://") {
                guard.insert(id, payload.url);
            } else {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "error": "Invalid URL schema. Must start with http:// or https://" })),
                ).into_response();
            }
        }
    }
    // Persist to disk after updating in-memory cache
    save_links_to_disk(&LINKS_CACHE);
    (StatusCode::OK, Json(serde_json::json!({ "message": "Link updated" }))).into_response()
}

pub fn update_links_batch(new_links: &HashMap<String, String>) -> usize {
    let mut updated_count = 0;
    {
        let mut guard = LINKS_CACHE.lock().unwrap();
        for (id, url) in new_links {
            if url.starts_with("http://") || url.starts_with("https://") {
                guard.insert(id.clone(), url.clone());
                updated_count += 1;
            }
        }
    }
    if updated_count > 0 {
        save_links_to_disk(&LINKS_CACHE);
    }
    updated_count
}

