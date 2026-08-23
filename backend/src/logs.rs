use axum::{
    extract::Query,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufRead, BufReader};
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

pub async fn clear_logs() -> impl IntoResponse {
    for p in ["data/orbit.log", "/app/data/orbit.log", "orbit.log"] {
        let path = Path::new(p);
        if path.exists() {
            let _ = std::fs::write(path, "");
        }
    }
    (StatusCode::OK, Json(serde_json::json!({ "message": "Orbit logs cleared successfully" }))).into_response()
}

async fn fetch_orbit_logs(max_lines: usize) -> Vec<String> {
    let candidate_paths = ["data/orbit.log", "/app/data/orbit.log", "orbit.log"];
    for p in candidate_paths {
        let log_path = Path::new(p);
        if log_path.exists() {
            if let Ok(file) = File::open(log_path) {
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
