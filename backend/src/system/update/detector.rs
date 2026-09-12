use bollard::Docker;

pub struct DetectedOrbitContainer {
    pub id: Option<String>,
    pub name: Option<String>,
    pub inspect: Option<bollard::models::ContainerInspectResponse>,
    pub image_name: String,
}

pub struct DetectedComposeContext {
    pub host_compose_dir: Option<String>,
    pub compose_file_name: String,
    pub compose_project_name: Option<String>,
    pub detected_data_mount: String,
}

pub async fn find_active_orbit_container(docker: &Docker) -> DetectedOrbitContainer {
    let mut image_name = "ghcr.io/andrevictor20/orbit-dashboard:latest".to_string();
    let mut current_container_id: Option<String> = None;
    let mut current_container_name: Option<String> = None;
    let mut inspect_result: Option<bollard::models::ContainerInspectResponse> = None;

    // 1. First attempt: HOSTNAME env
    if let Ok(hostname) = std::env::var("HOSTNAME") {
        let clean_host = hostname.trim();
        if !clean_host.is_empty() {
            if let Ok(ins) = docker
                .inspect_container(
                    clean_host,
                    None::<bollard::query_parameters::InspectContainerOptions>,
                )
                .await
            {
                current_container_id = ins.id.clone();
                current_container_name =
                    ins.name.clone().map(|n| n.trim_start_matches('/').to_string());
                inspect_result = Some(ins);
            }
        }
    }

    // 2. Second attempt: well-known candidate names
    if inspect_result.is_none() {
        for cname in &["orbit-dashboard", "orbit", "Orbit", "orbit_dashboard", "orbit-app"] {
            if let Ok(ins) = docker
                .inspect_container(
                    cname,
                    None::<bollard::query_parameters::InspectContainerOptions>,
                )
                .await
            {
                current_container_id = ins.id.clone();
                current_container_name =
                    ins.name.clone().map(|n| n.trim_start_matches('/').to_string());
                inspect_result = Some(ins);
                break;
            }
        }
    }

    // 3. Third attempt: list containers
    if inspect_result.is_none() {
        let list_opts = bollard::query_parameters::ListContainersOptions {
            all: false,
            ..Default::default()
        };
        if let Ok(containers) = docker.list_containers(Some(list_opts)).await {
            for c in containers {
                let image_match = c
                    .image
                    .as_ref()
                    .map(|img| img.contains("orbit-dashboard"))
                    .unwrap_or(false);
                let name_match = c
                    .names
                    .as_ref()
                    .map(|names| {
                        names.iter().any(|n| {
                            let clean = n.trim_start_matches('/').to_lowercase();
                            clean == "orbit"
                                || clean.contains("orbit-dashboard")
                                || clean.starts_with("orbit")
                        })
                    })
                    .unwrap_or(false);

                if image_match || name_match {
                    if let Some(id) = c.id {
                        if let Ok(ins) = docker
                            .inspect_container(
                                &id,
                                None::<bollard::query_parameters::InspectContainerOptions>,
                            )
                            .await
                        {
                            current_container_id = ins.id.clone();
                            current_container_name =
                                ins.name.clone().map(|n| n.trim_start_matches('/').to_string());
                            inspect_result = Some(ins);
                            break;
                        }
                    }
                }
            }
        }
    }

    // Detect if Docker Hub image was used originally
    if let Some(ref ins) = inspect_result {
        if let Some(ref config) = ins.config {
            if let Some(ref img) = config.image {
                if img.contains("victorandre280/orbit-dashboard") {
                    image_name = "victorandre280/orbit-dashboard:latest".to_string();
                }
            }
        }
    }

    DetectedOrbitContainer {
        id: current_container_id,
        name: current_container_name,
        inspect: inspect_result,
        image_name,
    }
}

pub fn discover_compose_context(
    inspect_result: Option<&bollard::models::ContainerInspectResponse>,
) -> DetectedComposeContext {
    let mut host_compose_dir = None;
    let mut compose_file_name = "docker-compose.yml".to_string();
    let mut compose_project_name = None;
    let mut detected_data_mount = "orbit_data".to_string();

    if let Some(inspect) = inspect_result {
        if let Some(labels) = inspect.config.as_ref().and_then(|c| c.labels.as_ref()) {
            if let Some(proj) = labels.get("com.docker.compose.project") {
                if !proj.trim().is_empty() {
                    compose_project_name = Some(proj.clone());
                }
            }
            if let Some(work_dir) = labels.get("com.docker.compose.project.working_dir") {
                if !work_dir.trim().is_empty() {
                    host_compose_dir = Some(work_dir.clone());
                }
            }
            if let Some(cfg_files) = labels.get("com.docker.compose.project.config_files") {
                if let Some(first_file) = cfg_files.split(',').next() {
                    let p = std::path::Path::new(first_file.trim());
                    if let Some(fname) = p.file_name() {
                        compose_file_name = fname.to_string_lossy().to_string();
                    }
                }
            }
        }

        // Detect active /app/data mount (named volume or host bind-mount)
        if let Some(mounts) = &inspect.mounts {
            for m in mounts {
                if m.destination.as_deref() == Some("/app/data") {
                    if let Some(ref name) = m.name {
                        if !name.trim().is_empty() {
                            detected_data_mount = name.clone();
                            break;
                        }
                    }
                    if let Some(ref src) = m.source {
                        if !src.trim().is_empty()
                            && m.typ.as_ref().map(|t| t.to_string()) == Some("bind".to_string())
                        {
                            detected_data_mount = src.clone();
                            break;
                        }
                    }
                }
            }
        }
    }

    // Second attempt: Scan common host paths
    if host_compose_dir.is_none() {
        let candidate_bases = [
            "/host/DATA/orbit",
            "/host/data/orbit",
            "/host/root/orbit",
            "/host/opt/orbit",
            "/host/srv/orbit",
        ];
        for base in candidate_bases {
            if std::path::Path::new(base).join(&compose_file_name).exists() {
                let cleaned = base.strip_prefix("/host").unwrap_or(base).to_string();
                host_compose_dir = Some(cleaned);
                break;
            }
        }

        if host_compose_dir.is_none() {
            if let Ok(entries) = std::fs::read_dir("/host/home") {
                for entry in entries.flatten() {
                    let orbit_path = entry.path().join("orbit");
                    if orbit_path.join(&compose_file_name).exists() {
                        let host_str = orbit_path.to_string_lossy();
                        let cleaned = host_str
                            .strip_prefix("/host")
                            .unwrap_or(&host_str)
                            .to_string();
                        host_compose_dir = Some(cleaned);
                        break;
                    }
                }
            }
        }
    }

    DetectedComposeContext {
        host_compose_dir,
        compose_file_name,
        compose_project_name,
        detected_data_mount,
    }
}
