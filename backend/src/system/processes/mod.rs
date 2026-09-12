pub mod collector;
pub mod killer;
pub mod models;
pub mod proc_scan;

pub use collector::*;
pub use killer::*;
pub use models::*;
pub use proc_scan::*;

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use crate::state::AppState;

pub async fn get_processes_handler(State(state): State<AppState>) -> impl IntoResponse {
    let response = collector::collect_processes_data(&state.docker).await;
    (StatusCode::OK, Json(response)).into_response()
}
