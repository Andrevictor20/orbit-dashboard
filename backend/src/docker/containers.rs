use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use futures::StreamExt;
use crate::state::AppState;
use super::types::{ContainerInfo, DeleteContainerQuery, PortInfo, UpdateEnvPayload, UpdateVolumesPayload};

pub fn valid_env_entry(entry: &str) -> bool {
    let Some((key, _)) = entry.split_once('=') else {
        return false;
    };

    !key.is_empty()
        && !key.as_bytes()[0].is_ascii_digit()
        && key.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
}

/// Helper to resolve the real location of a docker-compose manifest on disk.
/// Handles paths inside container (/app/data/apps/...), host paths (/host/...),
/// and relative working directories. Returns (compose_file_path, project_directory).
pub fn resolve_compose_file(
    working_dir: Option<&str>,
    config_files_label: &str,
) -> Option<(std::path::PathBuf, std::path::PathBuf)> {
    let clean_label = config_files_label.split(',').next().unwrap_or("docker-compose.yml").trim();
    if clean_label.is_empty() {
        return None;
    }

    let mut candidate_paths = Vec::new();

    // 1. Direct label path
    candidate_paths.push(std::path::PathBuf::from(clean_label));

    // 2. Host-prefixed label path if label starts with '/'
    if clean_label.starts_with('/') {
        candidate_paths.push(std::path::PathBuf::from(format!("/host{}", clean_label)));
    }

    // 3. Relative to working_dir if provided
    if let Some(wd) = working_dir {
        let wd_path = std::path::Path::new(wd);
        candidate_paths.push(wd_path.join(clean_label));
        
        let file_name = std::path::Path::new(clean_label).file_name().unwrap_or_default();
        candidate_paths.push(wd_path.join(file_name));

        // Also check with /host prefix on working_dir
        let host_wd = format!("/host{}", wd);
        let host_wd_path = std::path::Path::new(&host_wd);
        candidate_paths.push(host_wd_path.join(clean_label));
        candidate_paths.push(host_wd_path.join(file_name));
    }

    // Find the first candidate that actually exists as a file
    for candidate in candidate_paths {
        if candidate.is_file() {
            let project_dir = if let Some(wd) = working_dir {
                if std::path::Path::new(wd).is_dir() {
                    std::path::PathBuf::from(wd)
                } else if std::path::Path::new(&format!("/host{}", wd)).is_dir() {
                    std::path::PathBuf::from(format!("/host{}", wd))
                } else {
                    candidate.parent().unwrap_or_else(|| std::path::Path::new(".")).to_path_buf()
                }
            } else {
                candidate.parent().unwrap_or_else(|| std::path::Path::new(".")).to_path_buf()
            };

            return Some((candidate, project_dir));
        }
    }

    None
}

/// Returns the well-known default web UI port for common container images.
pub fn detect_well_known_web_port(image: &str, name: &str) -> Option<u16> {
    let combined = format!("{}/{}", image.to_lowercase(), name.to_lowercase());
    
    if combined.contains("home-assistant") || combined.contains("homeassistant") {
        Some(8123)
    } else if combined.contains("pihole") || combined.contains("pi-hole") {
        Some(80)
    } else if combined.contains("jellyfin") || combined.contains("emby") {
        Some(8096)
    } else if combined.contains("plex") {
        Some(32400)
    } else if combined.contains("adguard") {
        Some(3000)
    } else if combined.contains("kavita") {
        Some(5000)
    } else if combined.contains("metube") {
        Some(8081)
    } else if combined.contains("moodle") {
        Some(80)
    } else if combined.contains("n8n") {
        Some(5678)
    } else if combined.contains("cloudflared-web") || combined.contains("cloudflared") {
        Some(14333)
    } else if combined.contains("node-red") || combined.contains("nodered") {
        Some(1880)
    } else if combined.contains("overseerr") {
        Some(5055)
    } else if combined.contains("portainer") {
        Some(9000)
    } else if combined.contains("syncthing") {
        Some(8384)
    } else if combined.contains("qbittorrent") {
        Some(8080)
    } else if combined.contains("transmission") {
        Some(9091)
    } else if combined.contains("deluge") {
        Some(8112)
    } else if combined.contains("uptime-kuma") {
        Some(3001)
    } else if combined.contains("wireguard") || combined.contains("wg-easy") {
        Some(51821)
    } else if combined.contains("tailscale") {
        Some(8088)
    } else if combined.contains("esphome") {
        Some(6052)
    } else if combined.contains("zigbee2mqtt") {
        Some(8080)
    } else if combined.contains("vaultwarden") || combined.contains("bitwarden") {
        Some(80)
    } else if combined.contains("grafana") {
        Some(3000)
    } else if combined.contains("prometheus") {
        Some(9090)
    } else if combined.contains("radarr") {
        Some(7878)
    } else if combined.contains("sonarr") {
        Some(8989)
    } else if combined.contains("lidarr") {
        Some(8686)
    } else if combined.contains("bazarr") {
        Some(6767)
    } else if combined.contains("prowlarr") {
        Some(9696)
    } else if combined.contains("readarr") {
        Some(8787)
    } else if combined.contains("audiobookshelf") {
        Some(13378)
    } else if combined.contains("photoprism") {
        Some(2342)
    } else if combined.contains("immich") {
        Some(2283)
    } else if combined.contains("paperless") {
        Some(8000)
    } else if combined.contains("navidrome") {
        Some(4533)
    } else if combined.contains("nginx-proxy-manager") || combined.contains("npm") {
        Some(81)
    } else if combined.contains("nginx") || combined.contains("caddy") {
        Some(80)
    } else if combined.contains("nextcloud") {
        Some(80)
    } else if combined.contains("beszel") {
        Some(8090)
    } else if combined.contains("dozzle") {
        Some(8080)
    } else if combined.contains("glances") {
        Some(61208)
    } else if combined.contains("netdata") {
        Some(19999)
    } else if combined.contains("homarr") {
        Some(7575)
    } else if combined.contains("homepage") {
        Some(3000)
    } else if combined.contains("flaresolverr") {
        Some(8191)
    } else if combined.contains("calibre-web") {
        Some(8083)
    } else if combined.contains("komga") {
        Some(25600)
    } else if combined.contains("mealie") {
        Some(9000)
    } else if combined.contains("wikijs") {
        Some(3000)
    } else if combined.contains("trilium") {
        Some(8080)
    } else if combined.contains("stirling-pdf") {
        Some(8080)
    } else if combined.contains("it-tools") || combined.contains("cyberchef") {
        Some(80)
    } else if combined.contains("changedetection") {
        Some(5000)
    } else if combined.contains("rustdesk") {
        Some(21117)
    } else if combined.contains("guacamole") {
        Some(8080)
    } else if combined.contains("cockpit") {
        Some(9090)
    } else {
        None
    }
}

