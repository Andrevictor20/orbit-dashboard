use axum::{
    extract::Query,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs::File;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::Path;

#[derive(Deserialize, Debug, Default)]
pub struct LogsQuery {
    pub source: Option<String>, // "orbit", "system", "docker", "dmesg", "all"
    pub level: Option<String>,  // "all", "info", "warn", "error", "debug"
    pub lines: Option<usize>,   // default 500, max 2000
    pub q: Option<String>,      // search term
}

#[derive(Serialize)]
pub struct LogsResponse {
    pub logs: Vec<String>,
    pub source: String,
    pub available_sources: Vec<String>,
    pub total: usize,
}

pub async fn get_logs(Query(params): Query<LogsQuery>) -> impl IntoResponse {
    let source = params.source.as_deref().unwrap_or("orbit");
    let level_filter = params.level.as_deref().unwrap_or("all").to_lowercase();
    let max_lines = params.lines.unwrap_or(500).min(2000);
    let search_query = params.q.as_deref().map(|s| s.to_lowercase());

    let raw_logs: Vec<String> = match source {
        "system" => fetch_system_logs(max_lines).await,
        "docker" => fetch_docker_logs(max_lines).await,
        "dmesg" => fetch_dmesg_logs(max_lines).await,
        "all" => {
            let mut combined = fetch_orbit_logs(max_lines / 2).await;
            let mut sys = fetch_system_logs(max_lines / 2).await;
            combined.append(&mut sys);
            combined
        },
        _ => fetch_orbit_logs(max_lines).await,
    };

    let filtered_logs: Vec<String> = raw_logs
        .into_iter()
        .filter(|line| filter_log_line(line, &level_filter, search_query.as_deref()))
        .collect();

    let total = filtered_logs.len();
    let logs = if filtered_logs.len() > max_lines {
        filtered_logs[filtered_logs.len() - max_lines..].to_vec()
    } else {
        filtered_logs
    };

    let available_sources = vec![
        "orbit".to_string(),
        "system".to_string(),
        "docker".to_string(),
        "dmesg".to_string(),
        "all".to_string(),
    ];

    (StatusCode::OK, Json(LogsResponse {
        logs,
        source: source.to_string(),
        available_sources,
        total,
    })).into_response()
}

pub fn filter_log_line(line: &str, level_filter: &str, search_query: Option<&str>) -> bool {
    let lower = line.to_lowercase();
    
    // Level check
    let matches_level = match level_filter {
        "error" => lower.contains("error") || lower.contains("crit") || lower.contains("emerg") || lower.contains("failed") || lower.contains("fatal") || lower.contains("[err"),
        "warn" => lower.contains("warn") || lower.contains("warning") || lower.contains("error") || lower.contains("crit") || lower.contains("emerg"),
        "info" => true,
        "debug" => true,
        _ => true,
    };

    if !matches_level {
        return false;
    }

    // Search query check
    if let Some(q) = search_query {
        if !lower.contains(q) {
            return false;
        }
    }

    true
}

#[derive(Deserialize, Debug, Default)]
pub struct ClearLogsQuery {
    pub source: Option<String>,
}

pub fn read_last_n_lines_from_file(path: &Path, max_lines: usize) -> std::io::Result<Vec<String>> {
    if max_lines == 0 {
        return Ok(Vec::new());
    }

    let mut file = File::open(path)?;
    let file_len = file.metadata()?.len();

    // If file is small (< 512 KB), read sequentially with bounded deque
    if file_len < 512 * 1024 {
        let reader = BufReader::new(file);
        let mut deque = VecDeque::with_capacity(max_lines);
        for line in reader.lines() {
            if let Ok(l) = line {
                if deque.len() == max_lines {
                    deque.pop_front();
                }
                deque.push_back(l);
            }
        }
        return Ok(deque.into());
    }

    // For large files, seek backwards from EOF in chunks
    let chunk_size = 65536u64;
    let mut pos = file_len;
    let mut buffer = Vec::new();
    let mut newline_count = 0;

    while pos > 0 && newline_count <= max_lines {
        let read_size = chunk_size.min(pos);
        pos -= read_size;
        file.seek(SeekFrom::Start(pos))?;

        let mut chunk = vec![0u8; read_size as usize];
        file.read_exact(&mut chunk)?;

        for &b in chunk.iter().rev() {
            if b == b'\n' {
                newline_count += 1;
                if newline_count > max_lines {
                    break;
                }
            }
        }

        chunk.append(&mut buffer);
        buffer = chunk;
    }

    let text = String::from_utf8_lossy(&buffer);
    let mut lines: Vec<String> = text.lines().map(|s| s.to_string()).collect();
    if lines.len() > max_lines {
        lines = lines[lines.len() - max_lines..].to_vec();
    }
    Ok(lines)
}

pub fn shrink_active_log_file(path: &Path, max_bytes: u64, keep_lines: usize) -> bool {
    if !path.exists() {
        return false;
    }
    if let Ok(meta) = path.metadata() {
        if meta.len() > max_bytes {
            if let Ok(lines) = read_last_n_lines_from_file(path, keep_lines) {
                let content = lines.join("\n") + if lines.is_empty() { "" } else { "\n" };
                let _ = std::fs::write(path, content);
                return true;
            }
        }
    }
    false
}

pub fn prune_old_log_files(dir_path: &str, keep_files: usize, max_total_bytes: u64) -> usize {
    let path = Path::new(dir_path);
    if !path.exists() || !path.is_dir() {
        return 0;
    }

    // Shrink active orbit.log if it exceeds 10MB
    let active_log = path.join("orbit.log");
    if active_log.exists() {
        let max_active_size = 10 * 1024 * 1024; // 10MB
        shrink_active_log_file(&active_log, max_active_size, 2000);
    }

    let mut log_files: Vec<(std::path::PathBuf, u64, std::time::SystemTime)> = Vec::new();

    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                if name.starts_with("orbit.log.") {
                    if let Ok(meta) = entry.metadata() {
                        if meta.is_file() {
                            let modified = meta.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                            log_files.push((p, meta.len(), modified));
                        }
                    }
                }
            }
        }
    }

    log_files.sort_by_key(|(_, _, mod_time)| *mod_time);

    let mut removed_count = 0;
    let mut total_files = log_files.len();
    let mut total_size: u64 = log_files.iter().map(|(_, size, _)| *size).sum();

    for (file_path, file_size, _) in log_files {
        if total_files > keep_files || total_size > max_total_bytes {
            if std::fs::remove_file(&file_path).is_ok() {
                removed_count += 1;
                total_files = total_files.saturating_sub(1);
                total_size = total_size.saturating_sub(file_size);
            }
        }
    }

    removed_count
}

