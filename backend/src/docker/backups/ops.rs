use axum::http::StatusCode;
use once_cell::sync::Lazy;
use std::fs;
use std::path::PathBuf;
use tokio::process::Command;
use tracing::info;

use super::models::{BackupItem, BackupScheduleConfig};

pub static BACKUP_MUTEX: Lazy<tokio::sync::Mutex<()>> = Lazy::new(|| tokio::sync::Mutex::new(()));

pub fn get_backups_dir() -> PathBuf {
    let candidate = PathBuf::from("data/backups");
    let _ = fs::create_dir_all(&candidate);
    candidate
}

pub fn get_index_path() -> PathBuf {
    get_backups_dir().join("index.json")
}

pub fn get_schedule_path() -> PathBuf {
    get_backups_dir().join("schedule.json")
}

pub fn load_backup_index() -> Vec<BackupItem> {
    let path = get_index_path();
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(items) = serde_json::from_str::<Vec<BackupItem>>(&content) {
            // Filter out items whose physical file no longer exists
            let dir = get_backups_dir();
            return items
                .into_iter()
                .filter(|b| dir.join(&b.filename).exists())
                .collect();
        }
    }
    Vec::new()
}

pub fn save_backup_index(items: &[BackupItem]) {
    let path = get_index_path();
    if let Ok(content) = serde_json::to_string_pretty(items) {
        let _ = fs::write(&path, content);
    }
}

pub fn load_schedule_config() -> BackupScheduleConfig {
    let path = get_schedule_path();
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(config) = serde_json::from_str::<BackupScheduleConfig>(&content) {
            return config;
        }
    }
    BackupScheduleConfig::default()
}

pub fn save_schedule_config_internal(config: &BackupScheduleConfig) {
    let path = get_schedule_path();
    if let Ok(content) = serde_json::to_string_pretty(config) {
        let _ = fs::write(&path, content);
    }
}

pub const CONFIG_FILES: &[&str] = &[
    "orbit_auth.json",
    "custom_links.json",
    "settings.json",
    "pihole.json",
    "cloudflare.json",
    "jwt.secret",
    "config/samba.json",
    "backups/schedule.json",
];

pub(crate) fn copy_dir_all(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}

pub fn prune_retention(items: &mut Vec<BackupItem>, app_id: &str, retention: usize) {
    if retention == 0 {
        return;
    }
    let mut count = 0;
    let dir = get_backups_dir();

    items.retain(|item| {
        if item.app_id == app_id {
            count += 1;
            if count > retention {
                let path = dir.join(&item.filename);
                let _ = fs::remove_file(path);
                false
            } else {
                true
            }
        } else {
            true
        }
    });
}

pub async fn create_backup_dispatch(
    target_type_raw: &str,
    app_id_raw: &str,
    stop: bool,
    backup_type: &str,
) -> Result<BackupItem, (StatusCode, String)> {
    let target = if !target_type_raw.is_empty() {
        target_type_raw
    } else if !app_id_raw.is_empty() {
        app_id_raw
    } else {
        "system_full"
    };

    match target {
        "system_full" => create_full_system_backup_internal(stop, backup_type).await,
        "orbit_configs" => create_orbit_configs_backup_internal(backup_type).await,
        "all_containers" => create_all_containers_backup_internal(stop, backup_type).await,
        other => create_single_app_backup_internal(other, stop, backup_type).await,
    }
}

pub async fn create_backup_internal(
    app_id_raw: &str,
    stop: bool,
    backup_type: &str,
) -> Result<BackupItem, (StatusCode, String)> {
    create_backup_dispatch("", app_id_raw, stop, backup_type).await
}

fn get_timestamp_and_suffix() -> (String, String) {
    let now = time::OffsetDateTime::now_utc();
    let timestamp_str = now
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default();
    let file_suffix = now
        .format(&time::macros::format_description!(
            "[year][month][day]_[hour][minute][second]"
        ))
        .unwrap_or_else(|_| "backup".to_string());
    (timestamp_str, file_suffix)
}

fn copy_system_configs_to_staging(configs_staging: &std::path::Path) {
    let _ = fs::create_dir_all(configs_staging);
    for file in CONFIG_FILES {
        let src = PathBuf::from("data").join(file);
        if src.exists() {
            let filename = src.file_name().unwrap_or_default();
            let _ = fs::copy(&src, configs_staging.join(filename));
        }
    }
}

fn dump_containers_manifest_to_staging(staging_dir: &std::path::Path) {
    let manifest_path = staging_dir.join("containers_manifest.json");
    if let Ok(output) = std::process::Command::new("docker")
        .args(["ps", "-a", "--format", "{{json .}}"])
        .output()
    {
        if output.status.success() {
            let _ = fs::write(manifest_path, output.stdout);
            return;
        }
    }
    let _ = fs::write(manifest_path, "[]");
}