/// Helper to parse web port from container labels (e.g. CasaOS, Traefik).
pub fn detect_label_web_port(labels: &std::collections::HashMap<String, String>) -> Option<u16> {
    const LABEL_KEYS: &[&str] = &[
        "io.casaos.port.web",
        "io.casaos.app.port",
        "io.casaos.app.main_port",
        "dev.casaos.app.port",
        "webui.port",
        "web.port",
        "port",
        "PORT",
    ];

    for key in LABEL_KEYS {
        if let Some(val) = labels.get(*key) {
            if let Ok(p) = val.trim().parse::<u16>() {
                if p > 0 {
                    return Some(p);
                }
            }
        }
    }

    // Traefik labels
    for (k, v) in labels {
        if k.starts_with("traefik.") && k.ends_with(".loadbalancer.server.port") {
            if let Ok(p) = v.trim().parse::<u16>() {
                if p > 0 {
                    return Some(p);
                }
            }
        }
    }

    None
}

/// Computes relevance score for sorting container ports (highest score first).
/// Prioritizes Web/HTTP UI ports over infrastructure/UDP/DHCP/DNS ports.
fn score_port(port: &PortInfo, label_port: Option<u16>, well_known: Option<u16>) -> i32 {
    let mut score = 0;

    let pub_p = port.public_port;
    let priv_p = port.private_port;
    let is_tcp = port.typ.eq_ignore_ascii_case("tcp");

    // 1. Matches explicit CasaOS/Traefik label port
    if let Some(lp) = label_port {
        if pub_p == Some(lp) || priv_p == lp {
            return 10000;
        }
    }

    // 2. Matches detected well-known image port
    if let Some(wk) = well_known {
        if pub_p == Some(wk) || priv_p == wk {
            return 8000;
        }
    }

    if let Some(pub_val) = pub_p {
        if is_tcp {
            // Standard web ports
            match pub_val {
                80 | 443 | 8080 | 8443 | 3000 | 8000 | 8081 | 8096 | 8123 | 9000 | 9443 | 5000 | 5055 | 1880 | 5678 | 14333 | 32400 => {
                    score += 5000;
                }
                53 | 67 | 68 | 123 | 161 | 514 => {
                    // DNS, DHCP, NTP, SNMP, Syslog
                    score -= 3000;
                }
                _ => {
                    score += 2000;
                }
            }

            match priv_p {
                80 | 443 | 8080 | 8443 | 3000 | 8000 | 8081 | 8096 | 8123 | 9000 | 9443 | 5000 | 5055 | 1880 | 5678 | 14333 => {
                    score += 1500;
                }
                _ => {}
            }
        } else {
            // UDP ports are lower priority than web TCP ports
            score -= 1000;
        }
    } else {
        // No public port mapped
        score -= 4000;
    }

    score
}