pub async fn clear_logs(Query(params): Query<ClearLogsQuery>) -> impl IntoResponse {
    let source = params.source.as_deref().unwrap_or("orbit");
    let mut cleared_sources = Vec::new();

    if source == "orbit" || source == "all" {
        for p in ["data/orbit.log", "/app/data/orbit.log", "orbit.log"] {
            let path = Path::new(p);
            if path.exists() {
                let _ = std::fs::write(path, "");
            }
        }
        for dir in ["data", "/app/data"] {
            let _ = prune_old_log_files(dir, 0, 0);
        }
        cleared_sources.push("orbit");
    }

    if source == "system" || source == "docker" || source == "all" {
        let _ = tokio::process::Command::new("journalctl")
            .arg("--vacuum-size=10M")
            .output()
            .await;

        let _ = tokio::process::Command::new("chroot")
            .arg("/host")
            .arg("journalctl")
            .arg("--vacuum-size=10M")
            .output()
            .await;

        cleared_sources.push("system");
    }

    (StatusCode::OK, Json(serde_json::json!({
        "message": format!("Logs limpos com sucesso para: {}", cleared_sources.join(", ")),
        "cleared": cleared_sources
    }))).into_response()
}

async fn fetch_orbit_logs(max_lines: usize) -> Vec<String> {
    let candidate_paths = ["data/orbit.log", "/app/data/orbit.log", "orbit.log"];
    for p in candidate_paths {
        let log_path = Path::new(p);
        if log_path.exists() {
            if let Ok(lines) = read_last_n_lines_from_file(log_path, max_lines) {
                if !lines.is_empty() {
                    return lines;
                }
            }
        }
    }

    for dir in ["data", "/app/data"] {
        if let Ok(entries) = std::fs::read_dir(dir) {
            let mut rotated: Vec<_> = entries.flatten()
                .filter(|e| e.file_name().to_string_lossy().starts_with("orbit.log"))
                .collect();
            rotated.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).unwrap_or(std::time::SystemTime::UNIX_EPOCH));
            if let Some(latest) = rotated.last() {
                if let Ok(lines) = read_last_n_lines_from_file(&latest.path(), max_lines) {
                    if !lines.is_empty() {
                        return lines;
                    }
                }
            }
        }
    }

    vec![
        format!("{} [INFO] Orbit Backend service is active.", chrono_timestamp()),
        format!("{} [INFO] Listening for events and system metrics.", chrono_timestamp())
    ]
}

