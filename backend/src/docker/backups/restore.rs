use axum::http::StatusCode;
use std::fs;
use std::path::PathBuf;
use tokio::process::Command;
use tracing::info;

use super::ops::{copy_dir_all, get_backups_dir, load_backup_index, BACKUP_MUTEX};

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
                } else if safe_name.contains("orbit_configs") {
                    "orbit_configs".to_string()
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

    let manifest_path = staging_dir.join("orbit_manifest.json");
    let has_manifest = manifest_path.exists();

    let mut restored_apps = false;
    let mut restored_configs = false;

    if has_manifest {
        let manifest_content = fs::read_to_string(&manifest_path).unwrap_or_default();
        let parsed_manifest: serde_json::Value = serde_json::from_str(&manifest_content).unwrap_or_default();
        let resolved_target = parsed_manifest.get("target_type").and_then(|v| v.as_str()).unwrap_or(&target_type);

        if resolved_target == "system_full" || resolved_target == "orbit_configs" {
            let configs_dir = staging_dir.join("configs");
            if configs_dir.exists() {
                if let Ok(entries) = fs::read_dir(configs_dir) {
                    for entry in entries.flatten() {
                        let fname = entry.file_name();
                        let fname_str = fname.to_string_lossy();
                        if fname_str == "samba.json" {
                            let _ = fs::create_dir_all("data/config");
                            let _ = fs::copy(entry.path(), "data/config/samba.json");
                        } else if fname_str == "schedule.json" {
                            let _ = fs::create_dir_all("data/backups");
                            let _ = fs::copy(entry.path(), "data/backups/schedule.json");
                        } else {
                            let _ = fs::copy(entry.path(), PathBuf::from("data").join(&fname));
                        }
                    }
                    restored_configs = true;
                }
            }
        }

        if resolved_target == "system_full" || resolved_target == "all_containers" {
            let apps_dir = staging_dir.join("apps");
            if apps_dir.exists() {
                let _ = fs::create_dir_all("data/apps");
                let _ = copy_dir_all(&apps_dir, &PathBuf::from("data/apps"));
                restored_apps = true;
            }
        }

        if resolved_target == "single_app" {
            if let Ok(entries) = fs::read_dir(&staging_dir) {
                for entry in entries.flatten() {
                    if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) && entry.file_name() != "configs" && entry.file_name() != "apps" {
                        let target_app_dir = PathBuf::from("data/apps").join(entry.file_name());
                        let _ = copy_dir_all(&entry.path(), &target_app_dir);
                        let _ = Command::new("docker").args(["compose", "up", "-d"]).current_dir(&target_app_dir).output().await;
                        restored_apps = true;
                    }
                }
            }
        }
    } else {
        // Formato legado de aplicativo único descompactado diretamente em data/apps
        let _ = copy_dir_all(&staging_dir, &PathBuf::from("data/apps"));
        let target_app_dir = PathBuf::from("data/apps").join(&app_id);
        if target_app_dir.exists() {
            let _ = Command::new("docker").args(["compose", "up", "-d"]).current_dir(&target_app_dir).output().await;
        }
        restored_apps = true;
    }

    let _ = fs::remove_dir_all(&staging_dir);
    info!("Restauração concluída com sucesso para: {} (apps: {}, configs: {})", app_id, restored_apps, restored_configs);
    Ok((app_id, true))
}