/// Deduplicates ports (collapsing IPv4 0.0.0.0 and IPv6 :: into a single entry),
/// enriches missing public ports in host network mode or CasaOS labels,
/// and orders ports placing primary web ports first.
pub fn process_and_prioritize_ports(
    raw_ports: Option<Vec<bollard::models::PortSummary>>,
    labels: &std::collections::HashMap<String, String>,
    image: &str,
    name: &str,
    network_mode: Option<&str>,
) -> Vec<PortInfo> {
    use std::collections::HashSet;

    let label_port = detect_label_web_port(labels);
    let well_known_port = detect_well_known_web_port(image, name);

    let mut dedup_map: Vec<PortInfo> = Vec::new();
    let mut seen_keys: HashSet<(Option<u16>, u16, String)> = HashSet::new();

    let is_host_net = network_mode.map(|m| m.eq_ignore_ascii_case("host")).unwrap_or(false);

    if let Some(ports) = raw_ports {
        for p in ports {
            let typ = p.typ.map(|t| t.to_string()).unwrap_or_else(|| "tcp".to_string());
            let mut pub_port = p.public_port;
            // In host network mode, exposed private port is directly reachable on host
            if is_host_net && pub_port.is_none() {
                pub_port = Some(p.private_port);
            }
            let key = (pub_port, p.private_port, typ.clone());

            if seen_keys.contains(&key) {
                // If the previously seen entry had IPv6 ("::") and current has IPv4 ("0.0.0.0"), prefer IPv4
                if let Some(existing) = dedup_map.iter_mut().find(|e| {
                    e.public_port == pub_port && e.private_port == p.private_port && e.typ == typ
                }) {
                    if existing.ip.as_deref() == Some("::") && p.ip.as_deref() == Some("0.0.0.0") {
                        existing.ip = p.ip;
                    }
                }
                continue;
            }

            seen_keys.insert(key);
            dedup_map.push(PortInfo {
                ip: if is_host_net && p.ip.is_none() { Some("0.0.0.0".to_string()) } else { p.ip },
                private_port: p.private_port,
                public_port: pub_port,
                typ,
            });
        }
    }

    let has_public_port = dedup_map.iter().any(|p| p.public_port.is_some());

    // If container runs in host mode OR has no public ports, check labels and well-known image ports
    if !has_public_port || is_host_net || dedup_map.is_empty() {
        let synthesized_port = label_port.or(well_known_port);
        if let Some(port_num) = synthesized_port {
            let key = (Some(port_num), port_num, "tcp".to_string());
            if !seen_keys.contains(&key) {
                seen_keys.insert(key);
                dedup_map.push(PortInfo {
                    ip: Some("0.0.0.0".to_string()),
                    private_port: port_num,
                    public_port: Some(port_num),
                    typ: "tcp".to_string(),
                });
            }
        }
    }

    // Sort ports putting highest priority (web UI) first
    dedup_map.sort_by(|a, b| {
        let score_b = score_port(b, label_port, well_known_port);
        let score_a = score_port(a, label_port, well_known_port);
        score_b.cmp(&score_a)
            .then_with(|| a.public_port.cmp(&b.public_port))
            .then_with(|| a.private_port.cmp(&b.private_port))
    });

    dedup_map
}

