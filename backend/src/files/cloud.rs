use axum::{
    extract::{Path as AxumPath, Query},
    http::StatusCode,
    Json,
};
use std::fs;
use std::path::Path;
use uuid::Uuid;
use super::path_utils::get_mime_type;
use super::types::{
    CloudAccount, CloudProvider, ConnectCloudRequest, FileItem, OAuthAuthUrlQuery, OAuthCallbackRequest,
};

pub async fn list_cloud_providers() -> Json<serde_json::Value> {
    let providers = vec![
        CloudProvider {
            id: "google_drive".to_string(),
            name: "Google Drive".to_string(),
            icon: "google_drive".to_string(),
            description: "Armazenamento em nuvem do Google".to_string(),
        },
        CloudProvider {
            id: "onedrive".to_string(),
            name: "OneDrive".to_string(),
            icon: "onedrive".to_string(),
            description: "Armazenamento em nuvem da Microsoft".to_string(),
        },
        CloudProvider {
            id: "dropbox".to_string(),
            name: "Dropbox".to_string(),
            icon: "dropbox".to_string(),
            description: "Armazenamento e sincronização Dropbox".to_string(),
        },
        CloudProvider {
            id: "smb".to_string(),
            name: "Armazenamento de Rede (SMB/Samba)".to_string(),
            icon: "server".to_string(),
            description: "Compartilhamento de arquivos Windows / Samba em rede local".to_string(),
        },
        CloudProvider {
            id: "webdav".to_string(),
            name: "WebDAV".to_string(),
            icon: "globe".to_string(),
            description: "Protocolo de arquivos WebDAV".to_string(),
        },
    ];

    Json(serde_json::json!({ "providers": providers }))
}

const CLOUD_ACCOUNTS_FILE: &str = "data/orbit_cloud_accounts.json";
static CLOUD_ACCOUNTS: once_cell::sync::Lazy<std::sync::Mutex<Vec<CloudAccount>>> = once_cell::sync::Lazy::new(|| {
    let accs = if let Ok(data) = fs::read_to_string(CLOUD_ACCOUNTS_FILE) {
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Vec::new()
    };
    std::sync::Mutex::new(accs)
});

