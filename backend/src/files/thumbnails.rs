use axum::{
    body::Body,
    extract::Query,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::Hasher;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use tokio_util::io::ReaderStream;
use super::path_utils::{get_mime_type, sanitize_path};
use super::types::DownloadQuery;

const IO_BUFFER_CAPACITY: usize = 32 * 1024;

// Global semaphore to throttle concurrent thumbnail extractions
// Prevents I/O queue thrashing on external USB and mechanical hard drives
static THUMBNAIL_SEMAPHORE: LazyLock<tokio::sync::Semaphore> =
    LazyLock::new(|| tokio::sync::Semaphore::new(4));

fn get_thumbnail_cache_dir() -> PathBuf {
    let base = if Path::new("/data").is_dir() {
        PathBuf::from("/data/cache/thumbnails")
    } else {
        PathBuf::from("data/cache/thumbnails")
    };
    let _ = fs::create_dir_all(&base);
    base
}

fn compute_cache_key(path_str: &str, modified_sec: u64, size: u64) -> String {
    let mut hasher = DefaultHasher::new();
    hasher.write(b"thumb_v2");
    hasher.write(path_str.as_bytes());
    hasher.write_u64(modified_sec);
    hasher.write_u64(size);
    format!("{:016x}", hasher.finish())
}

pub async fn get_file_thumbnail(
    _headers: HeaderMap,
    Query(q): Query<DownloadQuery>,
) -> Result<Response, StatusCode> {
    let path = sanitize_path(&q.path)?;
    if !path.exists() || path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let size = metadata.len();
    let modified_sec = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let cache_dir = get_thumbnail_cache_dir();
    let cache_key = compute_cache_key(&path.to_string_lossy(), modified_sec, size);
    let cache_file = cache_dir.join(format!("{}.jpg", cache_key));

    // 1. Return cached thumbnail if present (< 0.1ms)
    if cache_file.exists() {
        return serve_thumbnail_file(&cache_file).await;
    }

    // 2. Throttle generation concurrency to protect mechanical HDDs from I/O starvation
    let _permit = THUMBNAIL_SEMAPHORE
        .acquire()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Double-check cache in case another worker just finished generating it while waiting
    if cache_file.exists() {
        return serve_thumbnail_file(&cache_file).await;
    }

    // 3. Generate thumbnail according to file type
    let is_image = matches!(
        ext.as_str(),
        "jpg" | "jpeg" | "png" | "webp" | "gif" | "bmp" | "ico" | "avif" | "svg"
    );
    let is_video = matches!(
        ext.as_str(),
        "mp4" | "mkv" | "webm" | "mov" | "avi" | "flv" | "wmv" | "m4v" | "ts" | "m2ts"
    );
    let is_pdf = ext == "pdf";

    if is_svg(&ext) {
        // Direct serve SVG without conversion
        return serve_file_directly(&path, "image/svg+xml").await;
    }

    if is_image {
        // Generate a 256px thumbnail using ffmpeg if installed, or fallback to direct serve
        let generated = tokio::process::Command::new("ffmpeg")
            .args([
                "-v", "error",
                "-y",
                "-i",
            ])
            .arg(&path)
            .args([
                "-vf", "scale=256:-1",
                "-q:v", "3",
                "-update", "1",
            ])
            .arg(&cache_file)
            .status()
            .await
            .map(|s| s.success() && cache_file.exists())
            .unwrap_or(false);

        if generated {
            return serve_thumbnail_file(&cache_file).await;
        }

        let mime = get_mime_type(&ext);
        return serve_file_directly(&path, mime).await;
    }

    if is_video {
        if extract_video_thumbnail(&path, &cache_file).await {
            return serve_thumbnail_file(&cache_file).await;
        }
    }

    if is_pdf {
        // Try pdftoppm first
        let cache_prefix = cache_dir.join(&cache_key);
        let pdftoppm_ok = tokio::process::Command::new("pdftoppm")
            .args(["-jpeg", "-f", "1", "-l", "1", "-scale-to", "256", "-singlefile"])
            .arg(&path)
            .arg(&cache_prefix)
            .status()
            .await
            .map(|s| s.success() && cache_file.exists())
            .unwrap_or(false);

        if pdftoppm_ok {
            return serve_thumbnail_file(&cache_file).await;
        }

        // Fallback: try ffmpeg
        let ffmpeg_pdf_ok = tokio::process::Command::new("ffmpeg")
            .args([
                "-v", "error",
                "-y",
                "-i",
            ])
            .arg(&path)
            .args([
                "-vframes", "1",
                "-vf", "scale=256:-1",
                "-q:v", "3",
                "-update", "1",
            ])
            .arg(&cache_file)
            .status()
            .await
            .map(|s| s.success() && cache_file.exists())
            .unwrap_or(false);

        if ffmpeg_pdf_ok {
            return serve_thumbnail_file(&cache_file).await;
        }
    }

    Err(StatusCode::NOT_FOUND)
}

fn is_svg(ext: &str) -> bool {
    ext == "svg"
}

async fn serve_thumbnail_file(file_path: &Path) -> Result<Response, StatusCode> {
    serve_file_directly(file_path, "image/jpeg").await
}

async fn serve_file_directly(file_path: &Path, content_type: &'static str) -> Result<Response, StatusCode> {
    let file = tokio::fs::File::open(file_path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let size = file
        .metadata()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .len();

    let stream = ReaderStream::with_capacity(file, IO_BUFFER_CAPACITY);
    let body = Body::from_stream(stream);

    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type));
    resp_headers.insert(header::CONTENT_LENGTH, size.to_string().parse().unwrap());
    resp_headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=604800, stale-while-revalidate=86400"),
    );
    resp_headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    resp_headers.insert(header::ACCESS_CONTROL_ALLOW_HEADERS, HeaderValue::from_static("*"));

    Ok((StatusCode::OK, resp_headers, body).into_response())
}

async fn extract_video_thumbnail(path: &Path, cache_file: &Path) -> bool {
    // Fast keyframe extraction near the start of the file (3s -> 1s -> 0s)
    // Avoids seeking deep into large 1.5GB+ MKV files on external HDDs, reducing I/O latency to < 300ms
    let seek_points = ["3.0", "1.0", "0.0"];

    for seek in seek_points {
        let ok = tokio::time::timeout(
            std::time::Duration::from_secs(4),
            tokio::process::Command::new("ffmpeg")
                .args([
                    "-v", "error",
                    "-y",
                    "-noaccurate_seek",
                    "-ss", seek,
                    "-i",
                ])
                .arg(path)
                .args([
                    "-map", "0:v:0",
                    "-vframes", "1",
                    "-an",
                    "-sn",
                    "-threads", "1",
                    "-vf", "scale=256:-1",
                    "-q:v", "3",
                    "-update", "1",
                ])
                .arg(cache_file)
                .status(),
        )
        .await
        .map(|res| res.map(|s| s.success() && cache_file.exists()).unwrap_or(false))
        .unwrap_or(false);

        if ok {
            return true;
        }
    }

    false
}


