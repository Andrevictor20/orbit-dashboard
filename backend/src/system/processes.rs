use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sysinfo::{System, Users, ProcessStatus};
use std::collections::HashMap;
use crate::state::AppState;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub ppid: Option<u32>,
    pub name: String,
    pub cmd: Vec<String>,
    pub exe: Option<String>,
    pub user: Option<String>,
    pub cpu_usage: f32,
    pub memory_rss: u64,
    pub memory_vms: u64,
    pub memory_percent: f32,
    pub status: String,
    pub container_id: Option<String>,
    pub container_name: Option<String>,
    pub start_time: u64,
    pub disk_read_bytes: u64,
    pub disk_written_bytes: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TopProcessSummary {
    pub pid: u32,
    pub name: String,
    pub value: f64,
    pub container_name: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProcessesResponse {
    pub processes: Vec<ProcessInfo>,
    pub total_processes: usize,
    pub running_processes: usize,
    pub sleeping_processes: usize,
    pub zombie_processes: usize,
    pub host_processes_count: usize,
    pub container_processes_count: usize,
    pub top_cpu_process: Option<TopProcessSummary>,
    pub top_memory_process: Option<TopProcessSummary>,
    pub total_cpu_usage: f32,
    pub total_memory_used: u64,
    pub total_memory_available: u64,
}

fn get_process_container_id_from_root(proc_root: &str, pid: u32) -> Option<String> {
    let cgroup_path = format!("{}/{}/cgroup", proc_root, pid);
    if let Ok(content) = std::fs::read_to_string(&cgroup_path) {
        for line in content.lines() {
            if line.contains("docker") || line.contains("containerd") || line.contains("libpod") {
                let parts = line.split(|c: char| c == '/' || c == '-' || c == '.' || c == ':');
                for part in parts {
                    let trimmed = part.trim();
                    if trimmed.len() >= 12 && trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
                        return Some(trimmed.to_lowercase());
                    }
                }
            }
        }
    }
    None
}

fn load_uid_to_username_map() -> HashMap<u32, String> {
    let mut map = HashMap::new();
    let passwd_paths = ["/host/etc/passwd", "/etc/passwd"];

    for path in &passwd_paths {
        if let Ok(content) = std::fs::read_to_string(path) {
            for line in content.lines() {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() >= 3 {
                    let user = parts[0].to_string();
                    if let Ok(uid) = parts[2].parse::<u32>() {
                        map.entry(uid).or_insert(user);
                    }
                }
            }
        }
    }
    map
}

