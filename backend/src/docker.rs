use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use bollard::Docker;
use serde::Serialize;
use bollard::query_parameters::ListContainersOptions;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub docker: Arc<Docker>,
}

#[derive(Serialize)]
pub struct ContainerSummary {
    pub id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
}

pub async fn list_containers(
    State(state): State<AppState>,
) -> Result<Json<Vec<ContainerSummary>>, StatusCode> {
    let options = Some(ListContainersOptions {
        all: true,
        ..Default::default()
    });

    let containers = state.docker.list_containers(options).await.map_err(|e| {
        eprintln!("Docker error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let summaries: Vec<ContainerSummary> = containers
        .into_iter()
        .map(|c| ContainerSummary {
            id: c.id.unwrap_or_default(),
            name: c
                .names
                .unwrap_or_default()
                .first()
                .cloned()
                .unwrap_or_default()
                .trim_start_matches('/')
                .to_string(),
            image: c.image.unwrap_or_default(),
            state: c.state.map(|s| format!("{:?}", s)).unwrap_or_default(),
            status: c.status.unwrap_or_default(),
        })
        .collect();

    Ok(Json(summaries))
}