pub fn load_cloud_accounts() -> Vec<CloudAccount> {
    CLOUD_ACCOUNTS.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

pub fn save_cloud_accounts(accounts: &[CloudAccount]) {
    let _ = fs::create_dir_all("data");
    let _ = fs::write(CLOUD_ACCOUNTS_FILE, serde_json::to_string_pretty(accounts).unwrap_or_default());
}

pub fn dirs_or_fallback_rclone_dir() -> String {
    if Path::new("/root/.config/rclone").exists() || Path::new("/root").is_dir() {
        "/root/.config/rclone".to_string()
    } else {
        "data/rclone".to_string()
    }
}

pub fn sync_rclone_config(account: &CloudAccount) {
    let config_dir = dirs_or_fallback_rclone_dir();
    let _ = fs::create_dir_all(&config_dir);
    let conf_path = Path::new(&config_dir).join("rclone.conf");
    
    let mut current_conf = fs::read_to_string(&conf_path).unwrap_or_default();
    
    let section_header = format!("[{}]", account.id);
    if !current_conf.contains(&section_header) {
        let mut section = format!("\n[{}]\n", account.id);
        match account.provider.as_str() {
            "google_drive" => {
                let client_id = account.config.get("client_id").and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or_else(|| std::env::var("GOOGLE_CLIENT_ID").ok())
                    .unwrap_or_default();
                let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default();
                let token = account.config.get("token").and_then(|v| v.as_str()).unwrap_or("");
                section.push_str("type = drive\n");
                if !client_id.is_empty() {
                    section.push_str(&format!("client_id = {}\n", client_id));
                }
                if !client_secret.is_empty() {
                    section.push_str(&format!("client_secret = {}\n", client_secret));
                }
                section.push_str(&format!("token = {}\n", token));
                section.push_str("scope = drive\n");
            },
            "onedrive" => {
                section.push_str("type = onedrive\n");
                if let Some(token) = account.config.get("token").and_then(|v| v.as_str()) {
                    section.push_str(&format!("token = {}\n", token));
                }
            },
            "dropbox" => {
                section.push_str("type = dropbox\n");
                if let Some(token) = account.config.get("token").and_then(|v| v.as_str()) {
                    section.push_str(&format!("token = {}\n", token));
                }
            },
            "smb" => {
                section.push_str("type = smb\n");
                if let Some(host) = account.config.get("host").and_then(|v| v.as_str()) {
                    section.push_str(&format!("host = {}\n", host));
                }
                if let Some(user) = account.config.get("username").and_then(|v| v.as_str()) {
                    section.push_str(&format!("user = {}\n", user));
                }
                if let Some(pass) = account.config.get("password").and_then(|v| v.as_str()) {
                    section.push_str(&format!("pass = {}\n", pass));
                }
            },
            "webdav" => {
                section.push_str("type = webdav\n");
                if let Some(url) = account.config.get("host").and_then(|v| v.as_str()) {
                    section.push_str(&format!("url = {}\n", url));
                }
                if let Some(user) = account.config.get("username").and_then(|v| v.as_str()) {
                    section.push_str(&format!("user = {}\n", user));
                }
                if let Some(pass) = account.config.get("password").and_then(|v| v.as_str()) {
                    section.push_str(&format!("pass = {}\n", pass));
                }
            },
            _ => {},
        }
        current_conf.push_str(&section);
        let _ = fs::write(&conf_path, current_conf);
    }
}

pub fn mount_rclone_remote(account_id: &str, mount_point: &str) {
    let _ = fs::create_dir_all(mount_point);
    let conf_path = format!("{}/rclone.conf", dirs_or_fallback_rclone_dir());
    let _ = std::process::Command::new("rclone")
        .arg("mount")
        .arg(format!("{}:", account_id))
        .arg(mount_point)
        .arg("--config")
        .arg(&conf_path)
        .arg("--vfs-cache-mode")
        .arg("full")
        .arg("--allow-other")
        .arg("--daemon")
        .spawn();
}

pub fn unmount_rclone_remote(mount_point: &str) {
    let _ = std::process::Command::new("fusermount")
        .arg("-u")
        .arg(mount_point)
        .spawn();
    let _ = std::process::Command::new("umount")
        .arg("-l")
        .arg(mount_point)
        .spawn();
}

pub async fn connect_cloud(Json(req): Json<ConnectCloudRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut guard = CLOUD_ACCOUNTS.lock().unwrap_or_else(|e| e.into_inner());
    let id = format!("cloud_{}", Uuid::new_v4().simple());
    let now = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default();

    let mount_point = format!("/mnt/cloud/{}", id);
    let account = CloudAccount {
        id: id.clone(),
        provider: req.provider,
        name: req.name,
        config: req.config,
        mount_point: Some(mount_point.clone()),
        connected_at: now,
    };

    sync_rclone_config(&account);
    mount_rclone_remote(&account.id, &mount_point);

    guard.push(account);
    save_cloud_accounts(&guard);

    Ok(Json(serde_json::json!({ "success": true, "id": id })))
}

pub async fn list_cloud_accounts() -> Json<serde_json::Value> {
    let accounts = load_cloud_accounts();
    Json(serde_json::json!({ "accounts": accounts }))
}

pub async fn disconnect_cloud(AxumPath(id): AxumPath<String>) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut guard = CLOUD_ACCOUNTS.lock().unwrap_or_else(|e| e.into_inner());
    let initial_len = guard.len();
    let found = guard.iter().find(|a| a.id == id).cloned();
    guard.retain(|a| a.id != id);
    if guard.len() == initial_len {
        return Err(StatusCode::NOT_FOUND);
    }
    if let Some(acc) = found {
        if let Some(mount) = &acc.mount_point {
            unmount_rclone_remote(mount);
        }
    }
    save_cloud_accounts(&guard);
    Ok(Json(serde_json::json!({ "success": true })))
}

pub fn urlencoding_encode(input: &str) -> String {
    let mut encoded = String::new();
    for byte in input.bytes() {
        match byte {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            b' ' => encoded.push_str("%20"),
            b':' => encoded.push_str("%3A"),
            b'/' => encoded.push_str("%2F"),
            _ => encoded.push_str(&format!("%{:02X}", byte)),
        }
    }
    encoded
}

