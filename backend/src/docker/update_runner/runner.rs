use std::sync::Arc;
use axum::http::StatusCode;
use axum::Json;
use serde_json::Value;
use tokio_util::sync::CancellationToken;

use super::compose::try_compose_update;
use super::recreation::recreate_standalone_container;
use super::update_task_status;

pub async fn execute_container_update(
    docker: Arc<bollard::Docker>,
    id: String,
    clean_name: String,
    inspect: bollard::models::ContainerInspectResponse,
    cancel_token: CancellationToken,
) -> (StatusCode, Json<Value>) {
    let compose_dir = inspect
        .config
        .as_ref()
        .and_then(|c| c.labels.as_ref())
        .and_then(|l| l.get("com.docker.compose.project.working_dir"))
        .map(|s| s.as_str());

    let compose_file_label = inspect
        .config
        .as_ref()
        .and_then(|c| c.labels.as_ref())
        .and_then(|l| l.get("com.docker.compose.project.config_files"))
        .map(|s| s.as_str())
        .unwrap_or("docker-compose.yml");

    let compose_service = inspect
        .config
        .as_ref()
        .and_then(|c| c.labels.as_ref())
        .and_then(|l| l.get("com.docker.compose.service"))
        .map(|s| s.as_str());

    let is_compose_project = inspect
        .config
        .as_ref()
        .and_then(|c| c.labels.as_ref())
        .map(|l| l.contains_key("com.docker.compose.project"))
        .unwrap_or(false);

    let config = match &inspect.config {
        Some(c) => c,
        None => {
            update_task_status(
                &id,
                &clean_name,
                "",
                "error",
                "Falha ao ler configuração do container",
                Some("Configuração vazia retornada pelo Docker".to_string()),
                None,
            );
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "id": id,
                    "name": clean_name,
                    "status": "error",
                    "message": "Falha ao ler configuração do container",
                    "details": "Container inspect retornou config vazia"
                })),
            );
        }
    };

    let image_name = match &config.image {
        Some(img) => img.clone(),
        None => {
            update_task_status(
                &id,
                &clean_name,
                "",
                "error",
                "Container não possui imagem definida",
                Some("Nenhum nome de imagem foi especificado na configuração".to_string()),
                None,
            );
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "id": id,
                    "name": clean_name,
                    "status": "error",
                    "message": "Container não possui imagem definida",
                    "details": "Nenhum nome de imagem foi especificado na configuração"
                })),
            );
        }
    };

    if is_compose_project || compose_dir.is_some() {
        if let Some(resp) = try_compose_update(
            &id,
            &clean_name,
            &image_name,
            compose_dir,
            compose_file_label,
            compose_service,
            &cancel_token,
        )
        .await
        {
            return resp;
        }
        tracing::warn!(
            "Compose update did not complete for container '{}' (dir: {:?}, file: {}). Falling back to standalone update.",
            clean_name,
            compose_dir,
            compose_file_label
        );
    }

    recreate_standalone_container(
        docker,
        &id,
        &clean_name,
        &image_name,
        &inspect,
        config,
        &cancel_token,
    )
    .await
}