async fn fetch_system_logs(max_lines: usize) -> Vec<String> {
    // 1. Try journalctl
    let output = tokio::process::Command::new("journalctl")
        .arg("-n")
        .arg(max_lines.to_string())
        .arg("--no-pager")
        .output()
        .await;

    if let Ok(out) = output {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            let lines: Vec<String> = text.lines().map(|s| s.to_string()).collect();
            if !lines.is_empty() {
                return lines;
            }
        }
    }

    // 2. Try chroot /host journalctl if running inside Docker container
    let chroot_output = tokio::process::Command::new("chroot")
        .arg("/host")
        .arg("journalctl")
        .arg("-n")
        .arg(max_lines.to_string())
        .arg("--no-pager")
        .output()
        .await;

    if let Ok(out) = chroot_output {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            let lines: Vec<String> = text.lines().map(|s| s.to_string()).collect();
            if !lines.is_empty() {
                return lines;
            }
        }
    }

    // 3. Try reading /host/var/log/syslog or /var/log/syslog
    for p in ["/host/var/log/syslog", "/var/log/syslog", "/host/var/log/messages", "/var/log/messages"] {
        let path = Path::new(p);
        if path.exists() {
            if let Ok(file) = File::open(path) {
                let reader = BufReader::new(file);
                let all_lines: Vec<String> = reader.lines().filter_map(Result::ok).collect();
                if !all_lines.is_empty() {
                    return if all_lines.len() > max_lines {
                        all_lines[all_lines.len() - max_lines..].to_vec()
                    } else {
                        all_lines
                    };
                }
            }
        }
    }

    // 4. Fallback to dmesg
    fetch_dmesg_logs(max_lines).await
}

async fn fetch_docker_logs(max_lines: usize) -> Vec<String> {
    // 1. Try journalctl -u docker
    let output = tokio::process::Command::new("journalctl")
        .arg("-u")
        .arg("docker")
        .arg("-n")
        .arg(max_lines.to_string())
        .arg("--no-pager")
        .output()
        .await;

    if let Ok(out) = output {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            let lines: Vec<String> = text.lines().map(|s| s.to_string()).collect();
            if !lines.is_empty() {
                return lines;
            }
        }
    }

    // 2. Try chroot /host journalctl -u docker
    let chroot_output = tokio::process::Command::new("chroot")
        .arg("/host")
        .arg("journalctl")
        .arg("-u")
        .arg("docker")
        .arg("-n")
        .arg(max_lines.to_string())
        .arg("--no-pager")
        .output()
        .await;

    if let Ok(out) = chroot_output {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            let lines: Vec<String> = text.lines().map(|s| s.to_string()).collect();
            if !lines.is_empty() {
                return lines;
            }
        }
    }

    vec![
        format!("{} [INFO] Docker daemon logs not found via systemd journal.", chrono_timestamp())
    ]
}

async fn fetch_dmesg_logs(max_lines: usize) -> Vec<String> {
    let output = tokio::process::Command::new("dmesg")
        .arg("-T")
        .output()
        .await;

    if let Ok(out) = output {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            let all_lines: Vec<String> = text.lines().map(|s| s.to_string()).collect();
            if !all_lines.is_empty() {
                return if all_lines.len() > max_lines {
                    all_lines[all_lines.len() - max_lines..].to_vec()
                } else {
                    all_lines
                };
            }
        }
    }

    vec![
        format!("{} [INFO] Kernel dmesg logs unavailable.", chrono_timestamp())
    ]
}

fn chrono_timestamp() -> String {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
    format!("[{}]", now)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filter_log_line_levels() {
        let err_line = "2026-08-23T14:00:00Z [ERROR] Failed to bind port 80";
        let warn_line = "2026-08-23T14:00:00Z [WARN] Disk space is above 85%";
        let info_line = "2026-08-23T14:00:00Z [INFO] Server started on port 5172";

        assert!(filter_log_line(err_line, "error", None));
        assert!(!filter_log_line(warn_line, "error", None));
        assert!(!filter_log_line(info_line, "error", None));

        assert!(filter_log_line(err_line, "warn", None));
        assert!(filter_log_line(warn_line, "warn", None));
        assert!(!filter_log_line(info_line, "warn", None));

        assert!(filter_log_line(err_line, "all", None));
        assert!(filter_log_line(warn_line, "all", None));
        assert!(filter_log_line(info_line, "all", None));
    }

    #[test]
    fn test_filter_log_line_query() {
        let line = "2026-08-23T14:00:00Z [INFO] Synchronizing App Store repository from CasaOS";
        assert!(filter_log_line(line, "all", Some("casaos")));
        assert!(filter_log_line(line, "all", Some("synchronizing")));
        assert!(!filter_log_line(line, "all", Some("qbittorrent")));
    }
}
