use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use once_cell::sync::Lazy;
use crate::state::AppState;
use super::types::ContainerSnapshot;

static HOST_MEM_TOTAL: Lazy<u64> = Lazy::new(|| {
    if let Ok(meminfo) = std::fs::read_to_string("/proc/meminfo") {
        for line in meminfo.lines() {
            if line.starts_with("MemTotal:") {
                if let Some(kb) = line.split_whitespace().nth(1).and_then(|s| s.parse::<u64>().ok()) {
                    return kb * 1024;
                }
            }
        }
    }
    0
});

pub fn calculate_cpu_percent(
    cpu_usage_total: f64,
    precpu_usage_total: f64,
    system_cpu_usage: f64,
    presystem_cpu_usage: f64,
    online_cpus: f64,
) -> f64 {
    let cpu_delta = cpu_usage_total - precpu_usage_total;
    let system_delta = system_cpu_usage - presystem_cpu_usage;
    
    if system_delta > 0.0 && cpu_delta > 0.0 {
        (cpu_delta / system_delta) * online_cpus * 100.0
    } else {
        0.0
    }
}

pub fn calculate_memory_used(stats: &bollard::models::ContainerStatsResponse) -> u64 {
    let Some(mem) = &stats.memory_stats else {
        return 0;
    };
    let usage = mem.usage.unwrap_or(0);

    if let Some(stats_map) = &mem.stats {
        // Official Docker CLI logic (calculateMemUsageUnixNoCache):
        // cgroup v1: "total_inactive_file"
        // cgroup v2: "inactive_file"
        let inactive = if let Some(&val) = stats_map.get("total_inactive_file") {
            val
        } else if let Some(&val) = stats_map.get("inactive_file") {
            val
        } else if let Some(&val) = stats_map.get("cache") {
            val
        } else {
            0
        };

        if usage > 0 {
            if inactive < usage && inactive > 0 {
                usage - inactive
            } else {
                usage
            }
        } else {
            // Fallback for environments where cgroup memory accounting does not populate mem.usage
            let anon = stats_map
                .get("anon")
                .or_else(|| stats_map.get("rss"))
                .or_else(|| stats_map.get("total_rss"))
                .or_else(|| stats_map.get("active_anon"))
                .or_else(|| stats_map.get("total_active_anon"))
                .copied()
                .unwrap_or(0);
            let active_file = stats_map
                .get("active_file")
                .or_else(|| stats_map.get("total_active_file"))
                .or_else(|| stats_map.get("file"))
                .or_else(|| stats_map.get("total_file"))
                .copied()
                .unwrap_or(0);
            anon + active_file
        }
    } else {
        usage
    }
}

