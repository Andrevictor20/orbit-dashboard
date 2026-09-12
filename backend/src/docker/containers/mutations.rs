use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};

use super::compose_resolver::valid_env_entry;
use super::super::types::{UpdateEnvPayload, UpdateVolumesPayload};
use crate::state::AppState;

pub async fn update_container_env(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateEnvPayload>,
) -> impl IntoResponse {
    let docker = &state.docker;

    if payload.env.iter().any(|entry| !valid_env_entry(entry)) {
        return (
            StatusCode::BAD_REQUEST,
            "Environment variables must use KEY=VALUE with a valid key",
        )
            .into_response();
    }
    let unique_keys: std::collections::HashSet<&str> = payload
        .env
        .iter()
        .filter_map(|entry| entry.split_once('=').map(|(key, _)| key))
        .collect();
    if unique_keys.len() != payload.env.len() {
        return (
            StatusCode::BAD_REQUEST,
            "Environment variable keys must be unique",
        )
            .into_response();
    }

    // 1. Inspect current container
    let inspect = match docker
        .inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>)
        .await
    {
        Ok(i) => i,
        Err(e) => {
            return (
                StatusCode::NOT_FOUND,
                format!("Container not found: {}", e),
            )
                .into_response()
        }
    };

    let config = match inspect.config {
        Some(c) => c,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to read container config",
            )
                .into_response()
        }
    };

    let name = inspect.name.unwrap_or_else(|| id.clone());
    let clean_name = name.trim_start_matches('/');

    let new_config = bollard::models::ContainerCreateBody {
        hostname: config.hostname,
        domainname: config.domainname,
        image: config.image,
        cmd: config.cmd,
        entrypoint: config.entrypoint,
        user: config.user,
        working_dir: config.working_dir,
        labels: config.labels,
        env: Some(payload.env),
        exposed_ports: config.exposed_ports,
        tty: config.tty,
        open_stdin: config.open_stdin,
        stdin_once: config.stdin_once,
        healthcheck: config.healthcheck,
        stop_signal: config.stop_signal,
        stop_timeout: config.stop_timeout,
        shell: config.shell,
        host_config: inspect.host_config,
        networking_config: inspect
            .network_settings
            .map(|ns| bollard::models::NetworkingConfig {
                endpoints_config: ns.networks,
                ..Default::default()
            }),
        ..Default::default()
    };

    // 2. Stop container. Do not remove a running container if stop failed.
    if let Err(error) = docker.stop_container(&id, None).await {
        if inspect
            .state
            .as_ref()
            .and_then(|state| state.running)
            .unwrap_or(false)
        {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to stop container: {}", error),
            )
                .into_response();
        }
    }

    // 3. Remove container
    let remove_options = bollard::query_parameters::RemoveContainerOptions {
        force: false,
        v: false,
        link: false,
    };
    if let Err(e) = docker.remove_container(&id, Some(remove_options)).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to remove container: {}", e),
        )
            .into_response();
    }

    // 4. Create new container
    let create_options = bollard::query_parameters::CreateContainerOptions {
        name: Some(clean_name.to_string()),
        ..Default::default()
    };

    let created = match docker
        .create_container(Some(create_options), new_config)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to create new container: {}", e),
            )
                .into_response()
        }
    };

    // 5. Start new container
    match docker
        .start_container(
            &created.id,
            None::<bollard::query_parameters::StartContainerOptions>,
        )
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "id": created.id,
                "message": "Environment variables updated successfully"
            })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to start new container: {}", e),
        )
            .into_response(),
    }
}

pub async fn update_container_volumes(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateVolumesPayload>,
) -> impl IntoResponse {
    let docker = &state.docker;

    // 1. Inspect current container
    let inspect = match docker
        .inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>)
        .await
    {
        Ok(i) => i,
        Err(e) => {
            return (
                StatusCode::NOT_FOUND,
                format!("Container not found: {}", e),
            )
                .into_response()
        }
    };

    let config = match inspect.config {
        Some(c) => c,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to read container config",
            )
                .into_response()
        }
    };

    let name = inspect.name.unwrap_or_else(|| id.clone());
    let clean_name = name.trim_start_matches('/');

    let mut new_host_config = inspect.host_config.clone().unwrap_or_default();
    new_host_config.binds = Some(payload.volumes);

    let new_config = bollard::models::ContainerCreateBody {
        hostname: config.hostname,
        domainname: config.domainname,
        image: config.image,
        cmd: config.cmd,
        entrypoint: config.entrypoint,
        user: config.user,
        working_dir: config.working_dir,
        labels: config.labels,
        env: config.env,
        exposed_ports: config.exposed_ports,
        tty: config.tty,
        open_stdin: config.open_stdin,
        stdin_once: config.stdin_once,
        healthcheck: config.healthcheck,
        stop_signal: config.stop_signal,
        stop_timeout: config.stop_timeout,
        shell: config.shell,
        host_config: Some(new_host_config),
        networking_config: inspect
            .network_settings
            .map(|ns| bollard::models::NetworkingConfig {
                endpoints_config: ns.networks,
                ..Default::default()
            }),
        ..Default::default()
    };

    // 2. Stop container
    if let Err(error) = docker.stop_container(&id, None).await {
        if inspect
            .state
            .as_ref()
            .and_then(|state| state.running)
            .unwrap_or(false)
        {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to stop container: {}", error),
            )
                .into_response();
        }
    }

    // 3. Remove container
    let remove_options = bollard::query_parameters::RemoveContainerOptions {
        force: false,
        v: false,
        link: false,
    };
    if let Err(e) = docker.remove_container(&id, Some(remove_options)).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to remove container: {}", e),
        )
            .into_response();
    }

    // 4. Create new container
    let create_options = bollard::query_parameters::CreateContainerOptions {
        name: Some(clean_name.to_string()),
        ..Default::default()
    };

    let created = match docker
        .create_container(Some(create_options), new_config)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to create new container: {}", e),
            )
                .into_response()
        }
    };

    // 5. Start new container
    match docker
        .start_container(
            &created.id,
            None::<bollard::query_parameters::StartContainerOptions>,
        )
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "id": created.id,
                "message": "Volumes updated successfully"
            })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to start new container: {}", e),
        )
            .into_response(),
    }
}
