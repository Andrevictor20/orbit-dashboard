use axum::{
    extract::Extension,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::RwLock;

use crate::auth::jwt::Claims;

static VISIBILITY_CACHE: RwLock<Option<Vec<String>>> = RwLock::new(None);

fn get_visibility_file_path() -> String {
    std::env::var("SATURN_CONTAINER_VISIBILITY_FILE").unwrap_or_else(|_| {
        let data_dir = crate::system::data_migrator::get_active_data_dir();
        let path = data_dir.join("container_visibility.json");
        path.to_string_lossy().to_string()
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VisibilityConfig {
    #[serde(default)]
    pub hidden_containers: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ToggleVisibilityPayload {
    pub container_id: String,
}

pub fn load_hidden_containers() -> Vec<String> {
    if let Ok(guard) = VISIBILITY_CACHE.read() {
        if let Some(cached) = &*guard {
            return cached.clone();
        }
    }

    let file_path = get_visibility_file_path();
    let hidden = if let Ok(content) = fs::read_to_string(&file_path) {
        if let Ok(config) = serde_json::from_str::<VisibilityConfig>(&content) {
            config.hidden_containers
        } else if let Ok(list) = serde_json::from_str::<Vec<String>>(&content) {
            list
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    if let Ok(mut guard) = VISIBILITY_CACHE.write() {
        *guard = Some(hidden.clone());
    }

    hidden
}

pub fn save_hidden_containers(list: &[String]) -> Result<(), StatusCode> {
    let file_path = get_visibility_file_path();
    if let Some(parent) = Path::new(&file_path).parent() {
        let _ = fs::create_dir_all(parent);
    }

    let config = VisibilityConfig {
        hidden_containers: list.to_vec(),
    };

    let json = serde_json::to_string_pretty(&config).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    fs::write(&file_path, json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Ok(mut guard) = VISIBILITY_CACHE.write() {
        *guard = Some(list.to_vec());
    }

    Ok(())
}

pub fn is_container_hidden(id_or_name: &str) -> bool {
    let hidden = load_hidden_containers();
    let clean_target = id_or_name.trim().trim_start_matches('/');
    hidden.iter().any(|h| {
        let clean_h = h.trim().trim_start_matches('/');
        clean_h.eq_ignore_ascii_case(clean_target)
            || (clean_target.len() >= 12 && clean_h.len() >= 12 && clean_target.starts_with(clean_h))
            || (clean_target.len() >= 12 && clean_h.len() >= 12 && clean_h.starts_with(clean_target))
    })
}

pub fn toggle_container_visibility(id_or_name: &str) -> Result<bool, StatusCode> {
    let mut hidden = load_hidden_containers();
    let clean_target = id_or_name.trim().trim_start_matches('/');

    let pos = hidden.iter().position(|h| {
        let clean_h = h.trim().trim_start_matches('/');
        clean_h.eq_ignore_ascii_case(clean_target)
            || (clean_target.len() >= 12 && clean_h.len() >= 12 && clean_target.starts_with(clean_h))
            || (clean_target.len() >= 12 && clean_h.len() >= 12 && clean_h.starts_with(clean_target))
    });

    let is_now_hidden = if let Some(idx) = pos {
        hidden.remove(idx);
        false
    } else {
        hidden.push(clean_target.to_string());
        true
    };

    save_hidden_containers(&hidden)?;
    Ok(is_now_hidden)
}

pub fn router() -> Router<crate::state::AppState> {
    Router::new()
        .route("/api/docker/visibility", get(get_visibility_handler))
        .route("/api/docker/visibility/toggle", post(toggle_visibility_handler))
}

pub async fn get_visibility_handler(
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<String>>, StatusCode> {
    if claims.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(Json(load_hidden_containers()))
}

pub async fn toggle_visibility_handler(
    Extension(claims): Extension<Claims>,
    Json(payload): Json<ToggleVisibilityPayload>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": "Acesso negado. Apenas administradores podem gerenciar visibilidade." }))));
    }

    match toggle_container_visibility(&payload.container_id) {
        Ok(hidden) => Ok(Json(serde_json::json!({
            "container_id": payload.container_id,
            "hidden": hidden
        }))),
        Err(status) => Err((status, Json(serde_json::json!({ "error": "Falha ao alternar visibilidade do contêiner." })))),
    }
}
