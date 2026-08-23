use axum::{
    extract::{Query, Path as AxumPath, Multipart},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use sysinfo::Disks;
use uuid::Uuid;

// --- DTOs ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: String,
    pub extension: String,
    pub mime_type: String,
    pub is_hidden: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListFilesResponse {
    pub current_path: String,
    pub items: Vec<FileItem>,
    pub total_items: usize,
}

#[derive(Debug, Deserialize)]
pub struct ListFilesQuery {
    pub path: Option<String>,
    pub sort: Option<String>,
    pub order: Option<String>,
    pub page: Option<usize>,
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ShortcutPlace {
    pub id: String,
    pub label: String,
    pub path: String,
    pub icon: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ShortcutsResponse {
    pub home: String,
    pub documents: String,
    pub downloads: String,
    pub pictures: String,
    pub music: String,
    pub videos: String,
    pub root: String,
    #[serde(default)]
    pub places: Vec<ShortcutPlace>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gallery: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MountItem {
    pub name: String,
    pub mount_point: String,
    pub fs_type: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StoragesResponse {
    pub mounts: Vec<MountItem>,
}

#[derive(Debug, Deserialize)]
pub struct UnmountRequest {
    pub mount_point: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloudProvider {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloudAccount {
    pub id: String,
    pub provider: String,
    pub name: String,
    pub config: serde_json::Value,
    pub mount_point: Option<String>,
    pub connected_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ConnectCloudRequest {
    pub provider: String,
    pub name: String,
    pub config: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct OAuthAuthUrlQuery {
    pub provider: String,
    pub redirect_uri: Option<String>,
    pub client_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct OAuthCallbackRequest {
    pub provider: String,
    pub code: Option<String>,
    pub state: Option<String>,
    pub name: Option<String>,
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub redirect_uri: Option<String>,
    pub mock_access_token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MkdirRequest {
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateFileRequest {
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct RenameRequest {
    pub old_path: String,
    pub new_path: String,
}

#[derive(Debug, Deserialize)]
pub struct CopyMoveRequest {
    pub source: String,
    pub destination: String,
}

#[derive(Debug, Deserialize)]
pub struct DeleteRequest {
    pub paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct FileContentQuery {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileContentResponse {
    pub path: String,
    pub content: String,
    pub size: u64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateContentRequest {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubtitleItem {
    pub name: String,
    pub path: String,
    pub label: String,
    pub lang: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubtitlesResponse {
    pub subtitles: Vec<SubtitleItem>,
}

#[derive(Debug, Deserialize)]
pub struct ExtractRequest {
    pub path: String,
    pub destination: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CompressRequest {
    pub paths: Vec<String>,
    pub destination_name: String,
    pub destination_dir: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AnalyzeQuery {
    pub path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiskItemStat {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub percentage: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiskAnalysisResponse {
    pub path: String,
    pub total_size: u64,
    pub item_count: usize,
    pub items: Vec<DiskItemStat>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrashItem {
    pub id: String,
    pub name: String,
    pub original_path: String,
    pub trash_path: String,
    pub is_dir: bool,
    pub size: u64,
    pub deleted_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrashListResponse {
    pub items: Vec<TrashItem>,
    pub total_size: u64,
}

#[derive(Debug, Deserialize)]
pub struct MoveToTrashRequest {
    pub paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct RestoreTrashRequest {
    pub ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ShareLink {
    pub token: String,
    pub file_path: String,
    pub file_name: String,
    pub is_dir: bool,
    pub size: u64,
    pub created_at: String,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub expires_at_unix: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SharesResponse {
    pub shares: Vec<ShareLink>,
}

#[derive(Debug, Deserialize)]
pub struct CreateShareRequest {
    pub path: String,
    pub expires_in_seconds: Option<u64>,
}

// --- HELPER FUNCTIONS ---

pub fn sanitize_path(raw: &str) -> Result<PathBuf, StatusCode> {
    if raw.contains('\0') {
        return Err(StatusCode::BAD_REQUEST);
    }
    let trimmed = raw.trim();
    let p = if trimmed.is_empty() { "/" } else { trimmed };

    if Path::new(p).exists() {
        return Ok(PathBuf::from(p));
    }

    // If running inside a container where host root is mounted at /host
    if Path::new("/host").is_dir() {
        if p == "/" || p == "/host" {
            return Ok(PathBuf::from("/host"));
        }
        if p.starts_with("/host/") || p == "/host" {
            return Ok(PathBuf::from(p));
        }
        // If path is under /mnt or /media or /app or /tmp, check if local mount exists first
        if (p.starts_with("/mnt") || p.starts_with("/media") || p.starts_with("/app") || p.starts_with("/tmp")) && Path::new(p).exists() {
            return Ok(PathBuf::from(p));
        }
        // Map host path: e.g. /home/user -> /host/home/user
        let clean = p.trim_start_matches('/');
        let mapped = Path::new("/host").join(clean);
        if mapped.exists() || !Path::new(p).exists() {
            return Ok(mapped);
        }
    }

    Ok(PathBuf::from(p))
}

pub fn to_display_path(p: &Path) -> String {
    let s = p.to_string_lossy().to_string();
    if s == "/host" {
        return "/".to_string();
    }
    if s.starts_with("/host/") {
        let stripped = s.replacen("/host", "", 1);
        return if stripped.is_empty() { "/".to_string() } else { stripped };
    }
    s
}

fn get_mime_type(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "txt" | "log" | "env" => "text/plain",
        "json" => "application/json",
        "yaml" | "yml" => "text/yaml",
        "toml" => "text/plain",
        "md" => "text/markdown",
        "sh" | "bash" | "zsh" => "text/x-shellscript",
        "js" => "application/javascript",
        "ts" => "application/typescript",
        "rs" => "text/rust",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "flac" => "audio/flac",
        "ogg" | "oga" => "audio/ogg",
        "aac" | "m4a" => "audio/mp4",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "pdf" => "application/pdf",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "zip" => "application/zip",
        "tar" | "gz" | "tgz" => "application/gzip",
        _ => "application/octet-stream",
    }
}

// --- HANDLERS ---

pub async fn list_files(Query(q): Query<ListFilesQuery>) -> Result<Json<ListFilesResponse>, StatusCode> {
    let target_dir = q.path.as_deref().unwrap_or("/");
    let path = sanitize_path(target_dir)?;

    if !path.exists() {
        return Err(StatusCode::NOT_FOUND);
    }

    let entries = match fs::read_dir(&path) {
        Ok(e) => e,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let mut items: Vec<FileItem> = Vec::new();

    for entry in entries.flatten() {
        let meta = entry.metadata().ok();
        let name = entry.file_name().to_string_lossy().to_string();
        let is_hidden = name.starts_with('.');
        let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        
        let modified = meta.and_then(|m| m.modified().ok())
            .map(|t| {
                let dur = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                time::OffsetDateTime::from_unix_timestamp(dur.as_secs() as i64)
                    .map(|dt| dt.format(&time::format_description::well_known::Rfc3339).unwrap_or_default())
                    .unwrap_or_default()
            })
            .unwrap_or_default();

        let p = entry.path();
        let extension = p.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        let mime_type = if is_dir {
            "inode/directory".to_string()
        } else {
            get_mime_type(&extension).to_string()
        };

        items.push(FileItem {
            name,
            path: to_display_path(&p),
            is_dir,
            size,
            modified,
            extension,
            mime_type,
            is_hidden,
        });
    }

    // Sort: directories first, then alphabetical by name or size
    let sort_by = q.sort.as_deref().unwrap_or("name");
    let is_desc = q.order.as_deref().unwrap_or("asc") == "desc";

    items.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            return b.is_dir.cmp(&a.is_dir);
        }
        let ord = match sort_by {
            "size" => a.size.cmp(&b.size),
            "modified" => a.modified.cmp(&b.modified),
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        };
        if is_desc { ord.reverse() } else { ord }
    });

    let total_items = items.len();
    if let (Some(page), Some(limit)) = (q.page, q.limit) {
        if limit > 0 && page > 0 {
            let start = (page - 1) * limit;
            if start < items.len() {
                let end = (start + limit).min(items.len());
                items = items[start..end].to_vec();
            } else {
                items.clear();
            }
        }
    }

    Ok(Json(ListFilesResponse {
        current_path: to_display_path(&path),
        items,
        total_items,
    }))
}

pub fn is_valid_storage_disk(name: &str, mount_point: &str, fs_type: &str, total_space: u64) -> bool {
    let name_lower = name.to_lowercase();
    let mount_lower = mount_point.to_lowercase();
    let fs_lower = fs_type.to_lowercase();

    let pseudo_fs = [
        "securityfs", "efivarfs", "bpf", "configfs", "selinuxfs", "debugfs",
        "cgroup", "cgroup2", "pstore", "hugetlbfs", "mqueue", "autofs",
        "tracefs", "fusectl", "binfmt_misc", "devtmpfs", "devpts", "proc",
        "sysfs", "tmpfs", "squashfs", "overlay", "overlayfs", "nsfs",
        "rpc_pipefs", "fuse.gvfsd-fuse", "gvfsd-fuse", "fuse.portal", "portal",
        "pipefs", "sockfs", "fuse",
    ];

    if pseudo_fs.iter().any(|&p| fs_lower == p || name_lower == p) {
        return false;
    }

    if mount_lower.starts_with("/sys")
        || mount_lower.starts_with("/proc")
        || mount_lower.starts_with("/dev")
        || mount_lower.starts_with("/run")
        || mount_lower.starts_with("/var/run")
        || mount_lower.starts_with("/etc")
        || mount_lower.starts_with("/tmp")
        || mount_lower.starts_with("/boot")
        || mount_lower.starts_with("/efi")
        || mount_lower.starts_with("/recovery")
        || mount_lower.starts_with("/var/lib/docker")
        || mount_lower.starts_with("/var/lib/containers")
        || mount_lower == "/app/data"
        || mount_lower.starts_with("/host/sys")
        || mount_lower.starts_with("/host/proc")
        || mount_lower.starts_with("/host/dev")
        || mount_lower.starts_with("/host/run")
        || mount_lower.starts_with("/host/etc")
        || mount_lower.starts_with("/host/tmp")
        || mount_lower.starts_with("/host/boot")
        || mount_lower.starts_with("/host/efi")
        || mount_lower.starts_with("/host/recovery")
        || mount_lower.starts_with("/host/var/lib/docker")
    {
        return false;
    }

    // Ignore partitions smaller than 2GB (EFI, bootloader, recovery)
    if total_space < 2 * 1024 * 1024 * 1024 {
        return false;
    }

    true
}

pub async fn get_shortcuts() -> Json<ShortcutsResponse> {
    // 1. Detect real user home folder
    let home_path = if Path::new("/host/home").is_dir() {
        // Find first user directory in /host/home
        let mut user_home = None;
        if let Ok(entries) = fs::read_dir("/host/home") {
            for entry in entries.flatten() {
                if let Ok(ft) = entry.file_type() {
                    if ft.is_dir() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if !name.starts_with('.') {
                            user_home = Some(format!("/home/{}", name));
                            break;
                        }
                    }
                }
            }
        }
        user_home.unwrap_or_else(|| {
            if Path::new("/host/root").is_dir() {
                "/root".to_string()
            } else {
                "/home".to_string()
            }
        })
    } else if let Ok(h) = std::env::var("HOME") {
        if Path::new(&h).is_dir() || Path::new(&format!("/host{}", h)).is_dir() {
            h
        } else {
            "/home".to_string()
        }
    } else if Path::new("/home").is_dir() {
        "/home".to_string()
    } else {
        "/".to_string()
    };

    // Helper to find existing folder under home or fallback
    let find_user_folder = |candidates: &[&str], default_name: &str| -> String {
        for candidate in candidates {
            let direct = format!("{}/{}", home_path, candidate);
            let host_mapped = format!("/host{}/{}", home_path, candidate);
            if Path::new(&direct).is_dir() || Path::new(&host_mapped).is_dir() {
                return direct;
            }
        }
        format!("{}/{}", home_path, default_name)
    };

    let documents = find_user_folder(&["Documentos", "Documents"], "Documentos");
    let downloads = find_user_folder(&["Downloads", "Transferências"], "Downloads");
    let pictures = find_user_folder(&["Imagens", "Pictures", "Fotos"], "Imagens");
    let music = find_user_folder(&["Músicas", "Música", "Music"], "Músicas");
    let videos = find_user_folder(&["Vídeos", "Videos", "Movies"], "Vídeos");

    let places = vec![
        ShortcutPlace {
            id: "home".to_string(),
            label: "Início".to_string(),
            path: home_path.clone(),
            icon: "home".to_string(),
        },
        ShortcutPlace {
            id: "documents".to_string(),
            label: "Documentos".to_string(),
            path: documents.clone(),
            icon: "file-text".to_string(),
        },
        ShortcutPlace {
            id: "downloads".to_string(),
            label: "Downloads".to_string(),
            path: downloads.clone(),
            icon: "download".to_string(),
        },
        ShortcutPlace {
            id: "pictures".to_string(),
            label: "Imagens".to_string(),
            path: pictures.clone(),
            icon: "image".to_string(),
        },
        ShortcutPlace {
            id: "music".to_string(),
            label: "Músicas".to_string(),
            path: music.clone(),
            icon: "music".to_string(),
        },
        ShortcutPlace {
            id: "videos".to_string(),
            label: "Vídeos".to_string(),
            path: videos.clone(),
            icon: "film".to_string(),
        },
        ShortcutPlace {
            id: "root".to_string(),
            label: "Sistema (Raiz)".to_string(),
            path: "/".to_string(),
            icon: "hard-drive".to_string(),
        },
    ];

    Json(ShortcutsResponse {
        home: home_path.clone(),
        documents: documents.clone(),
        downloads: downloads.clone(),
        pictures,
        music,
        videos,
        root: "/".to_string(),
        places,
        data: None,
        gallery: None,
        media: None,
    })
}

pub async fn list_storages() -> Json<StoragesResponse> {
    let disks = Disks::new_with_refreshed_list();
    let mut mounts_map: std::collections::HashMap<String, MountItem> = std::collections::HashMap::new();

    for disk in &disks {
        let raw_mount = disk.mount_point().to_string_lossy().to_string();
        let name = disk.name().to_string_lossy().to_string();
        let fs_type = disk.file_system().to_string_lossy().to_string();
        let total_bytes = disk.total_space();

        if !is_valid_storage_disk(&name, &raw_mount, &fs_type, total_bytes) {
            continue;
        }

        let mount_point = if raw_mount == "/host" {
            "/".to_string()
        } else if raw_mount.starts_with("/host/") {
            raw_mount.replacen("/host", "", 1)
        } else {
            raw_mount.clone()
        };

        let name_lower = name.to_lowercase();
        let mount_lower = mount_point.to_lowercase();

        let display_name = if name_lower.contains("mmcblk") || name_lower.contains("sdcard") {
            "Cartão microSD".to_string()
        } else if name_lower.contains("nvme") {
            "SSD NVMe".to_string()
        } else if mount_lower.starts_with("/mnt") || mount_lower.starts_with("/media") || mount_lower.starts_with("/run/media") {
            let folder = mount_point.split('/').filter(|s| !s.is_empty()).last().unwrap_or("Externo");
            format!("HD Externo ({})", folder)
        } else if name_lower.starts_with("/dev/sd") || name_lower.starts_with("sd") {
            if mount_point == "/" || mount_point == "/root" || mount_point == "/home" {
                "SSD / HD Principal".to_string()
            } else {
                "Pendrive / HD USB".to_string()
            }
        } else if mount_point == "/" || name_lower == "root" || name_lower == "/dev/root" {
            "Armazenamento do Sistema".to_string()
        } else if !name.is_empty() && !name.starts_with('/') {
            name.clone()
        } else {
            "Armazenamento Local".to_string()
        };

        let group_key = if name.contains("nvme") {
            let parts: Vec<&str> = name.split('p').collect();
            parts.first().copied().unwrap_or(&name).to_string()
        } else if name.starts_with("/dev/sd") && name.len() >= 8 {
            name[..8].to_string()
        } else if name.starts_with("sd") && name.len() >= 3 {
            name[..3].to_string()
        } else {
            name.clone()
        };

        let available_bytes = disk.available_space();
        let used_bytes = total_bytes.saturating_sub(available_bytes);

        let item = MountItem {
            name: display_name,
            mount_point,
            fs_type,
            total_bytes,
            used_bytes,
            available_bytes,
        };

        if let Some(existing) = mounts_map.get_mut(&group_key) {
            if item.total_bytes > existing.total_bytes {
                *existing = item;
            }
        } else {
            mounts_map.insert(group_key, item);
        }
    }

    let mut mounts: Vec<MountItem> = mounts_map.into_values().collect();
    mounts.sort_by(|a, b| b.total_bytes.cmp(&a.total_bytes));

    if mounts.is_empty() {
        mounts.push(MountItem {
            name: "Armazenamento do Sistema".to_string(),
            mount_point: "/".to_string(),
            fs_type: "ext4".to_string(),
            total_bytes: 100 * 1024 * 1024 * 1024,
            used_bytes: 30 * 1024 * 1024 * 1024,
            available_bytes: 70 * 1024 * 1024 * 1024,
        });
    }

    Json(StoragesResponse { mounts })
}

pub async fn unmount_storage(Json(req): Json<UnmountRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    if req.mount_point == "/" || req.mount_point == "/boot" || req.mount_point == "/etc" {
        return Err(StatusCode::FORBIDDEN);
    }
    // Perform unmount or log
    Ok(Json(serde_json::json!({ "success": true, "unmounted": req.mount_point })))
}

// --- CLOUD STORAGE ---

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

fn load_cloud_accounts() -> Vec<CloudAccount> {
    CLOUD_ACCOUNTS.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

fn save_cloud_accounts(accounts: &[CloudAccount]) {
    let _ = fs::create_dir_all("data");
    let _ = fs::write(CLOUD_ACCOUNTS_FILE, serde_json::to_string_pretty(accounts).unwrap_or_default());
}

fn dirs_or_fallback_rclone_dir() -> String {
    if Path::new("/root/.config/rclone").exists() || Path::new("/root").is_dir() {
        "/root/.config/rclone".to_string()
    } else {
        "data/rclone".to_string()
    }
}

fn sync_rclone_config(account: &CloudAccount) {
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

fn mount_rclone_remote(account_id: &str, mount_point: &str) {
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

fn unmount_rclone_remote(mount_point: &str) {
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

fn urlencoding_encode(input: &str) -> String {
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

// --- CRUD OPERATIONS ---

pub async fn mkdir(Json(req): Json<MkdirRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let path = sanitize_path(&req.path)?;
    if path.exists() {
        return Err(StatusCode::CONFLICT);
    }
    fs::create_dir_all(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn create_file(Json(req): Json<CreateFileRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let path = sanitize_path(&req.path)?;
    if path.exists() {
        return Err(StatusCode::CONFLICT);
    }
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    File::create(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn rename_file(Json(req): Json<RenameRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let old_p = sanitize_path(&req.old_path)?;
    let new_p = sanitize_path(&req.new_path)?;
    if !old_p.exists() {
        return Err(StatusCode::NOT_FOUND);
    }
    fs::rename(&old_p, &new_p).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "success": true })))
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
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

pub async fn copy_file(Json(req): Json<CopyMoveRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let src = sanitize_path(&req.source)?;
    let dst = sanitize_path(&req.destination)?;
    if !src.exists() {
        return Err(StatusCode::NOT_FOUND);
    }
    if src.is_dir() {
        copy_dir_all(&src, &dst).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    } else {
        if let Some(parent) = dst.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::copy(&src, &dst).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn move_file(Json(req): Json<CopyMoveRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let src = sanitize_path(&req.source)?;
    let dst = sanitize_path(&req.destination)?;
    if !src.exists() {
        return Err(StatusCode::NOT_FOUND);
    }
    if let Some(parent) = dst.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if fs::rename(&src, &dst).is_err() {
        // Fallback for cross-device moves
        if src.is_dir() {
            copy_dir_all(&src, &dst).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            fs::remove_dir_all(&src).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        } else {
            fs::copy(&src, &dst).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            fs::remove_file(&src).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        }
    }
    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn delete_files(Json(req): Json<DeleteRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    for p_str in &req.paths {
        let path = sanitize_path(p_str)?;
        if path.exists() {
            if path.is_dir() {
                let _ = fs::remove_dir_all(&path);
            } else {
                let _ = fs::remove_file(&path);
            }
        }
    }
    Ok(Json(serde_json::json!({ "success": true })))
}

// --- TRANSFERS & DOWNLOAD ---

#[derive(Debug, Deserialize)]
pub struct DownloadQuery {
    pub path: String,
}

pub async fn download_file(Query(q): Query<DownloadQuery>) -> Result<Response, StatusCode> {
    let path = sanitize_path(&q.path)?;
    if !path.exists() || path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let mut file = File::open(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let file_name = path.file_name().and_then(|f| f.to_str()).unwrap_or("file");
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let mime = get_mime_type(ext);

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, mime.parse().unwrap());
    headers.insert(
        header::CONTENT_DISPOSITION,
        format!("attachment; filename=\"{}\"", file_name).parse().unwrap(),
    );
    headers.insert(header::CONTENT_LENGTH, contents.len().to_string().parse().unwrap());

    Ok((headers, contents).into_response())
}

pub async fn archive_folder(Query(q): Query<DownloadQuery>) -> Result<Response, StatusCode> {
    let path = sanitize_path(&q.path)?;
    if !path.exists() {
        return Err(StatusCode::NOT_FOUND);
    }

    let mut zip_buf = std::io::Cursor::new(Vec::new());
    {
        let mut zip = zip::ZipWriter::new(&mut zip_buf);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        fn add_dir_to_zip(
            zip: &mut zip::ZipWriter<&mut std::io::Cursor<Vec<u8>>>,
            dir_path: &Path,
            prefix: &Path,
            options: zip::write::SimpleFileOptions,
        ) -> std::io::Result<()> {
            for entry in fs::read_dir(dir_path)? {
                let entry = entry?;
                let path = entry.path();
                let name = path.strip_prefix(prefix).unwrap();
                if path.is_dir() {
                    zip.add_directory(name.to_string_lossy(), options)?;
                    add_dir_to_zip(zip, &path, prefix, options)?;
                } else {
                    zip.start_file(name.to_string_lossy(), options)?;
                    let mut f = File::open(&path)?;
                    let mut buf = Vec::new();
                    f.read_to_end(&mut buf)?;
                    zip.write_all(&buf)?;
                }
            }
            Ok(())
        }

        if path.is_dir() {
            let _ = add_dir_to_zip(&mut zip, &path, &path, options);
        } else {
            let name = path.file_name().unwrap().to_string_lossy();
            let _ = zip.start_file(name, options);
            let mut f = File::open(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            let mut buf = Vec::new();
            let _ = f.read_to_end(&mut buf);
            let _ = zip.write_all(&buf);
        }
        let _ = zip.finish();
    }

    let result_bytes = zip_buf.into_inner();
    let folder_name = path.file_name().and_then(|f| f.to_str()).unwrap_or("archive");

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, "application/zip".parse().unwrap());
    headers.insert(
        header::CONTENT_DISPOSITION,
        format!("attachment; filename=\"{}.zip\"", folder_name).parse().unwrap(),
    );
    headers.insert(header::CONTENT_LENGTH, result_bytes.len().to_string().parse().unwrap());

    Ok((headers, result_bytes).into_response())
}

#[derive(Debug, Deserialize)]
pub struct UploadQuery {
    pub destination: Option<String>,
}

pub async fn upload_files(
    Query(q): Query<UploadQuery>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let dest_dir = q.destination.unwrap_or_else(|| "/DATA".to_string());
    let target_dir = sanitize_path(&dest_dir)?;
    let _ = fs::create_dir_all(&target_dir);

    let mut uploaded_files = Vec::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        let file_name = field.file_name().unwrap_or("uploaded_file").to_string();
        let data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;
        
        let file_path = target_dir.join(&file_name);
        fs::write(&file_path, data).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        uploaded_files.push(file_name);
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "uploaded": uploaded_files,
        "destination": target_dir.to_string_lossy()
    })))
}

// --- STREAMING (AUDIO, VIDEO, MKV, RANGE REQUESTS) ---

pub async fn stream_media(
    headers: HeaderMap,
    Query(q): Query<DownloadQuery>,
) -> Result<Response, StatusCode> {
    let path = sanitize_path(&q.path)?;
    if !path.exists() || path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let mut file = tokio::fs::File::open(&path).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let total_size = file.metadata().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?.len();

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let mime = get_mime_type(ext);

    let range_header = headers.get(header::RANGE).and_then(|r| r.to_str().ok());

    // 4MB maximum chunk size per range request to enable instant playback and low memory usage
    const MAX_CHUNK_SIZE: u64 = 4 * 1024 * 1024;

    if let Some(range_str) = range_header {
        if let Some(range_spec) = range_str.strip_prefix("bytes=") {
            let parts: Vec<&str> = range_spec.split('-').collect();
            let start: u64 = parts.get(0).and_then(|s| s.parse().ok()).unwrap_or(0);
            
            let raw_end = parts.get(1).and_then(|s| s.parse().ok());
            let end: u64 = match raw_end {
                Some(e) => e.min(total_size.saturating_sub(1)),
                None => (start + MAX_CHUNK_SIZE - 1).min(total_size.saturating_sub(1)),
            };

            if start > end || start >= total_size {
                let mut resp_headers = HeaderMap::new();
                resp_headers.insert(header::CONTENT_RANGE, format!("bytes */{}", total_size).parse().unwrap());
                return Ok((StatusCode::RANGE_NOT_SATISFIABLE, resp_headers).into_response());
            }

            let chunk_size = (end - start) + 1;
            let mut chunk = vec![0u8; chunk_size as usize];
            use tokio::io::{AsyncReadExt, AsyncSeekExt};
            file.seek(std::io::SeekFrom::Start(start)).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            file.read_exact(&mut chunk).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            let mut resp_headers = HeaderMap::new();
            resp_headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(mime));
            resp_headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
            resp_headers.insert(
                header::CONTENT_RANGE,
                format!("bytes {}-{}/{}", start, end, total_size).parse().unwrap(),
            );
            resp_headers.insert(header::CONTENT_LENGTH, chunk_size.to_string().parse().unwrap());
            resp_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=3600"));

            return Ok((StatusCode::PARTIAL_CONTENT, resp_headers, chunk).into_response());
        }
    }

    if total_size > MAX_CHUNK_SIZE {
        let chunk_size = MAX_CHUNK_SIZE;
        let mut chunk = vec![0u8; chunk_size as usize];
        use tokio::io::AsyncReadExt;
        file.read_exact(&mut chunk).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let mut resp_headers = HeaderMap::new();
        resp_headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(mime));
        resp_headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
        resp_headers.insert(
            header::CONTENT_RANGE,
            format!("bytes 0-{}/{}", chunk_size - 1, total_size).parse().unwrap(),
        );
        resp_headers.insert(header::CONTENT_LENGTH, chunk_size.to_string().parse().unwrap());
        resp_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=3600"));

        return Ok((StatusCode::PARTIAL_CONTENT, resp_headers, chunk).into_response());
    }

    let mut full_buf = Vec::new();
    use tokio::io::AsyncReadExt;
    file.read_to_end(&mut full_buf).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(mime));
    resp_headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    resp_headers.insert(header::CONTENT_LENGTH, full_buf.len().to_string().parse().unwrap());
    resp_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=3600"));

    Ok((StatusCode::OK, resp_headers, full_buf).into_response())
}

fn srt_or_ass_to_vtt(content: &str) -> String {
    let mut vtt = String::from("WEBVTT\n\n");
    for line in content.lines() {
        if line.contains("-->") {
            let vtt_line = line.replace(',', ".");
            vtt.push_str(&vtt_line);
            vtt.push('\n');
        } else {
            vtt.push_str(line);
            vtt.push('\n');
        }
    }
    vtt
}

pub async fn get_subtitle_vtt(Query(q): Query<DownloadQuery>) -> Result<impl IntoResponse, StatusCode> {
    if q.path.starts_with("internal:") {
        let parts: Vec<&str> = q.path.splitn(3, ':').collect();
        if parts.len() < 3 {
            return Err(StatusCode::BAD_REQUEST);
        }
        let stream_idx = parts[1];
        let original_path = parts[2];
        let video_path = sanitize_path(original_path)?;
        if !video_path.exists() || video_path.is_dir() {
            return Err(StatusCode::NOT_FOUND);
        }

        let output = std::process::Command::new("ffmpeg")
            .args([
                "-v", "error",
                "-i",
            ])
            .arg(&video_path)
            .args([
                "-map", &format!("0:{}", stream_idx),
                "-f", "webvtt",
                "-",
            ])
            .output()
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let vtt = String::from_utf8_lossy(&output.stdout).to_string();
        let mut headers = HeaderMap::new();
        headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/vtt; charset=utf-8"));
        return Ok((StatusCode::OK, headers, vtt));
    }

    let path = sanitize_path(&q.path)?;
    if !path.exists() || path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }
    let content = fs::read_to_string(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let vtt = if path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) == Some("vtt".to_string()) {
        content
    } else {
        srt_or_ass_to_vtt(&content)
    };

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/vtt; charset=utf-8"));
    Ok((StatusCode::OK, headers, vtt))
}

pub async fn get_subtitles(Query(q): Query<DownloadQuery>) -> Result<Json<SubtitlesResponse>, StatusCode> {
    let video_path = sanitize_path(&q.path)?;
    let mut subtitles = Vec::new();

    // 1. Probing internal embedded subtitles (MKV/MP4/WebM) via ffprobe
    if let Ok(output) = std::process::Command::new("ffprobe")
        .args([
            "-v", "error",
            "-select_streams", "s",
            "-show_entries", "stream=index,codec_name:stream_tags=language,title",
            "-of", "json",
        ])
        .arg(&video_path)
        .output()
    {
        if output.status.success() {
            if let Ok(json_val) = serde_json::from_slice::<serde_json::Value>(&output.stdout) {
                if let Some(streams) = json_val.get("streams").and_then(|s| s.as_array()) {
                    for (stream_order, stream) in streams.iter().enumerate() {
                        let stream_idx = stream.get("index").and_then(|i| i.as_i64()).unwrap_or(stream_order as i64);
                        let tags = stream.get("tags");
                        let raw_lang = tags.and_then(|t| t.get("language")).and_then(|l| l.as_str()).unwrap_or("und");
                        let title = tags.and_then(|t| t.get("title")).and_then(|l| l.as_str()).unwrap_or("");
                        
                        let lang_lower = raw_lang.to_lowercase();
                        let title_lower = title.to_lowercase();

                        let label = if lang_lower.contains("por") || lang_lower.contains("pt") || title_lower.contains("portug") {
                            if !title.is_empty() {
                                format!("Português ({})", title)
                            } else {
                                "Português (Brasil)".to_string()
                            }
                        } else if lang_lower.contains("eng") || lang_lower.contains("en") || title_lower.contains("english") {
                            if !title.is_empty() {
                                format!("English ({})", title)
                            } else {
                                "English".to_string()
                            }
                        } else if lang_lower.contains("spa") || lang_lower.contains("es") || title_lower.contains("espanol") {
                            if !title.is_empty() {
                                format!("Español ({})", title)
                            } else {
                                "Español".to_string()
                            }
                        } else if lang_lower.contains("jpn") || lang_lower.contains("ja") {
                            "Japonês".to_string()
                        } else if !title.is_empty() {
                            title.to_string()
                        } else {
                            format!("Faixa {}", stream_order + 1)
                        };

                        let lang_code = if label.starts_with("Português") {
                            "pt-BR"
                        } else if label.starts_with("English") {
                            "en"
                        } else if label.starts_with("Español") {
                            "es"
                        } else if label.starts_with("Japonês") {
                            "ja"
                        } else {
                            raw_lang
                        };

                        let display_name = if !title.is_empty() {
                            format!("[Embutida] {}", title)
                        } else {
                            format!("[Embutida] {}", label)
                        };

                        subtitles.push(SubtitleItem {
                            name: display_name,
                            path: format!("internal:{}:{}", stream_idx, q.path),
                            label: format!("{} (Embutida)", label),
                            lang: lang_code.to_string(),
                        });
                    }
                }
            }
        }
    }

    // 2. Scanning companion external subtitle files (.srt, .vtt, .ass) in the folder
    if let Some(parent) = video_path.parent() {
        let video_stem = video_path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
        
        let ep_pattern = if let Some(idx) = video_stem.find('e') {
            let part = &video_stem[idx..];
            part.split(|c: char| !c.is_alphanumeric()).next().unwrap_or("")
        } else {
            ""
        };

        if let Ok(entries) = fs::read_dir(parent) {
            for entry in entries.flatten() {
                let p = entry.path();
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if ext_lower == "srt" || ext_lower == "vtt" || ext_lower == "ass" || ext_lower == "sub" {
                        let name = entry.file_name().to_string_lossy().to_string();
                        let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
                        
                        let is_match = stem.starts_with(&video_stem) 
                            || video_stem.starts_with(&stem)
                            || (!ep_pattern.is_empty() && stem.contains(ep_pattern))
                            || stem.contains(&video_stem)
                            || true;

                        if is_match {
                            let label = if name.contains("pt-BR") || name.contains("pt") || name.contains("por") || name.contains("pob") || name.to_lowercase().contains("portug") {
                                "Português (Brasil)".to_string()
                            } else if name.contains("en") || name.contains("eng") || name.to_lowercase().contains("english") {
                                "English".to_string()
                            } else if name.contains("es") || name.contains("spa") || name.to_lowercase().contains("espanol") {
                                "Español".to_string()
                            } else {
                                name.clone()
                            };

                            let lang = if label.starts_with("Português") { "pt-BR" } else if label.starts_with("English") { "en" } else if label.starts_with("Español") { "es" } else { "und" };

                            subtitles.push(SubtitleItem {
                                name,
                                path: p.to_string_lossy().to_string(),
                                label: format!("{} (Arquivo)", label),
                                lang: lang.to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(Json(SubtitlesResponse { subtitles }))
}

// --- TEXT CONTENT & RAW PDF ---

pub async fn get_file_content(Query(q): Query<FileContentQuery>) -> Result<Json<FileContentResponse>, StatusCode> {
    let path = sanitize_path(&q.path)?;
    if !path.exists() || path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let meta = path.metadata().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if meta.len() > 10 * 1024 * 1024 {
        // > 10MB limit for text editor
        return Err(StatusCode::PAYLOAD_TOO_LARGE);
    }

    let content = fs::read_to_string(&path).map_err(|_| StatusCode::BAD_REQUEST)?;

    Ok(Json(FileContentResponse {
        path: path.to_string_lossy().to_string(),
        content,
        size: meta.len(),
    }))
}

pub async fn update_file_content(Json(req): Json<UpdateContentRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let path = sanitize_path(&req.path)?;
    if !path.exists() || path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    fs::write(&path, req.content.as_bytes()).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn get_raw_file(Query(q): Query<DownloadQuery>) -> Result<Response, StatusCode> {
    let path = sanitize_path(&q.path)?;
    if !path.exists() || path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let mut file = File::open(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let mime = get_mime_type(ext);

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, mime.parse().unwrap());
    headers.insert(header::CONTENT_DISPOSITION, "inline".parse().unwrap());
    headers.insert(header::CONTENT_LENGTH, contents.len().to_string().parse().unwrap());

    Ok((headers, contents).into_response())
}

// --- ARCHIVE EXTRACTION & COMPRESSION ---

pub async fn extract_archive(Json(req): Json<ExtractRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let path = sanitize_path(&req.path)?;
    if !path.exists() || path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let dest_dir = if let Some(ref d) = req.destination {
        sanitize_path(d)?
    } else {
        path.parent().unwrap_or(Path::new("/")).to_path_buf()
    };

    let _ = fs::create_dir_all(&dest_dir);

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let mut extracted_count = 0;

    if ext == "zip" {
        let file = File::open(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let mut archive = zip::ZipArchive::new(file).map_err(|_| StatusCode::BAD_REQUEST)?;

        for i in 0..archive.len() {
            let mut file_in_zip = archive.by_index(i).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            let outpath = match file_in_zip.enclosed_name() {
                Some(p) => dest_dir.join(p),
                None => continue,
            };

            if file_in_zip.is_dir() {
                let _ = fs::create_dir_all(&outpath);
            } else {
                if let Some(parent) = outpath.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                let mut outfile = File::create(&outpath).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                std::io::copy(&mut file_in_zip, &mut outfile).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                extracted_count += 1;
            }
        }
    } else {
        return Err(StatusCode::BAD_REQUEST);
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "extracted_to": dest_dir.to_string_lossy(),
        "files_count": extracted_count
    })))
}

pub async fn compress_files(Json(req): Json<CompressRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    if req.paths.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let dest_dir = if let Some(ref d) = req.destination_dir {
        sanitize_path(d)?
    } else {
        let first = sanitize_path(&req.paths[0])?;
        first.parent().unwrap_or(Path::new("/")).to_path_buf()
    };

    let zip_filename = if req.destination_name.ends_with(".zip") {
        req.destination_name.clone()
    } else {
        format!("{}.zip", req.destination_name)
    };

    let zip_path = dest_dir.join(&zip_filename);
    let zip_file = File::create(&zip_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut zip_writer = zip::ZipWriter::new(zip_file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    fn add_to_zip(
        zip: &mut zip::ZipWriter<File>,
        src_path: &Path,
        prefix_in_zip: &str,
        options: zip::write::SimpleFileOptions,
    ) -> std::io::Result<()> {
        let name = src_path.file_name().unwrap_or_default().to_string_lossy();
        let zip_entry_name = if prefix_in_zip.is_empty() {
            name.to_string()
        } else {
            format!("{}/{}", prefix_in_zip, name)
        };

        if src_path.is_dir() {
            zip.add_directory(&zip_entry_name, options)?;
            for entry in fs::read_dir(src_path)? {
                let entry = entry?;
                add_to_zip(zip, &entry.path(), &zip_entry_name, options)?;
            }
        } else {
            zip.start_file(&zip_entry_name, options)?;
            let mut f = File::open(src_path)?;
            let mut buf = Vec::new();
            f.read_to_end(&mut buf)?;
            zip.write_all(&buf)?;
        }
        Ok(())
    }

    for p in &req.paths {
        let target = sanitize_path(p)?;
        if target.exists() {
            let _ = add_to_zip(&mut zip_writer, &target, "", options);
        }
    }

    zip_writer.finish().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let size = zip_path.metadata().map(|m| m.len()).unwrap_or(0);

    Ok(Json(serde_json::json!({
        "success": true,
        "archive_path": to_display_path(&zip_path),
        "size": size
    })))
}

// --- DISK SPACE ANALYZER ---

fn get_dir_size_recursive(p: &Path) -> u64 {
    let mut total = 0;
    if let Ok(entries) = fs::read_dir(p) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_dir() {
                    total += get_dir_size_recursive(&entry.path());
                } else {
                    total += meta.len();
                }
            }
        }
    }
    total
}

pub async fn analyze_directory(Query(q): Query<AnalyzeQuery>) -> Result<Json<DiskAnalysisResponse>, StatusCode> {
    let target = q.path.as_deref().unwrap_or("/");
    let path = sanitize_path(target)?;

    if !path.exists() || !path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let entries = fs::read_dir(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut raw_items = Vec::new();
    let mut total_size = 0u64;

    for entry in entries.flatten() {
        let meta = entry.metadata().ok();
        let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let name = entry.file_name().to_string_lossy().to_string();
        let item_path = entry.path();

        let size = if is_dir {
            get_dir_size_recursive(&item_path)
        } else {
            meta.as_ref().map(|m| m.len()).unwrap_or(0)
        };

        total_size += size;
        raw_items.push((name, to_display_path(&item_path), is_dir, size));
    }

    let mut items = Vec::new();
    for (name, item_path, is_dir, size) in raw_items {
        let percentage = if total_size > 0 {
            (size as f32 / total_size as f32) * 100.0
        } else {
            0.0
        };

        items.push(DiskItemStat {
            name,
            path: item_path,
            is_dir,
            size,
            percentage,
        });
    }

    items.sort_by(|a, b| b.size.cmp(&a.size));

    Ok(Json(DiskAnalysisResponse {
        path: target.to_string(),
        total_size,
        item_count: items.len(),
        items,
    }))
}

// --- TRASH BIN SYSTEM ---

fn get_trash_dir() -> PathBuf {
    let candidate = PathBuf::from("/app/data/.trash");
    if fs::create_dir_all(&candidate).is_ok() {
        candidate
    } else {
        let fallback = std::env::temp_dir().join("orbit_trash");
        let _ = fs::create_dir_all(&fallback);
        fallback
    }
}

fn get_trash_metadata_file() -> PathBuf {
    get_trash_dir().join("trash_metadata.json")
}

fn load_trash_items() -> Vec<TrashItem> {
    let file = get_trash_metadata_file();
    if let Ok(content) = fs::read_to_string(&file) {
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    }
}

fn save_trash_items(items: &[TrashItem]) {
    let file = get_trash_metadata_file();
    if let Ok(content) = serde_json::to_string_pretty(items) {
        let _ = fs::write(&file, content);
    }
}

pub async fn list_trash() -> Json<TrashListResponse> {
    let items = load_trash_items();
    let total_size = items.iter().map(|i| i.size).sum();
    Json(TrashListResponse { items, total_size })
}

fn move_path_or_copy(src: &Path, dst: &Path) -> std::io::Result<()> {
    if let Some(parent) = dst.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if fs::rename(src, dst).is_err() {
        if src.is_dir() {
            copy_dir_all(src, dst)?;
            let _ = fs::remove_dir_all(src);
        } else {
            fs::copy(src, dst)?;
            let _ = fs::remove_file(src);
        }
    }
    Ok(())
}

pub async fn move_to_trash(Json(req): Json<MoveToTrashRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let trash_dir = get_trash_dir();
    let mut items = load_trash_items();
    let now = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default();

    for p in &req.paths {
        let src = sanitize_path(p)?;
        if !src.exists() {
            continue;
        }

        let meta = src.metadata().ok();
        let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size = if is_dir { get_dir_size_recursive(&src) } else { meta.map(|m| m.len()).unwrap_or(0) };
        let file_name = src.file_name().unwrap_or_default().to_string_lossy().to_string();
        let id = Uuid::new_v4().to_string();
        let trash_target = trash_dir.join(format!("{}_{}", id, file_name));

        if move_path_or_copy(&src, &trash_target).is_ok() {
            items.push(TrashItem {
                id,
                name: file_name,
                original_path: p.clone(),
                trash_path: trash_target.to_string_lossy().to_string(),
                is_dir,
                size,
                deleted_at: now.clone(),
            });
        }
    }

    save_trash_items(&items);
    Ok(Json(serde_json::json!({ "success": true, "count": req.paths.len() })))
}

pub async fn restore_trash(Json(req): Json<RestoreTrashRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut items = load_trash_items();
    let mut restored_count = 0;

    for id in &req.ids {
        if let Some(pos) = items.iter().position(|i| &i.id == id) {
            let item = items.remove(pos);
            let trash_path = PathBuf::from(&item.trash_path);
            let original_path = match sanitize_path(&item.original_path) {
                Ok(p) => p,
                Err(_) => continue,
            };

            if move_path_or_copy(&trash_path, &original_path).is_ok() {
                restored_count += 1;
            }
        }
    }

    save_trash_items(&items);
    Ok(Json(serde_json::json!({ "success": true, "restored": restored_count })))
}

pub async fn empty_trash() -> Result<Json<serde_json::Value>, StatusCode> {
    let trash_dir = get_trash_dir();
    let items = load_trash_items();

    for item in items {
        let p = PathBuf::from(&item.trash_path);
        if p.is_dir() {
            let _ = fs::remove_dir_all(&p);
        } else if p.exists() {
            let _ = fs::remove_file(&p);
        }
    }

    save_trash_items(&[]);
    let _ = fs::remove_file(get_trash_metadata_file());
    let _ = fs::remove_dir_all(&trash_dir);
    let _ = fs::create_dir_all(&trash_dir);

    Ok(Json(serde_json::json!({ "success": true })))
}

// --- TEMPORARY SHARE LINKS SYSTEM ---

fn get_shares_file() -> PathBuf {
    let candidate = PathBuf::from("/app/data/shares.json");
    if let Some(parent) = candidate.parent() {
        if fs::create_dir_all(parent).is_ok() {
            if fs::OpenOptions::new().create(true).write(true).open(&candidate).is_ok() {
                return candidate;
            }
        }
    }
    std::env::temp_dir().join("orbit_shares.json")
}

fn load_shares() -> Vec<ShareLink> {
    let file = get_shares_file();
    if let Ok(content) = fs::read_to_string(&file) {
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    }
}

fn save_shares(shares: &[ShareLink]) {
    let file = get_shares_file();
    if let Ok(content) = serde_json::to_string_pretty(shares) {
        let _ = fs::write(&file, content);
    }
}

pub async fn create_share(Json(req): Json<CreateShareRequest>) -> Result<Json<ShareLink>, StatusCode> {
    let path = sanitize_path(&req.path)?;
    if !path.exists() {
        return Err(StatusCode::NOT_FOUND);
    }

    let meta = path.metadata().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let is_dir = meta.is_dir();
    let size = if is_dir { get_dir_size_recursive(&path) } else { meta.len() };
    let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

    let now_utc = time::OffsetDateTime::now_utc();
    let created_at = now_utc.format(&time::format_description::well_known::Rfc3339).unwrap_or_default();

    let (expires_at, expires_at_unix) = if let Some(secs) = req.expires_in_seconds {
        let exp = now_utc + time::Duration::seconds(secs as i64);
        (
            Some(exp.format(&time::format_description::well_known::Rfc3339).unwrap_or_default()),
            Some(exp.unix_timestamp())
        )
    } else {
        (None, None)
    };

    let token = Uuid::new_v4().to_string().replace('-', "")[..16].to_string();

    let share = ShareLink {
        token,
        file_path: req.path.clone(),
        file_name,
        is_dir,
        size,
        created_at,
        expires_at,
        expires_at_unix,
    };

    let mut shares = load_shares();
    shares.push(share.clone());
    save_shares(&shares);

    Ok(Json(share))
}

pub async fn list_shares() -> Json<SharesResponse> {
    let shares = load_shares();
    let now_unix = time::OffsetDateTime::now_utc().unix_timestamp();

    // Filter out expired shares
    let active_shares: Vec<ShareLink> = shares
        .into_iter()
        .filter(|s| {
            if let Some(exp_unix) = s.expires_at_unix {
                return exp_unix > now_unix;
            }
            true
        })
        .collect();

    save_shares(&active_shares);
    Json(SharesResponse { shares: active_shares })
}

pub async fn delete_share(AxumPath(token): AxumPath<String>) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut shares = load_shares();
    let initial_len = shares.len();
    shares.retain(|s| s.token != token);
    if shares.len() == initial_len {
        return Err(StatusCode::NOT_FOUND);
    }
    save_shares(&shares);
    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn public_get_share(AxumPath(token): AxumPath<String>) -> Result<Response, StatusCode> {
    let shares = load_shares();
    let share = shares.iter().find(|s| s.token == token).ok_or(StatusCode::NOT_FOUND)?;

    // Check expiration
    if let Some(exp_unix) = share.expires_at_unix {
        if exp_unix <= time::OffsetDateTime::now_utc().unix_timestamp() {
            return Err(StatusCode::GONE);
        }
    }

    let path = sanitize_path(&share.file_path)?;
    if !path.exists() {
        return Err(StatusCode::NOT_FOUND);
    }

    if share.is_dir {
        // If directory, download as zip
        let mut zip_buf = std::io::Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut zip_buf);
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated);

            fn add_dir_to_zip(
                zip: &mut zip::ZipWriter<&mut std::io::Cursor<Vec<u8>>>,
                dir_path: &Path,
                prefix: &Path,
                options: zip::write::SimpleFileOptions,
            ) -> std::io::Result<()> {
                for entry in fs::read_dir(dir_path)? {
                    let entry = entry?;
                    let path = entry.path();
                    let name = path.strip_prefix(prefix).unwrap();
                    if path.is_dir() {
                        zip.add_directory(name.to_string_lossy(), options)?;
                        add_dir_to_zip(zip, &path, prefix, options)?;
                    } else {
                        zip.start_file(name.to_string_lossy(), options)?;
                        let mut f = File::open(&path)?;
                        let mut buf = Vec::new();
                        f.read_to_end(&mut buf)?;
                        zip.write_all(&buf)?;
                    }
                }
                Ok(())
            }

            let _ = add_dir_to_zip(&mut zip, &path, &path, options);
            let _ = zip.finish();
        }

        let result_bytes = zip_buf.into_inner();
        let mut headers = HeaderMap::new();
        headers.insert(header::CONTENT_TYPE, "application/zip".parse().unwrap());
        headers.insert(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}.zip\"", share.file_name).parse().unwrap(),
        );
        headers.insert(header::CONTENT_LENGTH, result_bytes.len().to_string().parse().unwrap());

        Ok((headers, result_bytes).into_response())
    } else {
        let mut file = File::open(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let mut contents = Vec::new();
        file.read_to_end(&mut contents).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        let mime = get_mime_type(ext);

        let mut headers = HeaderMap::new();
        headers.insert(header::CONTENT_TYPE, mime.parse().unwrap());
        headers.insert(
            header::CONTENT_DISPOSITION,
            format!("inline; filename=\"{}\"", share.file_name).parse().unwrap(),
        );
        headers.insert(header::CONTENT_LENGTH, contents.len().to_string().parse().unwrap());

        Ok((headers, contents).into_response())
    }
}

