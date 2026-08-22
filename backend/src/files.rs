use axum::{
    extract::{Query, Path as AxumPath, Multipart},
    http::{header, HeaderMap, StatusCode},
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

#[derive(Debug, Serialize, Deserialize)]
pub struct ShortcutsResponse {
    pub root: String,
    pub data: String,
    pub documents: String,
    pub downloads: String,
    pub gallery: String,
    pub media: String,
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

// --- HELPER FUNCTIONS ---

pub fn sanitize_path(raw: &str) -> Result<PathBuf, StatusCode> {
    if raw.contains('\0') {
        return Err(StatusCode::BAD_REQUEST);
    }
    let p = Path::new(raw);
    Ok(p.to_path_buf())
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
            path: p.to_string_lossy().to_string(),
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
        current_path: path.to_string_lossy().to_string(),
        items,
        total_items,
    }))
}

pub async fn get_shortcuts() -> Json<ShortcutsResponse> {
    let data_dir = std::env::var("ORBIT_DATA_DIR").unwrap_or_else(|_| "/DATA".to_string());
    Json(ShortcutsResponse {
        root: "/".to_string(),
        data: data_dir.clone(),
        documents: format!("{}/Documents", data_dir),
        downloads: format!("{}/Downloads", data_dir),
        gallery: format!("{}/Gallery", data_dir),
        media: format!("{}/Media", data_dir),
    })
}

