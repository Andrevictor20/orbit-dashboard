use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::docker::parser::{parse_docker_command_or_compose, ParsedService};
use crate::docker::ports::{check_ports_with_docker, PortConflictInfo};
use crate::state::AppState;
use crate::store::installer::{spawn_compose_installation, INSTALL_TASKS};
use crate::store::types::InstallTask;

#[derive(Deserialize)]
pub struct ParseInputPayload {
    pub raw_input: String,
}

#[derive(Serialize)]
pub struct ParseResponse {
    pub input_type: String,
    pub app_name: String,
    pub image: String,
    pub services: Vec<ParsedService>,
    pub compose_yaml: String,
    pub port_conflicts: Vec<PortConflictInfo>,
}

#[derive(Deserialize)]
pub struct CheckPortsPayload {
    pub ports: Vec<u16>,
    pub protocol: Option<String>,
}

#[derive(Serialize)]
pub struct CheckPortsResponse {
    pub conflicts: Vec<PortConflictInfo>,
}

#[derive(Deserialize)]
pub struct InstallComposePayload {
    pub app_name: String,
    pub compose_yaml: String,
    pub override_ports: Option<HashMap<u16, u16>>, // map of old_host_port -> new_host_port
}

pub async fn parse_compose_or_command_handler(
    State(state): State<AppState>,
    Json(payload): Json<ParseInputPayload>,
) -> impl IntoResponse {
    let parsed = match parse_docker_command_or_compose(&payload.raw_input) {
        Ok(p) => p,
        Err(err) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": err })),
            )
                .into_response();
        }
    };

    // Gather all requested host ports across services
    let mut ports_to_check: Vec<(u16, u16, String)> = Vec::new();
    for svc in &parsed.services {
        for p in &svc.ports {
            if let Some(hp) = p.host_port {
                ports_to_check.push((hp, p.container_port, p.protocol.clone()));
            }
        }
    }

    let port_conflicts = check_ports_with_docker(Some(&state.docker), &ports_to_check).await;

    let response = ParseResponse {
        input_type: parsed.input_type,
        app_name: parsed.app_name,
        image: parsed.image,
        services: parsed.services,
        compose_yaml: parsed.compose_yaml,
        port_conflicts,
    };

    (StatusCode::OK, Json(response)).into_response()
}

pub async fn check_ports_handler(
    State(state): State<AppState>,
    Json(payload): Json<CheckPortsPayload>,
) -> impl IntoResponse {
    let proto = payload.protocol.unwrap_or_else(|| "tcp".to_string());
    let ports_to_check: Vec<(u16, u16, String)> = payload
        .ports
        .into_iter()
        .map(|p| (p, p, proto.clone()))
        .collect();

    let conflicts = check_ports_with_docker(Some(&state.docker), &ports_to_check).await;
    (StatusCode::OK, Json(CheckPortsResponse { conflicts })).into_response()
}

pub async fn install_custom_compose_handler(
    State(_state): State<AppState>,
    Json(payload): Json<InstallComposePayload>,
) -> impl IntoResponse {
    let safe_app_name = payload
        .app_name
        .trim()
        .replace("..", "")
        .replace('/', "-")
        .replace('\\', "-");

    if safe_app_name.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Nome do aplicativo inválido" })),
        )
            .into_response();
    }

    let mut final_yaml = payload.compose_yaml;

    // Apply any port overrides
    if let Some(overrides) = payload.override_ports {
        for (old_port, new_port) in overrides {
            if old_port != new_port {
                // Replace "8080:" with "8081:"
                let pattern1 = format!("\"{}:", old_port);
                let replace1 = format!("\"{}:", new_port);
                final_yaml = final_yaml.replace(&pattern1, &replace1);

                let pattern2 = format!("'{}:", old_port);
                let replace2 = format!("'{}:", new_port);
                final_yaml = final_yaml.replace(&pattern2, &replace2);

                let pattern3 = format!(" {}:", old_port);
                let replace3 = format!(" {}:", new_port);
                final_yaml = final_yaml.replace(&pattern3, &replace3);
            }
        }
    }

    let task_id = uuid::Uuid::new_v4().to_string();
    {
        let mut tasks = INSTALL_TASKS.write().unwrap();
        tasks.insert(
            task_id.clone(),
            InstallTask {
                id: task_id.clone(),
                status: "starting".to_string(),
                progress: 0,
                logs: vec![format!("[INFO] Iniciando instalação de {}", safe_app_name)],
                error: None,
            },
        );
    }

    spawn_compose_installation(safe_app_name.clone(), final_yaml, task_id.clone());

    (
        StatusCode::ACCEPTED,
        Json(serde_json::json!({
            "task_id": task_id,
            "app_name": safe_app_name
        })),
    )
        .into_response()
}