pub async fn list_containers(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let mut options = bollard::query_parameters::ListContainersOptions::default();
    options.all = true;
    options.size = false; // Fast listing without slow synchronous filesystem scans

    match state.docker.list_containers(Some(options)).await {
        Ok(containers) => {
            let info: Vec<ContainerInfo> = containers
                .into_iter()
                .map(|c| {
                    let name = c.names
                        .as_ref()
                        .and_then(|names| names.first())
                        .map(|n| n.trim_start_matches('/').to_string())
                        .filter(|n| !n.is_empty())
                        .unwrap_or_else(|| {
                            c.labels
                                .as_ref()
                                .and_then(|l| l.get("com.docker.compose.service").or_else(|| l.get("io.casaos.app.name")))
                                .cloned()
                                .unwrap_or_else(|| c.id.as_deref().unwrap_or("unknown").chars().take(12).collect())
                        });

                    let labels = c.labels.unwrap_or_default();
                    let image_str = c.image.unwrap_or_default();
                    let network_mode = c.host_config.as_ref().and_then(|h| h.network_mode.as_deref());
                    let ports = process_and_prioritize_ports(c.ports, &labels, &image_str, &name, network_mode);

                    ContainerInfo {
                        id: c.id.unwrap_or_default().chars().take(12).collect(),
                        name,
                        image: image_str,
                        state: c.state.map(|s| s.to_string()).unwrap_or_default(),
                        status: c.status.unwrap_or_default(),
                        ports,
                        labels,
                        size_rw: c.size_rw,
                        size_root_fs: c.size_root_fs,
                    }
                })
                .collect();
            (StatusCode::OK, Json(info)).into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch containers").into_response(),
    }
}

pub async fn inspect_container(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match state.docker.inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>).await {
        Ok(info) => (StatusCode::OK, Json(info)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

pub async fn container_logs(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let options = Some(bollard::query_parameters::LogsOptions {
        stdout: true,
        stderr: true,
        tail: "500".to_string(),
        follow: false,
        ..Default::default()
    });

    let mut stream = state.docker.logs(&id, options);
    let mut logs = String::new();
    
    while let Some(log_result) = stream.next().await {
        match log_result {
            Ok(log) => {
                logs.push_str(&format!("{}\n", log));
            }
            Err(_) => break,
        }
    }
    
    (StatusCode::OK, logs).into_response()
}

pub async fn delete_container(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<DeleteContainerQuery>,
) -> impl IntoResponse {
    let docker = &state.docker;
    let mut image_id = None;
    let mut network_names = Vec::new();

    // 1. Inspect container to check running state and collect image/network if requested
    if let Ok(inspect) = docker.inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>).await {
        // Stop container if running or paused before removal
        if let Some(st) = inspect.state {
            if st.running.unwrap_or(false) || st.paused.unwrap_or(false) {
                let stop_opts = Some(bollard::query_parameters::StopContainerOptions { t: Some(5), signal: None });
                let _ = docker.stop_container(&id, stop_opts).await;
            }
        }

        if query.image.unwrap_or(false) {
            image_id = inspect.image;
        }
        if query.network.unwrap_or(false) {
            if let Some(network_settings) = inspect.network_settings {
                if let Some(networks) = network_settings.networks {
                    network_names = networks.keys().cloned().collect();
                }
            }
        }
    }

    // 2. Remove the stopped container
    let remove_volumes = query.v.unwrap_or(false);
    let options = Some(bollard::query_parameters::RemoveContainerOptions {
        force: true,
        v: remove_volumes,
        link: false,
    });
    
    if let Err(e) = docker.remove_container(&id, options).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }

    if let Some(img_id) = image_id {
        let _ = docker.remove_image(&img_id, None::<bollard::query_parameters::RemoveImageOptions>, None).await;
    }

    for net_name in network_names {
        if net_name != "bridge" && net_name != "host" && net_name != "none" {
            let _ = docker.remove_network(&net_name).await;
        }
    }

    (StatusCode::OK, "Container stopped and removed successfully").into_response()
}

pub async fn update_container_env(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateEnvPayload>,
) -> impl IntoResponse {
    let docker = &state.docker;

    if payload.env.iter().any(|entry| !valid_env_entry(entry)) {
        return (StatusCode::BAD_REQUEST, "Environment variables must use KEY=VALUE with a valid key").into_response();
    }
    let unique_keys: std::collections::HashSet<&str> = payload.env.iter()
        .filter_map(|entry| entry.split_once('=').map(|(key, _)| key))
        .collect();
    if unique_keys.len() != payload.env.len() {
        return (StatusCode::BAD_REQUEST, "Environment variable keys must be unique").into_response();
    }
    
    // 1. Inspect current container
    let inspect = match docker.inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>).await {
        Ok(i) => i,
        Err(e) => return (StatusCode::NOT_FOUND, format!("Container not found: {}", e)).into_response(),
    };
    
    let config = match inspect.config {
        Some(c) => c,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read container config").into_response(),
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
        networking_config: inspect.network_settings.map(|ns| bollard::models::NetworkingConfig {
            endpoints_config: ns.networks,
            ..Default::default()
        }),
        ..Default::default()
    };

    // 2. Stop container. Do not remove a running container if stop failed.
    if let Err(error) = docker.stop_container(&id, None).await {
        if inspect.state.as_ref().and_then(|state| state.running).unwrap_or(false) {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to stop container: {}", error)).into_response();
        }
    }

    // 3. Remove container
    let remove_options = bollard::query_parameters::RemoveContainerOptions {
        force: false,
        v: false,
        link: false,
    };
    if let Err(e) = docker.remove_container(&id, Some(remove_options)).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to remove container: {}", e)).into_response();
    }

    // 4. Create new container
    let create_options = bollard::query_parameters::CreateContainerOptions {
        name: Some(clean_name.to_string()),
        ..Default::default()
    };

    let created = match docker.create_container(Some(create_options), new_config).await {
        Ok(c) => c,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create new container: {}", e)).into_response(),
    };

    // 5. Start new container
    match docker.start_container(&created.id, None::<bollard::query_parameters::StartContainerOptions>).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({
            "id": created.id,
            "message": "Environment variables updated successfully"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to start new container: {}", e)).into_response(),
    }
}

pub async fn update_container_volumes(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateVolumesPayload>,
) -> impl IntoResponse {
    let docker = &state.docker;

    // 1. Inspect current container
    let inspect = match docker.inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>).await {
        Ok(i) => i,
        Err(e) => return (StatusCode::NOT_FOUND, format!("Container not found: {}", e)).into_response(),
    };
    
    let config = match inspect.config {
        Some(c) => c,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read container config").into_response(),
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
        networking_config: inspect.network_settings.map(|ns| bollard::models::NetworkingConfig {
            endpoints_config: ns.networks,
            ..Default::default()
        }),
        ..Default::default()
    };

    // 2. Stop container
    if let Err(error) = docker.stop_container(&id, None).await {
        if inspect.state.as_ref().and_then(|state| state.running).unwrap_or(false) {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to stop container: {}", error)).into_response();
        }
    }

    // 3. Remove container
    let remove_options = bollard::query_parameters::RemoveContainerOptions {
        force: false,
        v: false,
        link: false,
    };
    if let Err(e) = docker.remove_container(&id, Some(remove_options)).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to remove container: {}", e)).into_response();
    }

    // 4. Create new container
    let create_options = bollard::query_parameters::CreateContainerOptions {
        name: Some(clean_name.to_string()),
        ..Default::default()
    };

    let created = match docker.create_container(Some(create_options), new_config).await {
        Ok(c) => c,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create new container: {}", e)).into_response(),
    };

    // 5. Start new container
    match docker.start_container(&created.id, None::<bollard::query_parameters::StartContainerOptions>).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({
            "id": created.id,
            "message": "Volumes updated successfully"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to start new container: {}", e)).into_response(),
    }
}