pub async fn create_full_system_backup_internal(
    stop: bool,
    backup_type: &str,
) -> Result<BackupItem, (StatusCode, String)> {
    let _lock = BACKUP_MUTEX.lock().await;
    let (timestamp_str, file_suffix) = get_timestamp_and_suffix();
    let filename = format!("backup_system_full_{}.tar.gz", file_suffix);
    let backup_path = get_backups_dir().join(&filename);
    let staging_id = uuid::Uuid::new_v4().to_string();
    let staging_dir = get_backups_dir().join(format!(".tmp_full_{}", staging_id));
    let _ = fs::create_dir_all(&staging_dir);

    // 1. Manifest
    let manifest = serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "target_type": "system_full",
        "app_id": "system_full",
        "app_name": "Sistema Completo (Orbit + Containers)",
        "created_at": timestamp_str,
        "includes_apps": true,
        "includes_configs": true,
        "description": "Backup completo das configurações do Orbit, integrações e todos os contêineres e volumes"
    });
    let _ = fs::write(staging_dir.join("orbit_manifest.json"), manifest.to_string());

    // 2. Configs & Containers Manifest
    copy_system_configs_to_staging(&staging_dir.join("configs"));
    dump_containers_manifest_to_staging(&staging_dir);

    // 3. Apps & Containers Data
    let apps_source = PathBuf::from("data/apps");
    if apps_source.exists() {
        if stop {
            let _ = Command::new("docker").args(["compose", "stop"]).current_dir(&apps_source).output().await;
        }
        let _ = copy_dir_all(&apps_source, &staging_dir.join("apps"));
        if stop {
            let _ = Command::new("docker").args(["compose", "start"]).current_dir(&apps_source).output().await;
        }
    }

    // 4. Compactação Tar
    let tar_result = Command::new("tar")
        .args(["-czf", backup_path.to_str().unwrap_or(""), "-C", staging_dir.to_str().unwrap_or(""), "."])
        .output()
        .await;

    let _ = fs::remove_dir_all(&staging_dir);

    match tar_result {
        Ok(output) if output.status.success() => {
            let size = backup_path.metadata().map(|m| m.len()).unwrap_or(0);
            let backup_item = BackupItem {
                id: uuid::Uuid::new_v4().to_string(),
                app_id: "system_full".to_string(),
                app_name: "Sistema Completo (Orbit + Containers)".to_string(),
                filename: filename.clone(),
                size_bytes: size,
                created_at: timestamp_str,
                status: "completed".to_string(),
                backup_type: backup_type.to_string(),
                target_type: "system_full".to_string(),
                description: Some("Backup completo das configurações do Orbit, integrações e contêineres".to_string()),
            };
            let mut current = load_backup_index();
            current.insert(0, backup_item.clone());
            save_backup_index(&current);
            info!("Backup completo criado com sucesso: {} bytes", size);
            Ok(backup_item)
        }
        Ok(out) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Falha no tar: {}", String::from_utf8_lossy(&out.stderr)))),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Erro ao executar tar: {}", e))),
    }
}

pub async fn create_orbit_configs_backup_internal(
    backup_type: &str,
) -> Result<BackupItem, (StatusCode, String)> {
    let _lock = BACKUP_MUTEX.lock().await;
    let (timestamp_str, file_suffix) = get_timestamp_and_suffix();
    let filename = format!("backup_orbit_configs_{}.tar.gz", file_suffix);
    let backup_path = get_backups_dir().join(&filename);
    let staging_id = uuid::Uuid::new_v4().to_string();
    let staging_dir = get_backups_dir().join(format!(".tmp_cfg_{}", staging_id));
    let _ = fs::create_dir_all(&staging_dir);

    let manifest = serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "target_type": "orbit_configs",
        "app_id": "orbit_configs",
        "app_name": "Configurações Orbit & Integrações",
        "created_at": timestamp_str,
        "includes_apps": false,
        "includes_configs": true,
        "description": "Autenticação, usuários, credenciais, integrações (HA, Cloudflare, Pi-hole, Samba) e preferências"
    });
    let _ = fs::write(staging_dir.join("orbit_manifest.json"), manifest.to_string());
    copy_system_configs_to_staging(&staging_dir.join("configs"));

    let tar_result = Command::new("tar")
        .args(["-czf", backup_path.to_str().unwrap_or(""), "-C", staging_dir.to_str().unwrap_or(""), "."])
        .output()
        .await;

    let _ = fs::remove_dir_all(&staging_dir);

    match tar_result {
        Ok(output) if output.status.success() => {
            let size = backup_path.metadata().map(|m| m.len()).unwrap_or(0);
            let backup_item = BackupItem {
                id: uuid::Uuid::new_v4().to_string(),
                app_id: "orbit_configs".to_string(),
                app_name: "Configurações Orbit & Integrações".to_string(),
                filename: filename.clone(),
                size_bytes: size,
                created_at: timestamp_str,
                status: "completed".to_string(),
                backup_type: backup_type.to_string(),
                target_type: "orbit_configs".to_string(),
                description: Some("Configurações, credenciais e integrações do Orbit".to_string()),
            };
            let mut current = load_backup_index();
            current.insert(0, backup_item.clone());
            save_backup_index(&current);
            Ok(backup_item)
        }
        Ok(out) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Falha no tar: {}", String::from_utf8_lossy(&out.stderr)))),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Erro ao executar tar: {}", e))),
    }
}