fn scan_proc_directory(
    proc_root: &str,
    total_memory: u64,
    num_cores: f32,
    container_id_to_name: &HashMap<String, String>,
    uid_to_user: &HashMap<u32, String>,
) -> Option<Vec<ProcessInfo>> {
    let entries = std::fs::read_dir(proc_root).ok()?;
    let mut processes = Vec::new();

    for entry in entries.flatten() {
        let file_name = entry.file_name();
        let name_str = file_name.to_string_lossy();
        let Ok(pid) = name_str.parse::<u32>() else {
            continue;
        };

        let proc_dir = entry.path();
        let stat_path = proc_dir.join("stat");
        let status_path = proc_dir.join("status");
        let cmdline_path = proc_dir.join("cmdline");
        let io_path = proc_dir.join("io");

        let stat_content = std::fs::read_to_string(&stat_path).unwrap_or_default();
        if stat_content.is_empty() {
            continue;
        }

        // Parse /proc/[pid]/stat: "pid (comm) state ppid ..."
        let first_paren = stat_content.find('(');
        let last_paren = stat_content.rfind(')');
        
        let (raw_name, after_paren) = if let (Some(start), Some(end)) = (first_paren, last_paren) {
            let name = &stat_content[start + 1..end];
            let rest = &stat_content[end + 1..];
            (name.to_string(), rest)
        } else {
            (name_str.to_string(), stat_content.as_str())
        };

        let fields: Vec<&str> = after_paren.split_whitespace().collect();
        let state_char = fields.first().copied().unwrap_or("S");
        let ppid = fields.get(1).and_then(|s| s.parse::<u32>().ok());
        let utime = fields.get(11).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
        let stime = fields.get(12).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
        let start_time = fields.get(19).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
        let vsize = fields.get(20).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
        let rss_pages = fields.get(21).and_then(|s| s.parse::<i64>().ok()).unwrap_or(0).max(0) as u64;
        let mut memory_rss = rss_pages * 4096;
        let mut memory_vms = vsize;

        let status_content = std::fs::read_to_string(&status_path).unwrap_or_default();
        let mut uid = None;
        let mut detailed_name = raw_name.clone();

        for line in status_content.lines() {
            if let Some(rest) = line.strip_prefix("Name:\t") {
                if !rest.trim().is_empty() {
                    detailed_name = rest.trim().to_string();
                }
            } else if let Some(rest) = line.strip_prefix("Uid:\t") {
                let first_uid = rest.split_whitespace().next();
                if let Some(u_str) = first_uid {
                    uid = u_str.parse::<u32>().ok();
                }
            } else if let Some(rest) = line.strip_prefix("VmRSS:\t") {
                if let Some(val_kb) = rest.split_whitespace().next().and_then(|s| s.parse::<u64>().ok()) {
                    memory_rss = val_kb * 1024;
                }
            } else if let Some(rest) = line.strip_prefix("VmSize:\t") {
                if let Some(val_kb) = rest.split_whitespace().next().and_then(|s| s.parse::<u64>().ok()) {
                    memory_vms = val_kb * 1024;
                }
            }
        }

        // Cmdline
        let cmd = if let Ok(cmd_bytes) = std::fs::read(&cmdline_path) {
            cmd_bytes
                .split(|&b| b == 0)
                .filter(|slice| !slice.is_empty())
                .map(|slice| String::from_utf8_lossy(slice).into_owned())
                .collect::<Vec<_>>()
        } else {
            Vec::new()
        };

        // Fallback display name: use first arg of cmd if descriptive, else detailed_name
        let display_name = if !cmd.is_empty() && !cmd[0].trim().is_empty() {
            let p = std::path::Path::new(&cmd[0]);
            p.file_name()
                .map(|f| f.to_string_lossy().into_owned())
                .unwrap_or(detailed_name)
        } else {
            detailed_name
        };

        let user = uid.and_then(|u| uid_to_user.get(&u).cloned());

        let status_str = match state_char {
            "R" => "Running",
            "S" | "D" => "Sleeping",
            "Z" => "Zombie",
            "T" | "t" => "Stopped",
            "I" => "Idle",
            _ => "Sleeping",
        }.to_string();

        let memory_percent = if total_memory > 0 {
            (memory_rss as f64 / total_memory as f64 * 100.0) as f32
        } else {
            0.0
        };

        // IO
        let mut disk_read_bytes = 0u64;
        let mut disk_written_bytes = 0u64;
        if let Ok(io_content) = std::fs::read_to_string(&io_path) {
            for line in io_content.lines() {
                if let Some(rest) = line.strip_prefix("read_bytes: ") {
                    disk_read_bytes = rest.trim().parse::<u64>().unwrap_or(0);
                } else if let Some(rest) = line.strip_prefix("write_bytes: ") {
                    disk_written_bytes = rest.trim().parse::<u64>().unwrap_or(0);
                }
            }
        }

        // CPU approximation from clock ticks
        let total_ticks = (utime + stime) as f32;
        let cpu_usage = ((total_ticks / (num_cores * 100.0)).min(100.0) * 10.0).round() / 10.0;

        // Container mapping
        let mut container_id = None;
        let mut container_name = None;
        if let Some(extracted_id) = get_process_container_id_from_root(proc_root, pid) {
            let prefix = if extracted_id.len() >= 12 { &extracted_id[..12] } else { &extracted_id };
            if let Some(cname) = container_id_to_name.get(&extracted_id).or_else(|| container_id_to_name.get(prefix)) {
                container_id = Some(prefix.to_string());
                container_name = Some(cname.clone());
            } else {
                for (k, v) in container_id_to_name {
                    if extracted_id.starts_with(k) || k.starts_with(&extracted_id) {
                        container_id = Some(k[..12.min(k.len())].to_string());
                        container_name = Some(v.clone());
                        break;
                    }
                }
            }
        }

        processes.push(ProcessInfo {
            pid,
            ppid,
            name: display_name,
            cmd,
            exe: None,
            user,
            cpu_usage,
            memory_rss,
            memory_vms,
            memory_percent,
            status: status_str,
            container_id,
            container_name,
            start_time,
            disk_read_bytes,
            disk_written_bytes,
        });
    }

    if processes.is_empty() {
        None
    } else {
        Some(processes)
    }
}

