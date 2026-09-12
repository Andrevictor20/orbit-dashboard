use std::sync::Arc;
use axum::http::StatusCode;
use axum::Json;
use serde_json::Value;
use tokio_util::sync::CancellationToken;

use crate::docker::updates::{get_host_platform, invalidate_update_cache};
use super::puller::{pull_updated_image, PullResult};
use super::update_task_status;

pub async fn recreate_standalone_container(
    docker: Arc<bollard::Docker>,
    id: &str,
    clean_name: &str,
    image_name: &str,
    inspect: &bollard::models::ContainerInspectResponse,
    config: &bollard::models::ContainerConfig,
    cancel_token: &CancellationToken,
) -> (StatusCode, Json<Value>) {
    match pull_updated_image(&docker, id, clean_name, image_name, cancel_token).await {
        PullResult::Success => {}
        PullResult::Cancelled => {
            return (
                StatusCode::OK,
                Json(serde_json::json!({
                    "id": id,
                    "name": clean_name,
                    "status": "cancelled",
                    "message": "Atualização cancelada pelo usuário"
                })),
            );
        }
        PullResult::Failed(err) => {
            update_task_status(
                id,
                clean_name,
                image_name,
                "error",
                &format!("Falha ao baixar imagem '{}'", image_name),
                Some(err.clone()),
                Some(err.clone()),
            );
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "id": id,
                    "name": clean_name,
                    "image": image_name,
                    "status": "error",
                    "message": format!("Falha ao baixar imagem atualizada '{}'", image_name),
                    "details": err
                })),
            );
        }
    }

    update_task_status(
        id,
        clean_name,
        image_name,
        "recreating",
        "Parando e recriando container...",
        None,
        None,
    );

    // 3. Multi-Network Handling & Sanitization
    let is_host_or_special_network = inspect
        .host_config
        .as_ref()
        .and_then(|h| h.network_mode.as_deref())
        .map(|m| {
            m.eq_ignore_ascii_case("host")
                || m.eq_ignore_ascii_case("none")
                || m.starts_with("container:")
        })
        .unwrap_or(false);

    let (initial_networking_config, secondary_networks) = if is_host_or_special_network {
        (None, Vec::new())
    } else {
        let all_networks = inspect
            .network_settings
            .as_ref()
            .and_then(|ns| ns.networks.clone())
            .unwrap_or_default();

        let mut net_iter = all_networks.into_iter();
        let primary_network = net_iter.next();
        let secondary: Vec<(String, bollard::models::EndpointSettings)> = net_iter.collect();

        let initial_cfg = primary_network.map(|(net_name, ep)| {
            let sanitized_ep = bollard::models::EndpointSettings {
                aliases: ep.aliases,
                ipam_config: ep.ipam_config,
                links: ep.links,
                ..Default::default()
            };
            let mut map = std::collections::HashMap::new();
            map.insert(net_name, sanitized_ep);
            bollard::models::NetworkingConfig {
                endpoints_config: Some(map),
            }
        });

        (initial_cfg, secondary)
    };

    let new_config = bollard::models::ContainerCreateBody {
        hostname: config.hostname.clone(),
        domainname: config.domainname.clone(),
        image: Some(image_name.to_string()),
        cmd: config.cmd.clone(),
        entrypoint: config.entrypoint.clone(),
        user: config.user.clone(),
        working_dir: config.working_dir.clone(),
        labels: config.labels.clone(),
        env: config.env.clone(),
        exposed_ports: config.exposed_ports.clone(),
        tty: config.tty,
        open_stdin: config.open_stdin,
        stdin_once: config.stdin_once,
        healthcheck: config.healthcheck.clone(),
        stop_signal: config.stop_signal.clone(),
        stop_timeout: config.stop_timeout,
        shell: config.shell.clone(),
        host_config: inspect.host_config.clone(),
        networking_config: initial_networking_config,
        ..Default::default()
    };

    // 4. Stop container with graceful timeout
    let stop_options = bollard::query_parameters::StopContainerOptions {
        t: Some(10),
        ..Default::default()
    };
    let _ = docker.stop_container(id, Some(stop_options)).await;

    // 5. Remove old container
    let remove_options = bollard::query_parameters::RemoveContainerOptions {
        force: true,
        v: false,
        link: false,
    };
    if let Err(e) = docker.remove_container(id, Some(remove_options)).await {
        let err_str = e.to_string();
        update_task_status(
            id,
            clean_name,
            image_name,
            "error",
            "Falha ao remover container antigo",
            Some(err_str.clone()),
            Some(err_str.clone()),
        );
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "id": id,
                "name": clean_name,
                "image": image_name,
                "status": "error",
                "message": format!("Falha ao remover container antigo: {}", e),
                "details": err_str
            })),
        );
    }

    // 6. Create new container
    let create_options = bollard::query_parameters::CreateContainerOptions {
        name: Some(clean_name.to_string()),
        ..Default::default()
    };

    let created = match docker
        .create_container(Some(create_options), new_config.clone())
        .await
    {
        Ok(c) => c,
        Err(e) => {
            let fallback_create_options = bollard::query_parameters::CreateContainerOptions {
                name: Some(clean_name.to_string()),
                platform: get_host_platform().to_string(),
                ..Default::default()
            };
            match docker
                .create_container(Some(fallback_create_options), new_config)
                .await
            {
                Ok(c) => c,
                Err(e2) => {
                    let err_str = format!("Primary create error: {}. Fallback error: {}", e, e2);
                    update_task_status(
                        id,
                        clean_name,
                        image_name,
                        "error",
                        "Falha ao recriar container",
                        Some(err_str.clone()),
                        Some(err_str.clone()),
                    );
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({
                            "id": id,
                            "name": clean_name,
                            "image": image_name,
                            "status": "error",
                            "message": format!("Falha ao recriar container: {}", e),
                            "details": err_str
                        })),
                    );
                }
            }
        }
    };

    // 7. Attach secondary networks if any
    for (sec_net_name, sec_ep) in secondary_networks {
        let sanitized_sec_ep = bollard::models::EndpointSettings {
            aliases: sec_ep.aliases,
            ipam_config: sec_ep.ipam_config,
            links: sec_ep.links,
            ..Default::default()
        };
        let connect_opts = bollard::models::NetworkConnectRequest {
            container: created.id.clone(),
            endpoint_config: Some(sanitized_sec_ep),
        };
        if let Err(e) = docker.connect_network(&sec_net_name, connect_opts).await {
            tracing::warn!(
                "Failed to attach secondary network {} to container {}: {}",
                sec_net_name,
                created.id,
                e
            );
        }
    }

    // 8. Start new container
    match docker
        .start_container(
            &created.id,
            None::<bollard::query_parameters::StartContainerOptions>,
        )
        .await
    {
        Ok(_) => {
            invalidate_update_cache(image_name);

            let docker_clone = docker.clone();
            tokio::spawn(async move {
                let mut filters = std::collections::HashMap::new();
                filters.insert("dangling".to_string(), vec!["true".to_string()]);
                let _ = docker_clone
                    .prune_images(Some(bollard::query_parameters::PruneImagesOptions {
                        filters: Some(filters),
                    }))
                    .await;
            });

            update_task_status(
                id,
                clean_name,
                image_name,
                "success",
                "Container atualizado e reiniciado com sucesso!",
                None,
                None,
            );
            if !created.id.is_empty() && created.id != id {
                update_task_status(
                    &created.id,
                    clean_name,
                    image_name,
                    "success",
                    "Container atualizado e reiniciado com sucesso!",
                    None,
                    None,
                );
            }

            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "id": created.id,
                    "name": clean_name,
                    "image": image_name,
                    "status": "success",
                    "message": "Container atualizado e reiniciado com sucesso!"
                })),
            )
        }
        Err(e) => {
            let err_str = e.to_string();
            update_task_status(
                id,
                clean_name,
                image_name,
                "error",
                "Falha ao iniciar container atualizado",
                Some(err_str.clone()),
                Some(err_str.clone()),
            );
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "id": created.id,
                    "name": clean_name,
                    "image": image_name,
                    "status": "error",
                    "message": format!("Falha ao iniciar container atualizado: {}", e),
                    "details": err_str
                })),
            )
        }
    }
}