pub async fn create_all_containers_backup_internal(
    stop: bool,
    backup_type: &str,
) -> Result<BackupItem, (StatusCode, String)> {
    let _lock = BACKUP_MUTEX.lock().await;
    let (timestamp_str, file_suffix) = get_timestamp_and_suffix();
    let filename = format!("backup_all_containers_{}.tar.gz", file_suffix);
    let backup_path = get_backups_dir().join(&filename);
    let staging_id = uuid::Uuid::new_v4().to_string();
    let staging_dir = get_backups_dir().join(format!(".tmp_apps_{}", staging_id));
    let _ = fs::create_dir_all(&staging_dir);

    let manifest = serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "target_type": "all_containers",
        "app_id": "all_containers",
        "app_name": "Todos os Contêineres & Stacks",
        "created_at": timestamp_str,
        "includes_apps": true,
        "includes_configs": false
    });
    let _ = fs::write(staging_dir.join("orbit_manifest.json"), manifest.to_string());
    dump_containers_manifest_to_staging(&staging_dir);

    let apps_source = PathBuf::from("data/apps");
    if apps_source.exists() {
        if stop {
            let _ = Command::new("docker").args(["compose", "stop"]).current_dir(&apps_source).output().await;
        }
        let _ = copy_dir_all(&apps_source, &staging_dir.join("apps"));
        if stop {
            let _ = Command::new("docker").args(["compose", "start"]).current_dir(&apps_source).output().await;
        }
    }

    let tar_result = Command::new("tar")
        .args(["-czf", backup_path.to_str().unwrap_or(""), "-C", staging_dir.to_str().unwrap_or(""), "."])
        .output()
        .await;

    let _ = fs::remove_dir_all(&staging_dir);

    match tar_result {
        Ok(output) if output.status.success() => {
            let size = backup_path.metadata().map(|m| m.len()).unwrap_or(0);
            let backup_item = BackupItem {
                id: uuid::Uuid::new_v4().to_string(),
                app_id: "all_containers".to_string(),
                app_name: "Todos os Contêineres & Stacks".to_string(),
                filename: filename.clone(),
                size_bytes: size,
                created_at: timestamp_str,
                status: "completed".to_string(),
                backup_type: backup_type.to_string(),
                target_type: "all_containers".to_string(),
                description: Some("Todos os contêineres gerenciados e dados persistidos".to_string()),
            };
            let mut current = load_backup_index();
            current.insert(0, backup_item.clone());
            save_backup_index(&current);
            Ok(backup_item)
        }
        Ok(out) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Falha no tar: {}", String::from_utf8_lossy(&out.stderr)))),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Erro ao executar tar: {}", e))),
    }
}

pub async fn create_single_app_backup_internal(
    app_id_raw: &str,
    stop: bool,
    backup_type: &str,
) -> Result<BackupItem, (StatusCode, String)> {
    let _lock = BACKUP_MUTEX.lock().await;
    let app_id = app_id_raw.trim().replace("..", "").replace('/', "-");
    let app_dir = PathBuf::from("data/apps").join(&app_id);

    if !app_dir.exists() {
        return Err((StatusCode::NOT_FOUND, "Pasta do aplicativo não encontrada".to_string()));
    }

    let (timestamp_str, file_suffix) = get_timestamp_and_suffix();
    let filename = format!("backup_{}_{}.tar.gz", app_id, file_suffix);
    let backup_path = get_backups_dir().join(&filename);

    info!("Iniciando backup para aplicativo {} em {}", app_id, backup_path.display());

    if stop {
        let _ = Command::new("docker").args(["compose", "stop"]).current_dir(&app_dir).output().await;
    }

    let tar_result = Command::new("tar")
        .args(["-czf", backup_path.to_str().unwrap_or(""), "-C", "data/apps", &app_id])
        .output()
        .await;

    if stop {
        let _ = Command::new("docker").args(["compose", "start"]).current_dir(&app_dir).output().await;
    }

    match tar_result {
        Ok(output) if output.status.success() => {
            let size = backup_path.metadata().map(|m| m.len()).unwrap_or(0);
            let backup_item = BackupItem {
                id: uuid::Uuid::new_v4().to_string(),
                app_id: app_id.clone(),
                app_name: app_id.clone(),
                filename: filename.clone(),
                size_bytes: size,
                created_at: timestamp_str,
                status: "completed".to_string(),
                backup_type: backup_type.to_string(),
                target_type: "single_app".to_string(),
                description: Some(format!("Backup do aplicativo {}", app_id)),
            };

            let mut current = load_backup_index();
            current.insert(0, backup_item.clone());
            let config = load_schedule_config();
            prune_retention(&mut current, &app_id, config.retention_count);
            save_backup_index(&current);
            Ok(backup_item)
        }
        Ok(out) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Falha no tar: {}", String::from_utf8_lossy(&out.stderr)))),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Erro ao executar tar: {}", e))),
    }
}

