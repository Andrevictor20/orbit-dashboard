use axum::{
    extract::Query,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, RwLock};
use std::collections::HashMap;
use super::path_utils::sanitize_path;
use super::types::{DownloadQuery, SubtitleItem, SubtitlesResponse};

// In-memory LRU-like caches for instantaneous subtitle response (< 0.1ms)
static SUBTITLE_VTT_CACHE: LazyLock<RwLock<HashMap<String, String>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));

static SUBTITLES_LIST_CACHE: LazyLock<RwLock<HashMap<String, SubtitlesResponse>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));

static EXTRACTION_MUTEX: LazyLock<tokio::sync::Mutex<()>> =
    LazyLock::new(|| tokio::sync::Mutex::new(()));

fn get_subtitle_cache_dir() -> PathBuf {
    let base = if Path::new("/data").is_dir() {
        PathBuf::from("/data/cache/subtitles")
    } else {
        PathBuf::from("data/cache/subtitles")
    };
    let _ = fs::create_dir_all(&base);
    base
}

fn sanitize_cache_key(key: &str) -> String {
    key.chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect()
}

pub fn strip_ass_tags(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut in_tag = false;
    for c in input.chars() {
        if c == '{' {
            in_tag = true;
        } else if c == '}' {
            in_tag = false;
        } else if !in_tag {
            out.push(c);
        }
    }
    out.replace("\\N", "\n").replace("\\n", "\n")
}

fn ass_time_to_vtt(time: &str) -> String {
    // Convert ASS time "0:01:23.45" to WebVTT "00:01:23.450"
    let parts: Vec<&str> = time.split(':').collect();
    if parts.len() == 3 {
        let h: u32 = parts[0].parse().unwrap_or(0);
        let m: u32 = parts[1].parse().unwrap_or(0);
        let sec_parts: Vec<&str> = parts[2].split('.').collect();
        let s: u32 = sec_parts[0].parse().unwrap_or(0);
        let cs: u32 = sec_parts.get(1).and_then(|cs| cs.parse().ok()).unwrap_or(0);
        format!("{:02}:{:02}:{:02}.{:03}", h, m, s, cs * 10)
    } else {
        time.to_string()
    }
}

pub fn srt_or_ass_to_vtt(content: &str) -> String {
    let mut vtt = String::from("WEBVTT\n\n");
    let is_ass = content.lines().any(|l| l.starts_with("[Script Info]") || l.starts_with("Dialogue:"));

    if is_ass {
        let mut count = 1;
        for line in content.lines() {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix("Dialogue:") {
                let parts: Vec<&str> = rest.splitn(10, ',').collect();
                if parts.len() >= 10 {
                    let start = parts[1].trim();
                    let end = parts[2].trim();
                    let raw_text = parts[9].trim();

                    let vtt_start = ass_time_to_vtt(start);
                    let vtt_end = ass_time_to_vtt(end);
                    let clean_text = strip_ass_tags(raw_text);

                    if !clean_text.is_empty() {
                        vtt.push_str(&format!("{}\n{} --> {}\n{}\n\n", count, vtt_start, vtt_end, clean_text));
                        count += 1;
                    }
                }
            }
        }
        return vtt;
    }

    // Standard SRT, VTT, SBV and generic line processing
    for line in content.lines() {
        if line.contains("-->") {
            let vtt_line = line.replace(',', ".");
            vtt.push_str(&vtt_line);
            vtt.push('\n');
        } else if line.contains(',') && line.contains(':') && line.chars().all(|c| c.is_ascii_digit() || c == ':' || c == '.' || c == ',') {
            // YouTube .sbv format (e.g. 0:01:23.450,0:01:25.780)
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() == 2 {
                let p1 = if parts[0].matches(':').count() == 1 { format!("00:{}", parts[0]) } else { parts[0].to_string() };
                let p2 = if parts[1].matches(':').count() == 1 { format!("00:{}", parts[1]) } else { parts[1].to_string() };
                vtt.push_str(&format!("{} --> {}\n", p1, p2));
            } else {
                vtt.push_str(line);
                vtt.push('\n');
            }
        } else {
            let clean = strip_ass_tags(line);
            vtt.push_str(&clean);
            vtt.push('\n');
        }
    }
    vtt
}

fn vtt_response_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/vtt; charset=utf-8"));
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=86400"));
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    headers.insert(header::ACCESS_CONTROL_ALLOW_HEADERS, HeaderValue::from_static("*"));
    headers.insert(header::ACCESS_CONTROL_ALLOW_METHODS, HeaderValue::from_static("GET, OPTIONS"));
    headers
}

