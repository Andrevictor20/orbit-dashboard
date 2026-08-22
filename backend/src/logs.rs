use axum::{
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Serialize;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

#[derive(Serialize)]
pub struct LogsResponse {
    logs: Vec<String>,
}

pub async fn get_logs() -> impl IntoResponse {
    let log_path = Path::new("data/orbit.log");
    
    if !log_path.exists() {
        return (StatusCode::OK, Json(LogsResponse { logs: vec![] })).into_response();
    }

    let file = match File::open(log_path) {
        Ok(f) => f,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(LogsResponse { logs: vec![] })).into_response(),
    };

    // Lê as últimas 1000 linhas
    let reader = BufReader::new(file);
    let all_lines: Vec<String> = reader.lines().filter_map(Result::ok).collect();
    
    let logs = if all_lines.len() > 1000 {
        all_lines[all_lines.len() - 1000..].to_vec()
    } else {
        all_lines
    };

    (StatusCode::OK, Json(LogsResponse { logs })).into_response()
}
