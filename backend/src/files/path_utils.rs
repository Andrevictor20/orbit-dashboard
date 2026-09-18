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
        "mp4" | "m4v" => "video/mp4",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "mov" => "video/quicktime",
        "avi" => "video/x-msvideo",
        "vtt" => "text/vtt; charset=utf-8",
        "srt" => "text/plain; charset=utf-8",
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

pub fn validate_user_storage_access(path: &Path, role: &str) -> Result<(), StatusCode> {
    if role == "admin" {
        return Ok(());
    }

    let p_str = path.to_string_lossy().replace('\\', "/");
    let display = to_display_path(path).replace('\\', "/");
    let norm_p = if p_str.starts_with('/') { p_str.clone() } else { format!("/{}", p_str) };
    let norm_disp = if display.starts_with('/') { display.clone() } else { format!("/{}", display) };

    if let Ok(custom) = std::env::var("SATURN_ALLOWED_MEMBER_STORAGE") {
        for prefix in custom.split(':') {
            let p_trim = prefix.trim().trim_start_matches('/');
            if !p_trim.is_empty() && (p_str.contains(p_trim) || display.contains(p_trim)) {
                return Ok(());
            }
        }
    }

    let allowed_prefixes = [
        "/media", "/mnt", "/DATA", "/data", "/storage", "/disks", "/volumes",
        "/host/media", "/host/mnt", "/host/DATA", "/host/data", "/host/storage", "/host/disks", "/host/volumes"
    ];

    let is_allowed = allowed_prefixes.iter().any(|prefix| {
        norm_p.starts_with(prefix) || norm_disp.starts_with(prefix)
    });

    if !is_allowed {
        tracing::warn!("Acesso negado para usuário comum ao caminho restrito do sistema: {:?}", path);
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(())
}