pub async fn container_action(
    State(state): State<AppState>,
    Path((id, action)): Path<(String, String)>,
) -> impl IntoResponse {
    let docker = &state.docker;

    let res = match action.as_str() {
        "start" => docker.start_container(&id, None::<bollard::query_parameters::StartContainerOptions>).await,
        "stop" => docker.stop_container(&id, None).await,
        "restart" => docker.restart_container(&id, None).await,
        "pause" => docker.pause_container(&id).await,
        "unpause" => docker.unpause_container(&id).await,
        _ => return (StatusCode::BAD_REQUEST, "Invalid action").into_response(),
    };

    match res {
        Ok(_) => (StatusCode::OK, "Action successful").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

pub fn get_host_platform() -> &'static str {
    match std::env::consts::ARCH {
        "aarch64" => "linux/arm64",
        "arm" => "linux/arm/v7",
        "x86_64" => "linux/amd64",
        "x86" => "linux/386",
        "riscv64" => "linux/riscv64",
        _ => "linux/amd64",
    }
}

pub fn parse_image_ref(image: &str) -> (String, String, String) {
    let (img, tag) = if let Some((name, t)) = image.rsplit_once(':') {
        if !name.contains('/') || name.rfind('/').unwrap() < image.rfind(':').unwrap_or(0) {
            (name.to_string(), t.to_string())
        } else {
            (image.to_string(), "latest".to_string())
        }
    } else {
        (image.to_string(), "latest".to_string())
    };

    if img.starts_with("ghcr.io/") {
        ("ghcr.io".to_string(), img.trim_start_matches("ghcr.io/").to_string(), tag)
    } else if img.contains('/') {
        if img.split('/').next().unwrap_or("").contains('.') {
            let parts: Vec<&str> = img.splitn(2, '/').collect();
            (parts[0].to_string(), parts[1].to_string(), tag)
        } else {
            ("registry-1.docker.io".to_string(), img, tag)
        }
    } else {
        ("registry-1.docker.io".to_string(), format!("library/{}", img), tag)
    }
}

pub async fn check_remote_registry_for_update(docker: &bollard::Docker, image: &str) -> bool {
    // 1. Inspect local image
    let inspect = match docker.inspect_image(image).await {
        Ok(i) => i,
        Err(_) => return false,
    };
    let local_digests = inspect.repo_digests.unwrap_or_default();
    
    // 2. Parse image: e.g. "nginx:latest", "linuxserver/qbittorrent", "ghcr.io/owner/repo:tag"
    let (registry, repo, tag) = parse_image_ref(image);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    // Get Auth Token if needed
    let token = if registry == "registry-1.docker.io" {
        let auth_url = format!("https://auth.docker.io/token?service=registry.docker.io&scope=repository:{}:pull", repo);
        if let Ok(res) = client.get(&auth_url).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                json.get("token").and_then(|t| t.as_str()).map(|s| s.to_string())
            } else { None }
        } else { None }
    } else if registry == "ghcr.io" {
        let auth_url = format!("https://ghcr.io/token?service=ghcr.io&scope=repository:{}:pull", repo);
        if let Ok(res) = client.get(&auth_url).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                json.get("token").and_then(|t| t.as_str()).map(|s| s.to_string())
            } else { None }
        } else { None }
    } else {
        None
    };

    // Query manifest HEAD
    let manifest_url = format!("https://{}/v2/{}/manifests/{}", registry, repo, tag);
    let mut req = client.head(&manifest_url)
        .header("Accept", "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json");

    if let Some(tok) = token {
        req = req.header("Authorization", format!("Bearer {}", tok));
    }

    if let Ok(res) = req.send().await {
        if res.status().is_success() {
            if let Some(remote_digest) = res.headers().get("docker-content-digest").and_then(|d| d.to_str().ok()) {
                let matches = local_digests.iter().any(|ld| ld.ends_with(remote_digest) || ld.contains(remote_digest));
                return !matches;
            }
        }
    }

    false
}

static UPDATE_CACHE: once_cell::sync::Lazy<std::sync::RwLock<std::collections::HashMap<String, (bool, u64)>>> = 
    once_cell::sync::Lazy::new(|| std::sync::RwLock::new(std::collections::HashMap::new()));

pub async fn check_single_image_update(docker: &bollard::Docker, image: &str) -> bool {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
    
    // Check cache (15 min TTL = 900s)
    if let Ok(cache) = UPDATE_CACHE.read() {
        if let Some((has_update, timestamp)) = cache.get(image) {
            if now.saturating_sub(*timestamp) < 900 {
                return *has_update;
            }
        }
    }

    let has_update = check_remote_registry_for_update(docker, image).await;
    
    if let Ok(mut cache) = UPDATE_CACHE.write() {
        cache.insert(image.to_string(), (has_update, now));
    }
    
    has_update
}