pub async fn get_processes_handler(State(state): State<AppState>) -> impl IntoResponse {
    let mut sys = System::new_all();
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let users = Users::new_with_refreshed_list();
    let total_memory = sys.total_memory();
    let num_cores = sys.cpus().len().max(1) as f32;

    // 1. Fetch running/all docker containers to build mapping table
    let mut container_id_to_name: HashMap<String, String> = HashMap::new();
    let mut options = bollard::query_parameters::ListContainersOptions::default();
    options.all = true;
    if let Ok(containers) = state.docker.list_containers(Some(options)).await {
        for c in containers {
            if let Some(id) = c.id {
                let clean_id = id.to_lowercase();
                let name = c.names
                    .and_then(|names| names.into_iter().next())
                    .map(|n| n.trim_start_matches('/').to_string())
                    .unwrap_or_else(|| clean_id[..12.min(clean_id.len())].to_string());
                
                let prefix = if clean_id.len() >= 12 { clean_id[..12].to_string() } else { clean_id.clone() };
                container_id_to_name.insert(clean_id, name.clone());
                container_id_to_name.insert(prefix, name);
            }
        }
    }

    let uid_to_user = load_uid_to_username_map();

    // 2. Discover host processes: First check /host/proc (when in Docker with /host mounted), then /proc
    let mut processes = None;
    if std::path::Path::new("/host/proc/1").exists() {
        processes = scan_proc_directory("/host/proc", total_memory, num_cores, &container_id_to_name, &uid_to_user);
    }

    if processes.is_none() && std::path::Path::new("/proc/1").exists() {
        let scanned = scan_proc_directory("/proc", total_memory, num_cores, &container_id_to_name, &uid_to_user);
        if let Some(p) = scanned {
            if p.len() > sys.processes().len() {
                processes = Some(p);
            }
        }
    }

    // 3. Fallback to sysinfo processes if direct proc scan wasn't used or yielded fewer entries
    let mut proc_list = if let Some(p) = processes {
        p
    } else {
        let mut list = Vec::new();
        for (&pid_val, proc_data) in sys.processes() {
            let pid_u32 = pid_val.as_u32();
            let ppid = proc_data.parent().map(|p| p.as_u32());
            let name = proc_data.name().to_string_lossy().into_owned();
            let cmd = proc_data.cmd().iter().map(|s| s.to_string_lossy().into_owned()).collect::<Vec<_>>();
            let exe = proc_data.exe().map(|p| p.to_string_lossy().into_owned());

            let user = proc_data.user_id().and_then(|uid| {
                users.get_user_by_id(uid).map(|u| u.name().to_string())
            });

            let raw_cpu = proc_data.cpu_usage();
            let normalized_cpu = (raw_cpu / num_cores).min(100.0);
            let memory_rss = proc_data.memory();
            let memory_vms = proc_data.virtual_memory();
            let memory_percent = if total_memory > 0 {
                (memory_rss as f64 / total_memory as f64 * 100.0) as f32
            } else {
                0.0
            };

            let status_str = match proc_data.status() {
                ProcessStatus::Run => "Running",
                ProcessStatus::Sleep => "Sleeping",
                ProcessStatus::Idle => "Idle",
                ProcessStatus::Zombie => "Zombie",
                ProcessStatus::Stop => "Stopped",
                _ => "Other",
            }.to_string();

            let disk_usage = proc_data.disk_usage();

            // Check container association
            let mut container_id = None;
            let mut container_name = None;
            if let Some(extracted_id) = get_process_container_id_from_root("/proc", pid_u32) {
                let prefix = if extracted_id.len() >= 12 { &extracted_id[..12] } else { &extracted_id };
                if let Some(cname) = container_id_to_name.get(&extracted_id).or_else(|| container_id_to_name.get(prefix)) {
                    container_id = Some(prefix.to_string());
                    container_name = Some(cname.clone());
                }
            }

            list.push(ProcessInfo {
                pid: pid_u32,
                ppid,
                name,
                cmd,
                exe,
                user,
                cpu_usage: normalized_cpu,
                memory_rss,
                memory_vms,
                memory_percent,
                status: status_str,
                container_id,
                container_name,
                start_time: proc_data.start_time(),
                disk_read_bytes: disk_usage.read_bytes,
                disk_written_bytes: disk_usage.written_bytes,
            });
        }
        list
    };

    let mut running_count = 0usize;
    let mut sleeping_count = 0usize;
    let mut zombie_count = 0usize;
    let mut host_count = 0usize;
    let mut container_count = 0usize;

    let mut max_cpu = 0.0f32;
    let mut top_cpu = None;
    let mut max_mem = 0u64;
    let mut top_mem = None;

    for p in &proc_list {
        match p.status.as_str() {
            "Running" => running_count += 1,
            "Sleeping" | "Idle" => sleeping_count += 1,
            "Zombie" => zombie_count += 1,
            _ => sleeping_count += 1,
        }

        if p.container_name.is_some() {
            container_count += 1;
        } else {
            host_count += 1;
        }

        if p.cpu_usage > max_cpu {
            max_cpu = p.cpu_usage;
            top_cpu = Some(TopProcessSummary {
                pid: p.pid,
                name: p.name.clone(),
                value: p.cpu_usage as f64,
                container_name: p.container_name.clone(),
            });
        }

        if p.memory_rss > max_mem {
            max_mem = p.memory_rss;
            top_mem = Some(TopProcessSummary {
                pid: p.pid,
                name: p.name.clone(),
                value: p.memory_rss as f64,
                container_name: p.container_name.clone(),
            });
        }
    }

    // Default sort by CPU % descending, then by memory RSS descending
    proc_list.sort_by(|a, b| {
        b.cpu_usage.partial_cmp(&a.cpu_usage)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| b.memory_rss.cmp(&a.memory_rss))
    });

    let response = ProcessesResponse {
        total_processes: proc_list.len(),
        running_processes: running_count,
        sleeping_processes: sleeping_count,
        zombie_processes: zombie_count,
        host_processes_count: host_count,
        container_processes_count: container_count,
        top_cpu_process: top_cpu,
        top_memory_process: top_mem,
        total_cpu_usage: sys.global_cpu_usage(),
        total_memory_used: sys.used_memory(),
        total_memory_available: total_memory,
        processes: proc_list,
    };

    (StatusCode::OK, Json(response)).into_response()
}

