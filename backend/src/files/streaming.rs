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

    // 8MB maximum chunk size per open range request for instant playback start and smooth buffering
    const MAX_CHUNK_SIZE: u64 = 8 * 1024 * 1024;

    if let Some(range_str) = range_header {
        if let Some(range_spec) = range_str.strip_prefix("bytes=") {
            let parts: Vec<&str> = range_spec.split('-').collect();
            let start: u64 = parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
            
            let raw_end: Option<u64> = parts.get(1).and_then(|s| s.parse().ok());
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
            file.seek(SeekFrom::Start(start)).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            let stream = ReaderStream::new(file.take(chunk_size));
            let body = Body::from_stream(stream);

            let mut resp_headers = HeaderMap::new();
            resp_headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(mime));
            resp_headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
            resp_headers.insert(
                header::CONTENT_RANGE,
                format!("bytes {}-{}/{}", start, end, total_size).parse().unwrap(),
            );
            resp_headers.insert(header::CONTENT_LENGTH, chunk_size.to_string().parse().unwrap());
            resp_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=3600"));

            return Ok((StatusCode::PARTIAL_CONTENT, resp_headers, body).into_response());
        }
    }

    // Standard GET without Range header -> return 200 OK with full stream
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(mime));
    resp_headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    resp_headers.insert(header::CONTENT_LENGTH, total_size.to_string().parse().unwrap());
    resp_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=3600"));

    Ok((StatusCode::OK, resp_headers, body).into_response())
}