pub async fn check_container_updates(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let options = bollard::query_parameters::ListContainersOptions {
        all: true,
        ..Default::default()
    };
    let containers = state.docker.list_containers(Some(options)).await.unwrap_or_default();
    let mut update_results = std::collections::HashMap::new();

    for c in containers {
        if let (Some(id), Some(image)) = (c.id, c.image) {
            let short_id: String = id.chars().take(12).collect();
            let has_update = check_single_image_update(&state.docker, &image).await;
            update_results.insert(short_id, serde_json::json!({
                "image": image,
                "has_update": has_update
            }));
        }
    }

    (StatusCode::OK, Json(update_results)).into_response()
}

pub async fn check_single_container_update(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let inspect = match state.docker.inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>).await {
        Ok(i) => i,
        Err(e) => return (StatusCode::NOT_FOUND, format!("Container not found: {}", e)).into_response(),
    };

    let image = inspect.config.and_then(|c| c.image).unwrap_or_default();
    let has_update = check_single_image_update(&state.docker, &image).await;

    (StatusCode::OK, Json(serde_json::json!({
        "id": id,
        "image": image,
        "has_update": has_update
    }))).into_response()
}

#[derive(Debug, serde::Deserialize, Default)]
pub struct UpdateContainerQuery {
    pub wait: Option<bool>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ContainerUpdateTask {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String, // "pulling" | "recreating" | "success" | "error"
    pub step: String,
    pub error: Option<String>,
    pub details: Option<String>,
    pub updated_at: u64,
}

pub static CONTAINER_UPDATE_TASKS: std::sync::LazyLock<std::sync::RwLock<std::collections::HashMap<String, ContainerUpdateTask>>> =
    std::sync::LazyLock::new(|| std::sync::RwLock::new(std::collections::HashMap::new()));

pub fn update_task_status(
    id: &str,
    name: &str,
    image: &str,
    status: &str,
    step: &str,
    error: Option<String>,
    details: Option<String>,
) {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    if let Ok(mut tasks) = CONTAINER_UPDATE_TASKS.write() {
        tasks.insert(
            id.to_string(),
            ContainerUpdateTask {
                id: id.to_string(),
                name: name.to_string(),
                image: image.to_string(),
                status: status.to_string(),
                step: step.to_string(),
                error,
                details,
                updated_at: now,
            },
        );
    }
}

pub async fn execute_container_update(
    docker: std::sync::Arc<bollard::Docker>,
    id: String,
    clean_name: String,
    inspect: bollard::models::ContainerInspectResponse,
) -> (StatusCode, axum::Json<serde_json::Value>) {
    let compose_dir = inspect.config.as_ref()
        .and_then(|c| c.labels.as_ref())
        .and_then(|l| l.get("com.docker.compose.project.working_dir"))
        .map(|s| s.as_str());

    let compose_file_label = inspect.config.as_ref()
        .and_then(|c| c.labels.as_ref())
        .and_then(|l| l.get("com.docker.compose.project.config_files"))
        .map(|s| s.as_str())
        .unwrap_or("docker-compose.yml");

    let compose_service = inspect.config.as_ref()
        .and_then(|c| c.labels.as_ref())
        .and_then(|l| l.get("com.docker.compose.service"))
        .map(|s| s.as_str());

    let is_compose_project = inspect.config.as_ref()
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
                }))
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
                }))
            );
        }
    };

    if is_compose_project || compose_dir.is_some() {
        if let Some((compose_file_path, project_dir)) = resolve_compose_file(compose_dir, compose_file_label) {
            tracing::info!("Found compose file: {:?} in project dir: {:?} (service: {:?})", compose_file_path, project_dir, compose_service);
            let host_project_dir = project_dir.to_string_lossy();
            let host_project_dir_arg = host_project_dir.strip_prefix("/host").unwrap_or(&host_project_dir);

            update_task_status(
                &id,
                &clean_name,
                &image_name,
                "pulling",
                &format!("Baixando imagem atualizada via Docker Compose (serviço: {})...", compose_service.unwrap_or("todos")),
                None,
                None,
            );

            let mut pull_cmd = tokio::process::Command::new("docker");
            pull_cmd.arg("compose")
                .arg("-f").arg(&compose_file_path)
                .arg("--project-directory").arg(host_project_dir_arg)
                .arg("pull");
            if let Some(svc) = compose_service {
                pull_cmd.arg(svc);
            }

            let pull_res = pull_cmd.output().await;
            let mut compose_succeeded = false;

            if let Ok(o) = pull_res {
                if o.status.success() {
                    update_task_status(
                        &id,
                        &clean_name,
                        &image_name,
                        "recreating",
                        &format!("Recriando container via Docker Compose (serviço: {})...", compose_service.unwrap_or("todos")),
                        None,
                        None,
                    );

                    let mut up_cmd = tokio::process::Command::new("docker");
                    up_cmd.arg("compose")
                        .arg("-f").arg(&compose_file_path)
                        .arg("--project-directory").arg(host_project_dir_arg)
                        .arg("up")
                        .arg("-d")
                        .arg("--no-deps");
                    if let Some(svc) = compose_service {
                        up_cmd.arg(svc);
                    }

                    let up_res = up_cmd.output().await;

                    if let Ok(uo) = up_res {
                        if uo.status.success() {
                            compose_succeeded = true;
                        } else {
                            let stderr_msg = String::from_utf8_lossy(&uo.stderr).to_string();
                            tracing::warn!("docker compose up failed: {}. Falling back to standalone update.", stderr_msg);
                        }
                    }
                } else {
                    let stderr_msg = String::from_utf8_lossy(&o.stderr).to_string();
                    tracing::warn!("docker compose pull failed: {}. Falling back to standalone update.", stderr_msg);
                }
            } else {
                tracing::warn!("Failed to spawn docker compose. Falling back to standalone update.");
            }

            if compose_succeeded {
                update_task_status(
                    &id,
                    &clean_name,
                    &image_name,
                    "success",
                    "Container atualizado e reiniciado com sucesso via Docker Compose!",
                    None,
                    None,
                );
                if let Ok(mut cache) = UPDATE_CACHE.write() {
                    cache.remove(&image_name);
                }
                return (StatusCode::OK, Json(serde_json::json!({
                    "id": id,
                    "name": clean_name,
                    "image": image_name,
                    "status": "success",
                    "message": "Container atualizado e reiniciado com sucesso via Docker Compose!"
                })));
            }
        } else {
            tracing::warn!(
                "Compose labels present for container '{}' (dir: {:?}, file: {}), but compose file not found on disk. Falling back to standalone update.",
                clean_name,
                compose_dir,
                compose_file_label
            );
        }
    }

    // Standard standalone container update:
    let platform = get_host_platform();
    tracing::info!("Pulling updated image {} (host platform: {})", image_name, platform);

    update_task_status(
        &id,
        &clean_name,
        &image_name,
        "pulling",
        &format!("Baixando imagem atualizada '{}'...", image_name),
        None,
        None,
    );

    // 2. Safe Image Pull with stream validation BEFORE touching the existing container
    let create_image_options = bollard::query_parameters::CreateImageOptions {
        from_image: Some(image_name.clone()),
        ..Default::default()
    };
    let mut pull_stream = docker.create_image(Some(create_image_options), None, None);
    let mut pull_failed = false;
    let mut pull_error_msg = String::new();

    while let Some(res) = pull_stream.next().await {
        match res {
            Ok(info) => {
                if let Some(err) = info.error_detail.and_then(|ed| ed.message) {
                    pull_failed = true;
                    pull_error_msg = err;
                    break;
                }
            }
            Err(e) => {
                pull_failed = true;
                pull_error_msg = e.to_string();
                break;
            }
        }
    }

    // If default pull failed, retry with platform constraint
    if pull_failed {
        tracing::warn!("Default pull for {} failed ({}), retrying with explicit platform {}...", image_name, pull_error_msg, platform);
        let fallback_options = bollard::query_parameters::CreateImageOptions {
            from_image: Some(image_name.clone()),
            platform: platform.to_string(),
            ..Default::default()
        };
        let mut fallback_stream = docker.create_image(Some(fallback_options), None, None);
        let mut fallback_failed = false;
        let mut fallback_error_msg = String::new();

        while let Some(res) = fallback_stream.next().await {
            match res {
                Ok(info) => {
                    if let Some(err) = info.error_detail.and_then(|ed| ed.message) {
                        fallback_failed = true;
                        fallback_error_msg = err;
                        break;
                    }
                }
                Err(e) => {
                    fallback_failed = true;
                    fallback_error_msg = e.to_string();
                    break;
                }
            }
        }

        if fallback_failed {
            let final_err = if !fallback_error_msg.is_empty() {
                fallback_error_msg
            } else {
                pull_error_msg
            };
            update_task_status(
                &id,
                &clean_name,
                &image_name,
                "error",
                &format!("Falha ao baixar imagem '{}'", image_name),
                Some(final_err.clone()),
                Some(final_err.clone()),
            );
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "id": id,
                    "name": clean_name,
                    "image": image_name,
                    "status": "error",
                    "message": format!("Falha ao baixar imagem atualizada '{}'", image_name),
                    "details": final_err
                }))
            );
        }
    }

    update_task_status(
        &id,
        &clean_name,
        &image_name,
        "recreating",
        "Parando e recriando container...",
        None,
        None,
    );

    // 3. Multi-Network Handling & Sanitization
    let is_host_or_special_network = inspect.host_config.as_ref()
        .and_then(|h| h.network_mode.as_deref())
        .map(|m| m.eq_ignore_ascii_case("host") || m.eq_ignore_ascii_case("none") || m.starts_with("container:"))
        .unwrap_or(false);

    let (initial_networking_config, secondary_networks) = if is_host_or_special_network {
        (None, Vec::new())
    } else {
        let all_networks = inspect.network_settings.as_ref()
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
        image: Some(image_name.clone()),
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
    let _ = docker.stop_container(&id, Some(stop_options)).await;

    // 5. Remove old container
    let remove_options = bollard::query_parameters::RemoveContainerOptions {
        force: true,
        v: false,
        link: false,
    };
    if let Err(e) = docker.remove_container(&id, Some(remove_options)).await {
        let err_str = e.to_string();
        update_task_status(
            &id,
            &clean_name,
            &image_name,
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
            }))
        );
    }

    // 6. Create new container
    let create_options = bollard::query_parameters::CreateContainerOptions {
        name: Some(clean_name.to_string()),
        ..Default::default()
    };

    let created = match docker.create_container(Some(create_options), new_config.clone()).await {
        Ok(c) => c,
        Err(e) => {
            let fallback_create_options = bollard::query_parameters::CreateContainerOptions {
                name: Some(clean_name.to_string()),
                platform: platform.to_string(),
                ..Default::default()
            };
            match docker.create_container(Some(fallback_create_options), new_config).await {
                Ok(c) => c,
                Err(e2) => {
                    let err_str = format!("Primary create error: {}. Fallback error: {}", e, e2);
                    update_task_status(
                        &id,
                        &clean_name,
                        &image_name,
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
                        }))
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
            tracing::warn!("Failed to attach secondary network {} to container {}: {}", sec_net_name, created.id, e);
        }
    }

    // 8. Start new container
    match docker.start_container(&created.id, None::<bollard::query_parameters::StartContainerOptions>).await {
        Ok(_) => {
            if let Ok(mut cache) = UPDATE_CACHE.write() {
                cache.remove(&image_name);
            }

            let docker_clone = docker.clone();
            tokio::spawn(async move {
                let mut filters = std::collections::HashMap::new();
                filters.insert("dangling".to_string(), vec!["true".to_string()]);
                let _ = docker_clone.prune_images(Some(bollard::query_parameters::PruneImagesOptions { filters: Some(filters) })).await;
            });

            update_task_status(
                &id,
                &clean_name,
                &image_name,
                "success",
                "Container atualizado e reiniciado com sucesso!",
                None,
                None,
            );

            (StatusCode::OK, Json(serde_json::json!({
                "id": created.id,
                "name": clean_name,
                "image": image_name,
                "status": "success",
                "message": "Container atualizado e reiniciado com sucesso!"
            })))
        },
        Err(e) => {
            let err_str = e.to_string();
            update_task_status(
                &id,
                &clean_name,
                &image_name,
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
                }))
            )
        }
    }
}