#[derive(Deserialize)]
pub struct KillProcessPayload {
    pub signal: Option<String>,
}

pub async fn kill_process_handler(
    Path(pid): Path<u32>,
    Json(payload): Json<Option<KillProcessPayload>>,
) -> impl IntoResponse {
    let sig_str = payload
        .and_then(|p| p.signal)
        .unwrap_or_else(|| "SIGTERM".to_string())
        .to_uppercase();

    let signal_num = match sig_str.as_str() {
        "SIGKILL" | "9" => libc::SIGKILL,
        "SIGINT" | "2" => libc::SIGINT,
        "SIGHUP" | "1" => libc::SIGHUP,
        _ => libc::SIGTERM,
    };

    if pid <= 1 {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "Não é permitido finalizar processos do sistema raiz (PID <= 1)."
        }))).into_response();
    }

    let res = unsafe { libc::kill(pid as libc::pid_t, signal_num) };
    if res == 0 {
        (StatusCode::OK, Json(serde_json::json!({
            "message": format!("Sinal {} enviado com sucesso ao processo {}", sig_str, pid),
            "pid": pid,
            "success": true
        }))).into_response()
    } else {
        let err = std::io::Error::last_os_error();
        (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "error": format!("Falha ao enviar sinal {} ao processo {}: {}", sig_str, pid, err),
            "pid": pid,
            "success": false
        }))).into_response()
    }
}