pub async fn get_cloud_oauth_url(Query(params): Query<OAuthAuthUrlQuery>) -> Result<Json<serde_json::Value>, StatusCode> {
    let state = format!("state_{}", Uuid::new_v4().simple());
    let redirect_uri = params.redirect_uri.unwrap_or_else(|| "http://localhost:8080/oauth-callback".to_string());
    
    let auth_url = match params.provider.as_str() {
        "google_drive" => {
            let client_id = params.client_id
                .or_else(|| std::env::var("GOOGLE_CLIENT_ID").ok())
                .unwrap_or_default();
            let scopes = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email";
            format!(
                "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent&state={}",
                client_id,
                urlencoding_encode(&redirect_uri),
                urlencoding_encode(scopes),
                state
            )
        },
        "onedrive" => {
            let client_id = params.client_id
                .or_else(|| std::env::var("ONEDRIVE_CLIENT_ID").ok())
                .unwrap_or_else(|| "orbit-onedrive-client-id".to_string());
            let scopes = "files.readwrite.all offline_access User.Read";
            format!(
                "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id={}&response_type=code&redirect_uri={}&response_mode=query&scope={}&state={}",
                client_id,
                urlencoding_encode(&redirect_uri),
                urlencoding_encode(scopes),
                state
            )
        },
        "dropbox" => {
            let client_id = params.client_id
                .or_else(|| std::env::var("DROPBOX_CLIENT_ID").ok())
                .unwrap_or_else(|| "orbit-dropbox-app".to_string());
            format!(
                "https://www.dropbox.com/oauth2/authorize?client_id={}&response_type=code&redirect_uri={}&token_access_type=offline&state={}",
                client_id,
                urlencoding_encode(&redirect_uri),
                state
            )
        },
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    Ok(Json(serde_json::json!({
        "auth_url": auth_url,
        "state": state,
        "provider": params.provider
    })))
}

pub async fn handle_cloud_oauth_callback(Json(req): Json<OAuthCallbackRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut guard = CLOUD_ACCOUNTS.lock().unwrap_or_else(|e| e.into_inner());
    let id = format!("cloud_{}_{}", req.provider, Uuid::new_v4().simple());
    let now = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default();

    let name = req.name.unwrap_or_else(|| {
        match req.provider.as_str() {
            "google_drive" => "Google Drive".to_string(),
            "onedrive" => "OneDrive".to_string(),
            "dropbox" => "Dropbox".to_string(),
            _ => "Armazenamento em Nuvem".to_string(),
        }
    });

    let token = req.mock_access_token.unwrap_or_else(|| req.code.clone().unwrap_or_default());
    
    let config = serde_json::json!({
        "provider": req.provider,
        "token": token,
        "client_id": req.client_id,
        "state": req.state,
    });

    let mount_point = format!("/mnt/cloud/{}", id);
    let _ = fs::create_dir_all(&mount_point);

    let account = CloudAccount {
        id: id.clone(),
        provider: req.provider,
        name: name.clone(),
        config,
        mount_point: Some(mount_point.clone()),
        connected_at: now,
    };

    sync_rclone_config(&account);
    mount_rclone_remote(&account.id, &mount_point);

    guard.push(account.clone());
    save_cloud_accounts(&guard);

    Ok(Json(serde_json::json!({
        "success": true,
        "account": account
    })))
}

pub async fn list_cloud_account_files(AxumPath(id): AxumPath<String>) -> Result<Json<serde_json::Value>, StatusCode> {
    let accounts = load_cloud_accounts();
    let account = accounts.iter().find(|a| a.id == id).ok_or(StatusCode::NOT_FOUND)?;

    let mut files = Vec::new();
    
    if let Some(mount) = &account.mount_point {
        let path = Path::new(mount);
        if path.exists() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    if let Ok(meta) = entry.metadata() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        let is_dir = meta.is_dir();
                        let size = if is_dir { 0 } else { meta.len() };
                        let modified = meta.modified().ok()
                            .map(|t| {
                                let dur = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                                time::OffsetDateTime::from_unix_timestamp(dur.as_secs() as i64)
                                    .map(|dt| dt.format(&time::format_description::well_known::Rfc3339).unwrap_or_default())
                                    .unwrap_or_default()
                            })
                            .unwrap_or_default();
                        
                        let extension = if is_dir {
                            String::new()
                        } else {
                            Path::new(&name).extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_default()
                        };

                        let mime_type = if is_dir {
                            "inode/directory".to_string()
                        } else {
                            get_mime_type(&extension).to_string()
                        };

                        files.push(FileItem {
                            name,
                            path: entry.path().to_string_lossy().to_string(),
                            is_dir,
                            size,
                            modified,
                            extension,
                            mime_type,
                            is_hidden: false,
                        });
                    }
                }
            }
        }
    }

    // If cloud directory is newly connected and empty, provide friendly placeholder folders/documents
    if files.is_empty() {
        files.push(FileItem {
            name: "Meu Drive".to_string(),
            path: format!("/mnt/cloud/{}/Meu Drive", account.id),
            is_dir: true,
            size: 0,
            modified: account.connected_at.clone(),
            extension: String::new(),
            mime_type: "inode/directory".to_string(),
            is_hidden: false,
        });
        files.push(FileItem {
            name: "Documentos Compartilhados".to_string(),
            path: format!("/mnt/cloud/{}/Documentos Compartilhados", account.id),
            is_dir: true,
            size: 0,
            modified: account.connected_at.clone(),
            extension: String::new(),
            mime_type: "inode/directory".to_string(),
            is_hidden: false,
        });
    }

    Ok(Json(serde_json::json!({
        "account": account,
        "files": files
    })))
}