pub async fn resolve_container_memory(
    docker: &bollard::Docker,
    id: &str,
    stats: &bollard::models::ContainerStatsResponse,
) -> (u64, u64) {
    let mut memory_used = calculate_memory_used(stats);
    let mut memory_limit = stats.memory_stats.as_ref().and_then(|m| m.limit).unwrap_or(0);

    // If Docker stats returned 0 memory (e.g. Raspberry Pi OS / ARM without cgroup_enable=memory,
    // or unprivileged LXC containers where memory controller is disabled), fallback to process inspection.
    if memory_used == 0 {
        // Strategy 1: Query Docker top with RSS column
        let top_opts = bollard::query_parameters::TopOptions {
            ps_args: "-o pid,rss,comm".to_string(),
        };
        if let Ok(top) = docker.top_processes(id, Some(top_opts)).await {
            if let (Some(titles), Some(procs)) = (top.titles, top.processes) {
                let rss_idx = titles.iter().position(|t| {
                    let s = t.trim().to_uppercase();
                    s == "RSS" || s == "RES"
                });
                if let Some(idx) = rss_idx {
                    let total_rss_kb: u64 = procs
                        .iter()
                        .filter_map(|p| p.get(idx).and_then(|val| val.trim().parse::<u64>().ok()))
                        .sum();
                    if total_rss_kb > 0 {
                        memory_used = total_rss_kb * 1024;
                    }
                }
            }
        }

        // Strategy 2: If top with custom ps_args failed, query standard top and check /proc/<pid>/statm
        if memory_used == 0 {
            if let Ok(top) = docker.top_processes(id, None::<bollard::query_parameters::TopOptions>).await {
                if let (Some(titles), Some(procs)) = (top.titles, top.processes) {
                    let pid_idx = titles.iter().position(|t| {
                        let s = t.trim().to_uppercase();
                        s == "PID"
                    });
                    if let Some(idx) = pid_idx {
                        let mut proc_total_bytes = 0u64;
                        for p in &procs {
                            if let Some(pid_str) = p.get(idx) {
                                if let Ok(pid) = pid_str.trim().parse::<u32>() {
                                    if let Ok(statm) = std::fs::read_to_string(format!("/proc/{}/statm", pid)) {
                                        if let Some(pages_str) = statm.split_whitespace().nth(1) {
                                            if let Ok(pages) = pages_str.parse::<u64>() {
                                                proc_total_bytes += pages * 4096;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        if proc_total_bytes > 0 {
                            memory_used = proc_total_bytes;
                        }
                    }
                }
            }
        }
    }

    // If memory limit is missing, 0, or absurdly large (i64::MAX used by Docker when unlimited)
    if memory_limit == 0 || memory_limit > 100 * 1024 * 1024 * 1024 * 1024 {
        let host_total = *HOST_MEM_TOTAL;
        if host_total > 0 {
            memory_limit = host_total;
        }
    }

    (memory_used, memory_limit)
}

pub async fn snapshot_stats(
    State(state): State<AppState>,
) -> impl IntoResponse {
    // Get all running containers
    let mut options = bollard::query_parameters::ListContainersOptions::default();
    options.all = false; // Only running
    
    let containers = match state.docker.list_containers(Some(options)).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to list").into_response(),
    };

    let cached_sizes = super::containers::get_cached_container_sizes();

    let futures = containers.into_iter().filter_map(|c| {
        let id = c.id?;
        let docker = state.docker.clone();
        let (size_rw, size_root_fs) = cached_sizes.get(&id)
            .or_else(|| cached_sizes.get(&id.chars().take(12).collect::<String>()))
            .map(|s| (s.size_rw, s.size_root_fs))
            .unwrap_or((c.size_rw, c.size_root_fs));

        Some(async move {
            let stats_options = bollard::query_parameters::StatsOptions {
                stream: false,
                ..Default::default()
            };
            let mut stream = docker.stats(&id, Some(stats_options));
            
            // Timeout after 4 seconds per container to avoid dropping stats on busy/low-spec hosts
            let stat_result = tokio::time::timeout(std::time::Duration::from_millis(4000), stream.next()).await;
            if let Ok(Some(Ok(stats))) = stat_result {
                let mut cpu_percent = 0.0;
                
                if let (Some(cpu), Some(precpu)) = (&stats.cpu_stats, &stats.precpu_stats) {
                    let cpu_usage_total = cpu.cpu_usage.as_ref().and_then(|u| u.total_usage).unwrap_or(0) as f64;
                    let precpu_usage_total = precpu.cpu_usage.as_ref().and_then(|u| u.total_usage).unwrap_or(0) as f64;
                    let system_cpu_usage = cpu.system_cpu_usage.unwrap_or(0) as f64;
                    let presystem_cpu_usage = precpu.system_cpu_usage.unwrap_or(0) as f64;
                    
                    let online_cpus = cpu.online_cpus.unwrap_or(
                        cpu.cpu_usage.as_ref().and_then(|u| u.percpu_usage.as_ref()).map(|v| v.len()).unwrap_or(1) as u32
                    ) as f64;

                    cpu_percent = calculate_cpu_percent(
                        cpu_usage_total,
                        precpu_usage_total,
                        system_cpu_usage,
                        presystem_cpu_usage,
                        online_cpus,
                    );
                }

                let (memory_used, memory_limit) = resolve_container_memory(&docker, &id, &stats).await;

                Some(ContainerSnapshot {
                    id: id.chars().take(12).collect(),
                    cpu_percent,
                    memory_used,
                    memory_limit,
                    size_rw,
                    size_root_fs,
                })
            } else {
                None
            }
        })
    });

    use futures::stream::{self, StreamExt};
    let stream = stream::iter(futures).buffer_unordered(4);
    let results: Vec<Option<ContainerSnapshot>> = stream.collect().await;
    let snapshots: Vec<ContainerSnapshot> = results.into_iter().flatten().collect();

    (StatusCode::OK, Json(snapshots)).into_response()
}