pub async fn get_subtitle_vtt(Query(q): Query<DownloadQuery>) -> Result<impl IntoResponse, StatusCode> {
    // 1. Check in-memory cache first (instant 0.01ms response)
    if let Ok(cache) = SUBTITLE_VTT_CACHE.read() {
        if let Some(cached_vtt) = cache.get(&q.path) {
            return Ok((StatusCode::OK, vtt_response_headers(), cached_vtt.clone()));
        }
    }

    // 2. Check on-disk cache for internal subtitle extractions
    let cache_dir = get_subtitle_cache_dir();
    let cache_file_name = format!("{}.vtt", sanitize_cache_key(&q.path));
    let disk_cache_path = cache_dir.join(&cache_file_name);

    if disk_cache_path.exists() {
        if let Ok(disk_content) = fs::read_to_string(&disk_cache_path) {
            if let Ok(mut cache) = SUBTITLE_VTT_CACHE.write() {
                cache.insert(q.path.clone(), disk_content.clone());
            }
            return Ok((StatusCode::OK, vtt_response_headers(), disk_content));
        }
    }

    // 3. Extract internal subtitle track via ffmpeg if not cached
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

        // Singleflight lock to prevent concurrent ffmpeg processes thrashing disk I/O
        let _guard = EXTRACTION_MUTEX.lock().await;

        // Re-check cache in case another worker just finished extracting this track
        if disk_cache_path.exists() {
            if let Ok(disk_content) = fs::read_to_string(&disk_cache_path) {
                if let Ok(mut cache) = SUBTITLE_VTT_CACHE.write() {
                    cache.insert(q.path.clone(), disk_content.clone());
                }
                return Ok((StatusCode::OK, vtt_response_headers(), disk_content));
            }
        }

        // Limit ffmpeg to 1 thread with timeout to avoid CPU & I/O starvation on low-power hosts
        // Use -vn and -an to skip video and audio decoding completely for ultra-fast subtitle extraction
        let extract_future = tokio::process::Command::new("ffmpeg")
            .args([
                "-v", "error",
                "-threads", "1",
                "-i",
            ])
            .arg(&video_path)
            .args([
                "-map", &format!("0:{}", stream_idx),
                "-vn", "-an",
                "-f", "webvtt",
                "-",
            ])
            .output();

        let output = tokio::time::timeout(std::time::Duration::from_secs(45), extract_future)
            .await
            .map_err(|_| StatusCode::REQUEST_TIMEOUT)?
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let raw_vtt = String::from_utf8_lossy(&output.stdout).to_string();
        let cleaned_vtt = if raw_vtt.contains("WEBVTT") {
            strip_ass_tags(&raw_vtt)
        } else {
            srt_or_ass_to_vtt(&raw_vtt)
        };

        // Store in memory & disk cache
        let _ = fs::write(&disk_cache_path, &cleaned_vtt);
        if let Ok(mut cache) = SUBTITLE_VTT_CACHE.write() {
            cache.insert(q.path.clone(), cleaned_vtt.clone());
        }

        return Ok((StatusCode::OK, vtt_response_headers(), cleaned_vtt));
    }

    // 4. Read external subtitle file (.srt, .vtt, .ass)
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

    // Store in memory cache
    if let Ok(mut cache) = SUBTITLE_VTT_CACHE.write() {
        cache.insert(q.path.clone(), vtt.clone());
    }

    Ok((StatusCode::OK, vtt_response_headers(), vtt))
}

pub async fn get_subtitles(Query(q): Query<DownloadQuery>) -> Result<impl IntoResponse, StatusCode> {
    let mut cors_headers = HeaderMap::new();
    cors_headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    cors_headers.insert(header::ACCESS_CONTROL_ALLOW_HEADERS, HeaderValue::from_static("*"));

    // 1. Check if subtitle list is already cached
    if let Ok(cache) = SUBTITLES_LIST_CACHE.read() {
        if let Some(cached_resp) = cache.get(&q.path) {
            return Ok((cors_headers, Json(cached_resp.clone())));
        }
    }

    let video_path = sanitize_path(&q.path)?;
    let mut subtitles = Vec::new();

    // 2. Scan companion external subtitle files (.srt, .vtt, .ass) in the folder FIRST (zero CPU)
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
                    let is_supported_sub = match ext_lower.as_str() {
                        "srt" | "vtt" | "ass" | "ssa" | "sub" | "sbv" | "smi" => true,
                        _ => false,
                    };
                    if is_supported_sub {
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

    let mut duration = None;

    // 3. Probing internal embedded subtitles (MKV/MP4/WebM) and duration via ffprobe
    // Use 15s timeout to allow waking up sleeping external hard drives under load
    let ffprobe_result = tokio::time::timeout(
        std::time::Duration::from_secs(15),
        tokio::process::Command::new("ffprobe")
            .args([
                "-v", "error",
                "-select_streams", "s",
                "-show_entries", "format=duration:stream=index,codec_name:stream_tags=language,title",
                "-of", "json",
            ])
            .arg(&video_path)
            .output()
    ).await;

    if let Ok(Ok(ref output)) = ffprobe_result {
        if output.status.success() {
            if let Ok(json_val) = serde_json::from_slice::<serde_json::Value>(&output.stdout) {
                if let Some(dur_str) = json_val.get("format").and_then(|f| f.get("duration")).and_then(|d| d.as_str()) {
                    if let Ok(d) = dur_str.parse::<f64>() {
                        if d > 0.0 && d.is_finite() {
                            duration = Some(d);
                        }
                    }
                }

                if let Some(streams) = json_val.get("streams").and_then(|s| s.as_array()) {
                    for (stream_order, stream) in streams.iter().enumerate() {
                        let codec_name = stream.get("codec_name").and_then(|c| c.as_str()).unwrap_or("").to_lowercase();
                        // Filter out bitmap subtitles (PGS, VobSub, DVB) which fail conversion to WebVTT without OCR
                        let is_text_codec = match codec_name.as_str() {
                            "subrip" | "srt" | "ass" | "ssa" | "webvtt" | "mov_text" | "text" => true,
                            other => other.contains("text") || other.contains("srt") || other.contains("ass"),
                        };
                        if !is_text_codec && !codec_name.is_empty() {
                            continue;
                        }

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

    let response = SubtitlesResponse {
        subtitles,
        duration,
    };

    // Cache if subtitles were found or duration was obtained
    if !response.subtitles.is_empty() || response.duration.is_some() {
        if let Ok(mut cache) = SUBTITLES_LIST_CACHE.write() {
            cache.insert(q.path.clone(), response.clone());
        }
    }

    Ok((cors_headers, Json(response)))
}
