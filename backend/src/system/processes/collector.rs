use std::collections::HashMap;
use sysinfo::{ProcessStatus, System, Users};

use super::models::{ProcessInfo, ProcessesResponse, TopProcessSummary};
use super::proc_scan::{
    get_process_container_id_from_root, load_uid_to_username_map, scan_proc_directory,
};


pub async fn collect_processes_data(docker: &bollard::Docker) -> ProcessesResponse {
    let mut sys = System::new_with_specifics(
        sysinfo::RefreshKind::nothing()
            .with_cpu(sysinfo::CpuRefreshKind::everything())
            .with_memory(sysinfo::MemoryRefreshKind::everything()),
    );
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let total_memory = sys.total_memory();
    let num_cores = sys.cpus().len().max(1) as f32;

    // 1. Fetch running/all docker containers to build mapping table
    let mut container_id_to_name: HashMap<String, String> = HashMap::new();
    let mut options = bollard::query_parameters::ListContainersOptions::default();
    options.all = true;
    if let Ok(containers) = docker.list_containers(Some(options)).await {
        for c in containers {
            if let Some(id) = c.id {
                let clean_id = id.to_lowercase();
                let name = c
                    .names
                    .and_then(|names| names.into_iter().next())
                    .map(|n| n.trim_start_matches('/').to_string())
                    .unwrap_or_else(|| clean_id[..12.min(clean_id.len())].to_string());

                let prefix = if clean_id.len() >= 12 {
                    clean_id[..12].to_string()
                } else {
                    clean_id.clone()
                };
                container_id_to_name.insert(clean_id, name.clone());
                container_id_to_name.insert(prefix, name);
            }
        }
    }

    let uid_to_user = load_uid_to_username_map();

    // 2. Discover host processes: First check /host/proc (when in Docker with /host mounted), then /proc
    let mut processes = None;
    if std::path::Path::new("/host/proc/1").exists() {
        processes = scan_proc_directory(
            "/host/proc",
            total_memory,
            num_cores,
            &container_id_to_name,
            &uid_to_user,
        );
    }

    if processes.is_none() && std::path::Path::new("/proc/1").exists() {
        processes = scan_proc_directory(
            "/proc",
            total_memory,
            num_cores,
            &container_id_to_name,
            &uid_to_user,
        );
    }

    // 3. Fallback to sysinfo processes if direct proc scan wasn't used
    let mut proc_list = if let Some(p) = processes {
        p
    } else {
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        let users = Users::new_with_refreshed_list();
        let mut list = Vec::new();
        for (&pid_val, proc_data) in sys.processes() {
            let pid_u32 = pid_val.as_u32();
            let ppid = proc_data.parent().map(|p| p.as_u32());
            let name = proc_data.name().to_string_lossy().into_owned();
            let cmd = proc_data
                .cmd()
                .iter()
                .map(|s| s.to_string_lossy().into_owned())
                .collect::<Vec<_>>();
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
            }
            .to_string();

            let disk_usage = proc_data.disk_usage();

            // Check container association
            let mut container_id = None;
            let mut container_name = None;
            if let Some(extracted_id) = get_process_container_id_from_root("/proc", pid_u32) {
                let prefix = if extracted_id.len() >= 12 {
                    &extracted_id[..12]
                } else {
                    &extracted_id
                };
                if let Some(cname) = container_id_to_name
                    .get(&extracted_id)
                    .or_else(|| container_id_to_name.get(prefix))
                {
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
                is_kernel_thread: ppid == Some(2),
                container_id,
                container_name,
                start_time: proc_data.start_time(),
                disk_read_bytes: disk_usage.read_bytes,
                disk_written_bytes: disk_usage.written_bytes,
            });
        }
        list
    };

    let mut user_count = 0usize;
    let mut kthread_count = 0usize;
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
        if p.is_kernel_thread {
            kthread_count += 1;
        } else {
            user_count += 1;
        }

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
        b.cpu_usage
            .partial_cmp(&a.cpu_usage)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| b.memory_rss.cmp(&a.memory_rss))
    });

    ProcessesResponse {
        total_processes: proc_list.len(),
        user_processes_count: user_count,
        kernel_threads_count: kthread_count,
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
    }
}
