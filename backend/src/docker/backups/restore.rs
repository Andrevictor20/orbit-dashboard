use axum::http::StatusCode;
use std::fs;
use std::path::{Path, PathBuf};
use tokio::process::Command;
use tracing::{info, warn};

use super::ops::{copy_dir_all, get_backups_dir, load_backup_index, BACKUP_MUTEX, CONFIG_FILES};

/// Helper to execute docker compose up with force recreate
async fn start_docker_compose(app_dir: &Path) -> bool {
    let has_compose = app_dir.join("docker-compose.yml").exists()
        || app_dir.join("docker-compose.yaml").exists();
    if !has_compose {
        return false;
    }

    info!("Iniciando contêineres Docker restaurados em: {:?}", app_dir);

    // 1. Try modern `docker compose up -d --force-recreate`
    let res = Command::new("docker")
        .args(["compose", "up", "-d", "--force-recreate"])
        .current_dir(app_dir)
        .output()
        .await;

    match res {
        Ok(out) if out.status.success() => {
            info!("Contêineres iniciados com sucesso em {:?}", app_dir);
            return true;
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            warn!("docker compose falhou em {:?}: {}", app_dir, stderr);
        }
        Err(e) => {
            warn!("Erro ao invocar docker compose em {:?}: {}", app_dir, e);
        }
    }

    // 2. Fallback to `docker-compose up -d --force-recreate`
    let fallback = Command::new("docker-compose")
        .args(["up", "-d", "--force-recreate"])
        .current_dir(app_dir)
        .output()
        .await;

    match fallback {
        Ok(out) if out.status.success() => {
            info!("Contêineres iniciados com sucesso via docker-compose em {:?}", app_dir);
            true
        }
        _ => false,
    }
}

/// Helper to parse compose file to extract app name if generic
fn deduce_app_name_from_compose(compose_path: &Path) -> Option<String> {
    let content = fs::read_to_string(compose_path).ok()?;
    let val: serde_yaml::Value = serde_yaml::from_str(&content).ok()?;
    if let Some(name) = val.get("name").and_then(|n| n.as_str()) {
        if !name.trim().is_empty() {
            return Some(name.trim().to_string());
        }
    }
    if let Some(services) = val.get("services").and_then(|s| s.as_mapping()) {
        if let Some((first_key, service_val)) = services.iter().next() {
            if let Some(c_name) = service_val.get("container_name").and_then(|c| c.as_str()) {
                if !c_name.trim().is_empty() {
                    return Some(c_name.trim().to_string());
                }
            }
            if let Some(svc_name) = first_key.as_str() {
                if !svc_name.trim().is_empty() {
                    return Some(svc_name.trim().to_string());
                }
            }
        }
    }
    None
}

/// Discovers content root and manifest in staging directory
fn locate_content_root(staging_dir: &Path) -> (PathBuf, Option<PathBuf>) {
    let saturn_m = staging_dir.join("saturn_manifest.json");
    if saturn_m.exists() {
        return (staging_dir.to_path_buf(), Some(saturn_m));
    }
    

    // Check if staging_dir has a single wrapper directory
    if let Ok(entries) = fs::read_dir(staging_dir) {
        let subdirs: Vec<PathBuf> = entries
            .flatten()
            .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
            .map(|e| e.path())
            .collect();
        if subdirs.len() == 1 {
            let candidate = &subdirs[0];
            let sub_saturn = candidate.join("saturn_manifest.json");
            if sub_saturn.exists() {
                return (candidate.clone(), Some(sub_saturn));
            }
            
            // If the wrapper contains configs or apps, treat wrapper as content root
            if candidate.join("configs").exists() || candidate.join("apps").exists() || candidate.join("docker-compose.yml").exists() {
                return (candidate.clone(), None);
            }
        }
    }

    (staging_dir.to_path_buf(), None)
}