pub async fn list_storages() -> Json<StoragesResponse> {
    let disks = Disks::new_with_refreshed_list();
    let mut mounts = Vec::new();

    for disk in &disks {
        let mount_point = disk.mount_point().to_string_lossy().to_string();
        let name = disk.name().to_string_lossy().to_string();
        let fs_type = disk.file_system().to_string_lossy().to_string();

        let name_lower = name.to_lowercase();
        let mount_lower = mount_point.to_lowercase();
        let fs_lower = fs_type.to_lowercase();

        if name_lower.contains("overlay")
            || mount_lower.contains("overlay")
            || fs_lower.contains("overlay")
            || fs_lower.contains("tmpfs")
            || fs_lower.contains("devtmpfs")
            || fs_lower.contains("squashfs")
            || mount_lower.starts_with("/etc/")
            || mount_lower.starts_with("/proc")
            || mount_lower.starts_with("/sys")
            || mount_lower.starts_with("/dev")
            || mount_lower == "/app/data"
        {
            continue;
        }

        let display_name = if name_lower.contains("mmcblk") || name_lower.contains("sdcard") {
            "Cartão microSD (Sistema)".to_string()
        } else if name_lower.contains("nvme") {
            "SSD NVMe".to_string()
        } else if mount_lower.starts_with("/mnt") || mount_lower.starts_with("/media") {
            let folder = mount_point.split('/').filter(|s| !s.is_empty()).last().unwrap_or("Externo");
            format!("HD Externo ({})", folder)
        } else if name_lower.starts_with("/dev/sd") || name_lower.starts_with("sd") {
            if mount_point == "/" || mount_point == "/root" {
                "SSD / HD Principal".to_string()
            } else {
                "HD / Armazenamento USB".to_string()
            }
        } else if mount_point == "/" || name_lower == "root" || name_lower == "/dev/root" {
            "Armazenamento do Sistema".to_string()
        } else if !name.is_empty() && name != "/" {
            name
        } else {
            mount_point.clone()
        };

        let total_bytes = disk.total_space();
        let available_bytes = disk.available_space();
        let used_bytes = total_bytes.saturating_sub(available_bytes);

        mounts.push(MountItem {
            name: display_name,
            mount_point,
            fs_type,
            total_bytes,
            used_bytes,
            available_bytes,
        });
    }

    // Always ensure at least Root exists
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

fn load_cloud_accounts() -> Vec<CloudAccount> {
    if let Ok(data) = fs::read_to_string(CLOUD_ACCOUNTS_FILE) {
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Vec::new()
    }
}

fn save_cloud_accounts(accounts: &[CloudAccount]) {
    let _ = fs::create_dir_all("data");
    let _ = fs::write(CLOUD_ACCOUNTS_FILE, serde_json::to_string_pretty(accounts).unwrap_or_default());
}

pub async fn connect_cloud(Json(req): Json<ConnectCloudRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut accounts = load_cloud_accounts();
    let id = format!("cloud_{}", Uuid::new_v4().simple());
    let now = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default();

    let account = CloudAccount {
        id: id.clone(),
        provider: req.provider,
        name: req.name,
        config: req.config,
        mount_point: Some(format!("/mnt/cloud/{}", id)),
        connected_at: now,
    };

    accounts.push(account);
    save_cloud_accounts(&accounts);

    Ok(Json(serde_json::json!({ "success": true, "id": id })))
}

pub async fn list_cloud_accounts() -> Json<serde_json::Value> {
    let accounts = load_cloud_accounts();
    Json(serde_json::json!({ "accounts": accounts }))
}

pub async fn disconnect_cloud(AxumPath(id): AxumPath<String>) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut accounts = load_cloud_accounts();
    let initial_len = accounts.len();
    accounts.retain(|a| a.id != id);
    if accounts.len() == initial_len {
        return Err(StatusCode::NOT_FOUND);
    }
    save_cloud_accounts(&accounts);
    Ok(Json(serde_json::json!({ "success": true })))
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

    let mut file = File::open(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let total_size = file.metadata().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?.len();

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let mime = get_mime_type(ext);

    let range_header = headers.get(header::RANGE).and_then(|r| r.to_str().ok());

    if let Some(range_str) = range_header {
        if let Some(range_spec) = range_str.strip_prefix("bytes=") {
            let parts: Vec<&str> = range_spec.split('-').collect();
            let start: u64 = parts.get(0).and_then(|s| s.parse().ok()).unwrap_or(0);
            let end: u64 = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(total_size.saturating_sub(1));
            let end = end.min(total_size.saturating_sub(1));

            if start > end || start >= total_size {
                let mut resp_headers = HeaderMap::new();
                resp_headers.insert(header::CONTENT_RANGE, format!("bytes */{}", total_size).parse().unwrap());
                return Ok((StatusCode::RANGE_NOT_SATISFIABLE, resp_headers).into_response());
            }

            let chunk_size = (end - start) + 1;
            let mut chunk = vec![0u8; chunk_size as usize];
            file.seek(SeekFrom::Start(start)).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            file.read_exact(&mut chunk).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            let mut resp_headers = HeaderMap::new();
            resp_headers.insert(header::CONTENT_TYPE, mime.parse().unwrap());
            resp_headers.insert(header::ACCEPT_RANGES, "bytes".parse().unwrap());
            resp_headers.insert(
                header::CONTENT_RANGE,
                format!("bytes {}-{}/{}", start, end, total_size).parse().unwrap(),
            );
            resp_headers.insert(header::CONTENT_LENGTH, chunk_size.to_string().parse().unwrap());

            return Ok((StatusCode::PARTIAL_CONTENT, resp_headers, chunk).into_response());
        }
    }

    let mut full_buf = Vec::new();
    file.read_to_end(&mut full_buf).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(header::CONTENT_TYPE, mime.parse().unwrap());
    resp_headers.insert(header::ACCEPT_RANGES, "bytes".parse().unwrap());
    resp_headers.insert(header::CONTENT_LENGTH, full_buf.len().to_string().parse().unwrap());

    Ok((StatusCode::OK, resp_headers, full_buf).into_response())
}

pub async fn get_subtitles(Query(q): Query<DownloadQuery>) -> Result<Json<SubtitlesResponse>, StatusCode> {
    let video_path = sanitize_path(&q.path)?;
    let mut subtitles = Vec::new();

    if let Some(parent) = video_path.parent() {
        let video_stem = video_path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
        if let Ok(entries) = fs::read_dir(parent) {
            for entry in entries.flatten() {
                let p = entry.path();
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if ext_lower == "srt" || ext_lower == "vtt" || ext_lower == "ass" {
                        let name = entry.file_name().to_string_lossy().to_string();
                        let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("");
                        
                        // If it matches video stem or is a subtitle in the same folder
                        if stem.starts_with(video_stem) || name.contains(video_stem) || subtitles.is_empty() {
                            let label = if name.contains("pt-BR") || name.contains("pt") || name.contains("por") {
                                "Português".to_string()
                            } else if name.contains("en") || name.contains("eng") {
                                "English".to_string()
                            } else if name.contains("es") || name.contains("spa") {
                                "Español".to_string()
                            } else {
                                name.clone()
                            };

                            let lang = if label == "Português" { "pt-BR" } else if label == "English" { "en" } else { "und" };

                            subtitles.push(SubtitleItem {
                                name,
                                path: p.to_string_lossy().to_string(),
                                label,
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
