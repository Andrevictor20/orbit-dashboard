use axum::{
    body::Body,
    extract::Query,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio_util::io::ReaderStream;
use super::path_utils::{get_mime_type, sanitize_path};
use super::types::DownloadQuery;

// --- HIGH-PERFORMANCE VIDEO & AUDIO STREAMING ---
// Optimized for low latency, smooth progressive buffering, and RFC 7233 range compliance.
// Open-ended ranges (e.g. bytes=0-) are bounded to 4MB chunks so browsers obtain the initial
// metadata / moov atom instantly and can start playback without waiting to download the full file.

const IO_BUFFER_CAPACITY: usize = 64 * 1024; // 64KB async I/O buffer to reduce syscalls
const DEFAULT_CHUNK_SIZE: u64 = 4 * 1024 * 1024; // 4MB per progressive stream chunk

pub async fn stream_media(
    headers: HeaderMap,
    Query(q): Query<DownloadQuery>,
) -> Result<Response, StatusCode> {
    let path = sanitize_path(&q.path)?;
    if !path.exists() || path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let mut file = tokio::fs::File::open(&path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let total_size = file
        .metadata()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .len();

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let mime = get_mime_type(ext);

    let range_header = headers.get(header::RANGE).and_then(|r| r.to_str().ok());

    if let Some(range_str) = range_header {
        if let Some(range_spec) = range_str.strip_prefix("bytes=") {
            let (start, end) = if let Some(suffix) = range_spec.strip_prefix('-') {
                // Suffix range: bytes=-N (requesting the last N bytes of the file)
                // Essential for MP4 fast-start / moov atom probing and MKV cluster indexes
                let n: u64 = suffix.trim().parse().unwrap_or(0);
                let start = total_size.saturating_sub(n);
                let end = total_size.saturating_sub(1);
                (start, end)
            } else if let Some((start_str, end_str)) = range_spec.split_once('-') {
                let start: u64 = start_str.trim().parse().unwrap_or(0);
                let raw_end: Option<u64> = if end_str.trim().is_empty() {
                    None
                } else {
                    end_str.trim().parse().ok()
                };

                let end = if let Some(e) = raw_end {
                    e.min(total_size.saturating_sub(1))
                } else {
                    // Open-ended range (bytes=X-): stream 4MB chunk so player starts immediately
                    // and requests subsequent chunks progressively without buffering stalls
                    (start + DEFAULT_CHUNK_SIZE - 1).min(total_size.saturating_sub(1))
                };
                (start, end)
            } else {
                (0, total_size.saturating_sub(1))
            };

            if total_size == 0 || start > end || start >= total_size {
                let mut resp_headers = HeaderMap::new();
                resp_headers.insert(header::CONTENT_RANGE, format!("bytes */{}", total_size).parse().unwrap());
                resp_headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
                return Ok((StatusCode::RANGE_NOT_SATISFIABLE, resp_headers).into_response());
            }

            let chunk_size = (end - start) + 1;
            file.seek(SeekFrom::Start(start))
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            let stream = ReaderStream::with_capacity(file.take(chunk_size), IO_BUFFER_CAPACITY);
            let body = Body::from_stream(stream);

            let mut resp_headers = HeaderMap::new();
            resp_headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(mime));
            resp_headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
            resp_headers.insert(
                header::CONTENT_RANGE,
                format!("bytes {}-{}/{}", start, end, total_size).parse().unwrap(),
            );
            resp_headers.insert(header::CONTENT_LENGTH, chunk_size.to_string().parse().unwrap());
            resp_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=86400, stale-while-revalidate=604800"));
            resp_headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
            resp_headers.insert(header::ACCESS_CONTROL_ALLOW_HEADERS, HeaderValue::from_static("*"));

            return Ok((StatusCode::PARTIAL_CONTENT, resp_headers, body).into_response());
        }
    }

    // Standard GET without Range header
    let stream = ReaderStream::with_capacity(file, IO_BUFFER_CAPACITY);
    let body = Body::from_stream(stream);

    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(mime));
    resp_headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    resp_headers.insert(header::CONTENT_LENGTH, total_size.to_string().parse().unwrap());
    resp_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=86400, stale-while-revalidate=604800"));
    resp_headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    resp_headers.insert(header::ACCESS_CONTROL_ALLOW_HEADERS, HeaderValue::from_static("*"));

    Ok((StatusCode::OK, resp_headers, body).into_response())
}
