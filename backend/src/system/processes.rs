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

fn get_process_container_id(pid: u32) -> Option<String> {
    let cgroup_paths = [
        format!("/proc/{}/cgroup", pid),
        format!("/host/proc/{}/cgroup", pid),
    ];

    for path in &cgroup_paths {
        if let Ok(content) = std::fs::read_to_string(path) {
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
    }
    None
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

    let mut processes = Vec::new();
    let mut running_count = 0usize;
    let mut sleeping_count = 0usize;
    let mut zombie_count = 0usize;
    let mut host_count = 0usize;
    let mut container_count = 0usize;

    let mut max_cpu = 0.0f32;
    let mut top_cpu = None;
    let mut max_mem = 0u64;
    let mut top_mem = None;

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
            ProcessStatus::Run => {
                running_count += 1;
                "Running"
            }
            ProcessStatus::Sleep => {
                sleeping_count += 1;
                "Sleeping"
            }
            ProcessStatus::Idle => "Idle",
            ProcessStatus::Zombie => {
                zombie_count += 1;
                "Zombie"
            }
            ProcessStatus::Stop => "Stopped",
            _ => "Other",
        }.to_string();

        let disk_usage = proc_data.disk_usage();

        // Check container association
        let mut container_id = None;
        let mut container_name = None;
        if let Some(extracted_id) = get_process_container_id(pid_u32) {
            let prefix = if extracted_id.len() >= 12 { &extracted_id[..12] } else { &extracted_id };
            if let Some(cname) = container_id_to_name.get(&extracted_id).or_else(|| container_id_to_name.get(prefix)) {
                container_id = Some(prefix.to_string());
                container_name = Some(cname.clone());
            } else {
                for (k, v) in &container_id_to_name {
                    if extracted_id.starts_with(k) || k.starts_with(&extracted_id) {
                        container_id = Some(k[..12.min(k.len())].to_string());
                        container_name = Some(v.clone());
                        break;
                    }
                }
            }
        }

        if container_name.is_some() {
            container_count += 1;
        } else {
            host_count += 1;
        }

        if normalized_cpu > max_cpu {
            max_cpu = normalized_cpu;
            top_cpu = Some(TopProcessSummary {
                pid: pid_u32,
                name: name.clone(),
                value: normalized_cpu as f64,
                container_name: container_name.clone(),
            });
        }

        if memory_rss > max_mem {
            max_mem = memory_rss;
            top_mem = Some(TopProcessSummary {
                pid: pid_u32,
                name: name.clone(),
                value: memory_rss as f64,
                container_name: container_name.clone(),
            });
        }

        processes.push(ProcessInfo {
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

    // Default sort by CPU % descending
    processes.sort_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap_or(std::cmp::Ordering::Equal));

    let response = ProcessesResponse {
        total_processes: processes.len(),
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
        processes,
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
