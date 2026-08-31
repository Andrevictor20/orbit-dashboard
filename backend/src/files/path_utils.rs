use axum::http::StatusCode;
use std::path::{Path, PathBuf};

pub fn sanitize_path(raw: &str) -> Result<PathBuf, StatusCode> {
    if raw.contains('\0') {
        return Err(StatusCode::BAD_REQUEST);
    }
    let trimmed = raw.trim();
    let p = if trimmed.is_empty() { "/" } else { trimmed };

    // If running inside a container where host root is mounted at /host
    if Path::new("/host").is_dir() {
        if p == "/" || p == "/host" {
            return Ok(PathBuf::from("/host"));
        }
        if p.starts_with("/host/") {
            return Ok(PathBuf::from(p));
        }
        // Map host path: e.g. /home/user -> /host/home/user, /mnt -> /host/mnt
        let clean = p.trim_start_matches('/');
        let mapped = Path::new("/host").join(clean);
        if mapped.exists() {
            return Ok(mapped);
        }
    }

    if Path::new(p).exists() {
        return Ok(PathBuf::from(p));
    }

    // Fallback: if /host exists, map to /host/<clean> even if it doesn't exist yet
    if Path::new("/host").is_dir() {
        let clean = p.trim_start_matches('/');
        return Ok(Path::new("/host").join(clean));
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

pub fn get_mime_type(ext: &str) -> &'static str {
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