/// Restores configuration files from either configs/ folder or root of content_root
fn restore_system_configs(content_root: &Path) -> bool {
    let mut restored = false;
    let _ = fs::create_dir_all("data");

    let configs_dir = content_root.join("configs");
    let search_dirs = if configs_dir.exists() {
        vec![configs_dir, content_root.to_path_buf()]
    } else {
        vec![content_root.to_path_buf()]
    };

    let mut restored_files = std::collections::HashSet::new();

    for dir in search_dirs {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let fname = entry.file_name();
                let fname_str = fname.to_string_lossy();
                let is_known_config = CONFIG_FILES.iter().any(|&cfg| {
                    let base = Path::new(cfg).file_name().unwrap_or_default().to_string_lossy();
                    base == fname_str
                });

                if is_known_config && !restored_files.contains(&fname_str.to_string()) {
                    if fname_str == "samba.json" {
                        let _ = fs::create_dir_all("data/config");
                        let _ = fs::copy(entry.path(), "data/config/samba.json");
                    } else if fname_str == "schedule.json" {
                        let _ = fs::create_dir_all("data/backups");
                        let _ = fs::copy(entry.path(), "data/backups/schedule.json");
                    } else {
                        let _ = fs::copy(entry.path(), PathBuf::from("data").join(&fname));
                    }
                    restored_files.insert(fname_str.to_string());
                    restored = true;
                }
            }
        }
    }



    if restored {
        crate::links::reload_links_cache();
        crate::homeassistant::client::reload_ha_config_from_disk();
        crate::system::customization::reload_customization_from_disk();
        crate::cloudflare::client::reload_cloudflare_config_from_disk();
        crate::pihole::reload_pihole_config_from_disk();
        crate::system::settings::reload_settings_from_disk();
    }

    restored
}