pub async fn update_container(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<UpdateContainerQuery>,
) -> impl IntoResponse {
    let docker = state.docker.clone();

    // 1. Inspect existing container
    let inspect = match docker.inspect_container(&id, None::<bollard::query_parameters::InspectContainerOptions>).await {
        Ok(i) => i,
        Err(e) => return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "id": id,
                "status": "error",
                "message": format!("Container não encontrado: {}", e),
                "details": e.to_string()
            }))
        ).into_response(),
    };

    let name = inspect.name.clone().unwrap_or_else(|| id.clone());
    let clean_name = name.trim_start_matches('/').to_string();

    if clean_name == "orbit-dashboard" || clean_name == "orbit" {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "id": id,
                "name": clean_name,
                "status": "error",
                "message": "O Orbit Dashboard possui um ciclo de vida próprio e não pode ser recriado diretamente nesta fila para não derrubar a sessão ativa. Utilize o Atualizador do Sistema no topo da página.",
                "details": "Orbit container cannot self-terminate in batch updates"
            }))
        ).into_response();
    }

    let image_name = inspect.config.as_ref()
        .and_then(|c| c.image.as_ref())
        .cloned()
        .unwrap_or_default();

    // If caller explicitly wants synchronous execution (e.g. tests or CLI with ?wait=true)
    if query.wait.unwrap_or(false) {
        return execute_container_update(docker, id, clean_name, inspect).await.into_response();
    }

    // Default: Asynchronous background execution to prevent reverse proxy/Cloudflare HTTP 524 timeouts
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Prevent duplicate concurrent updates on the same container
    {
        if let Ok(tasks) = CONTAINER_UPDATE_TASKS.read() {
            if let Some(task) = tasks.get(&id) {
                if (task.status == "pulling" || task.status == "recreating") && (now - task.updated_at < 600) {
                    return (
                        StatusCode::OK,
                        Json(serde_json::json!({
                            "id": id,
                            "name": clean_name,
                            "image": image_name,
                            "status": "started",
                            "message": "Atualização já está em andamento para este container"
                        }))
                    ).into_response();
                }
            }
        }
    }

    update_task_status(
        &id,
        &clean_name,
        &image_name,
        "pulling",
        &format!("Iniciando download da imagem '{}'", image_name),
        None,
        None,
    );

    let task_id = id.clone();
    let task_name = clean_name.clone();
    tokio::spawn(async move {
        let _ = execute_container_update(docker, task_id, task_name, inspect).await;
    });

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "id": id,
            "name": clean_name,
            "image": image_name,
            "status": "started",
            "message": "Atualização iniciada em segundo plano"
        }))
    ).into_response()
}

pub async fn get_container_update_status(
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Ok(tasks) = CONTAINER_UPDATE_TASKS.read() {
        if let Some(task) = tasks.get(&id) {
            return (StatusCode::OK, Json(serde_json::to_value(task).unwrap_or_default())).into_response();
        }
    }

    (StatusCode::OK, Json(serde_json::json!({
        "id": id,
        "status": "idle",
        "step": "Nenhuma atualização ativa",
        "error": null,
        "details": null
    }))).into_response()
}
