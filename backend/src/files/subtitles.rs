use axum::{
    extract::Query,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use std::fs;
use super::path_utils::sanitize_path;
use super::types::{DownloadQuery, SubtitleItem, SubtitlesResponse};

pub fn srt_or_ass_to_vtt(content: &str) -> String {
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