pub async fn restore_backup_internal(id_or_filename: &str) -> Result<(String, bool), (StatusCode, String)> {
    let _lock = BACKUP_MUTEX.lock().await;

    let items = load_backup_index();
    let backup_opt = items.into_iter().find(|b| b.id == id_or_filename || b.filename == id_or_filename);

    let (filename, target_type, app_id) = match backup_opt {
        Some(b) => (b.filename, b.target_type, b.app_id),
        None => {
            let safe_name = id_or_filename.replace("..", "").replace('/', "");
            if get_backups_dir().join(&safe_name).exists() {
                let inferred_target = if safe_name.contains("system_full") {
                    "system_full".to_string()
                } else if safe_name.contains("saturn_configs") {
                    "saturn_configs".to_string()
                } else if safe_name.contains("all_containers") {
                    "all_containers".to_string()
                } else {
                    "single_app".to_string()
                };
                (safe_name, inferred_target, "app".to_string())
            } else {
                return Err((StatusCode::NOT_FOUND, "Backup não encontrado".to_string()));
            }
        }
    };

    let backup_path = get_backups_dir().join(&filename);
    if !backup_path.exists() {
        return Err((StatusCode::NOT_FOUND, "Arquivo físico de backup ausente".to_string()));
    }

    let staging_id = uuid::Uuid::new_v4().to_string();
    let staging_dir = get_backups_dir().join(format!(".restore_tmp_{}", staging_id));
    let _ = fs::create_dir_all(&staging_dir);

    let extract_output = Command::new("tar")
        .args(["-xzf", backup_path.to_str().unwrap_or(""), "-C", staging_dir.to_str().unwrap_or("")])
        .output()
        .await;

    if extract_output.is_err() || !extract_output.as_ref().unwrap().status.success() {
        let _ = fs::remove_dir_all(&staging_dir);
        return Err((StatusCode::INTERNAL_SERVER_ERROR, "Falha ao extrair arquivo de backup".to_string()));
    }

    let (content_root, manifest_path_opt) = locate_content_root(&staging_dir);

    let mut restored_apps = false;
    let mut restored_configs = false;
    let mut effective_app_id = app_id.clone();

    // 1. Check if manifest exists to resolve target type
    let resolved_target = if let Some(ref m_path) = manifest_path_opt {
        let manifest_content = fs::read_to_string(m_path).unwrap_or_default();
        let parsed_manifest: serde_json::Value = serde_json::from_str(&manifest_content).unwrap_or_default();
        if let Some(m_app_id) = parsed_manifest.get("app_id").and_then(|v| v.as_str()) {
            if !m_app_id.trim().is_empty() {
                effective_app_id = m_app_id.to_string();
            }
        }
        parsed_manifest.get("target_type").and_then(|v| v.as_str()).unwrap_or(&target_type).to_string()
    } else {
        target_type.clone()
    };

    // 2. Restore Configurations
    if resolved_target == "system_full" || resolved_target == "saturn_configs" || content_root.join("configs").exists() {
        restored_configs = restore_system_configs(&content_root);
    }

    // 3. Restore Apps / Containers
    let apps_dir = content_root.join("apps");
    if apps_dir.exists() {
        let _ = fs::create_dir_all("data/apps");
        let _ = copy_dir_all(&apps_dir, &PathBuf::from("data/apps"));
        restored_apps = true;

        if let Ok(entries) = fs::read_dir(&apps_dir) {
            for entry in entries.flatten() {
                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    let target_app = PathBuf::from("data/apps").join(entry.file_name());
                    let _ = start_docker_compose(&target_app).await;
                }
            }
        }
    }

    // 4. Single App / Direct Compose in Root or Subdirectories
    if !restored_apps {
        // Check if content_root has direct compose file
        let direct_compose = content_root.join("docker-compose.yml").exists() || content_root.join("docker-compose.yaml").exists();
        if direct_compose {
            let clean_app_id = if effective_app_id != "app" && effective_app_id != "uploaded-app" && !effective_app_id.trim().is_empty() {
                effective_app_id.clone()
            } else {
                let comp_file = if content_root.join("docker-compose.yml").exists() {
                    content_root.join("docker-compose.yml")
                } else {
                    content_root.join("docker-compose.yaml")
                };
                deduce_app_name_from_compose(&comp_file).unwrap_or_else(|| "restored-app".to_string())
            };
            let target_app_dir = PathBuf::from("data/apps").join(&clean_app_id);
            let _ = fs::create_dir_all(&target_app_dir);
            let _ = copy_dir_all(&content_root, &target_app_dir);
            let _ = start_docker_compose(&target_app_dir).await;
            effective_app_id = clean_app_id;
            restored_apps = true;
        } else if let Ok(entries) = fs::read_dir(&content_root) {
            // Check subdirectories for compose stacks
            for entry in entries.flatten() {
                let path = entry.path();
                let fname = entry.file_name();
                let fname_str = fname.to_string_lossy();
                if path.is_dir() && fname_str != "configs" && fname_str != "apps" && !fname_str.starts_with('.') {
                    let has_compose = path.join("docker-compose.yml").exists() || path.join("docker-compose.yaml").exists();
                    if has_compose {
                        let target_app_dir = PathBuf::from("data/apps").join(&fname);
                        let _ = fs::create_dir_all(&target_app_dir);
                        let _ = copy_dir_all(&path, &target_app_dir);
                        let _ = start_docker_compose(&target_app_dir).await;
                        effective_app_id = fname_str.to_string();
                        restored_apps = true;
                    }
                }
            }
        }
    }

    // 5. If manifest or explicit request was configs-only, also ensure configs are restored
    if !restored_configs && (resolved_target == "saturn_configs" || resolved_target == "system_full") {
        restored_configs = restore_system_configs(&content_root);
    }

    let _ = fs::remove_dir_all(&staging_dir);
    info!("Restauração concluída para: {} (apps: {}, configs: {})", effective_app_id, restored_apps, restored_configs);
    Ok((effective_app_id, true))
}
