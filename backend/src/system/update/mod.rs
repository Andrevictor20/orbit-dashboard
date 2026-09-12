pub mod checker;
pub mod cleaner;
pub mod detector;
pub mod in_place;
pub mod script_generator;

pub use checker::*;
pub use cleaner::*;
pub use in_place::*;

use axum::{http::StatusCode, response::IntoResponse, Json};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::RwLock;
use std::time::{Duration, Instant};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SystemUpdateTask {
    pub status: String, // "idle" | "pulling" | "recreating" | "done" | "error"
    pub progress: u8,   // 0-100
    pub current_step: String,
    pub logs: Vec<String>,
    pub error: Option<String>,
}

pub static UPDATE_CACHE: Lazy<RwLock<Option<(SystemUpdateInfo, Instant)>>> =
    Lazy::new(|| RwLock::new(None));
pub const CACHE_TTL: Duration = Duration::from_secs(30);

pub static SYSTEM_UPDATE_TASK: Lazy<RwLock<SystemUpdateTask>> =
    Lazy::new(|| {
        RwLock::new(SystemUpdateTask {
            status: "idle".to_string(),
            progress: 0,
            current_step: "".to_string(),
            logs: Vec::new(),
            error: None,
        })
    });

pub fn append_task_log(msg: impl Into<String>, progress: Option<u8>, step: Option<&str>) {
    let mut task = match SYSTEM_UPDATE_TASK.write() {
        Ok(g) => g,
        Err(p) => p.into_inner(),
    };
    let msg_str = msg.into();
    tracing::info!("[SystemUpdate] {}", msg_str);
    task.logs.push(msg_str);
    if let Some(p) = progress {
        task.progress = p;
    }
    if let Some(s) = step {
        task.current_step = s.to_string();
    }
}

pub async fn get_update_status_handler() -> impl IntoResponse {
    let task = match SYSTEM_UPDATE_TASK.read() {
        Ok(g) => g.clone(),
        Err(p) => p.into_inner().clone(),
    };
    (StatusCode::OK, Json(task)).into_response()
}
