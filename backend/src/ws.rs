use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State},
    response::IntoResponse,
};
use sysinfo::{System, Disks, Networks, Components};
use std::time::Duration;
use serde::Serialize;
use tokio::time;
use crate::docker::AppState;
use futures::StreamExt;

#[derive(Serialize)]
pub struct DiskStat {
    pub name: String,
    pub mount_point: String,
    pub used: u64,
    pub total: u64,
}

#[derive(Serialize)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub disks: Vec<DiskStat>,
    pub network_tx: u64,
    pub network_rx: u64,
    pub temperature: f32,
    pub docker_cpu: f32,
    pub docker_memory: u64,
    pub docker_tx: u64,
    pub docker_rx: u64,
    pub orbit_cpu: f32,
    pub orbit_memory: u64,
}

pub async fn stats_handler(State(state): State<AppState>, ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

/// Returns private memory (RSS equivalent) for a PID via smaps_rollup (bytes).
fn read_private_memory(pid: u32) -> u64 {
    let smaps = std::fs::read_to_string(format!("/proc/{}/smaps_rollup", pid)).unwrap_or_default();
    smaps.lines().filter_map(|l| {
        if l.starts_with("Private_Dirty:") || l.starts_with("Private_Clean:") {
            l.split_whitespace().nth(1).and_then(|v| v.parse::<u64>().ok())
        } else {
            None
        }
    }).sum::<u64>() * 1024
}

/// Scans /proc once to find the vite/node frontend PID.
/// Called only every ~30 seconds, not every tick.
fn find_vite_pid() -> Option<u32> {
    let Ok(proc_entries) = std::fs::read_dir("/proc") else {
        return None;
    };
    for entry in proc_entries.flatten() {
        let fname = entry.file_name();
        let pid_str = fname.to_string_lossy();
        if !pid_str.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }
        let pid_num: u32 = match pid_str.parse() {
            Ok(p) => p,
            Err(_) => continue,
        };

        let exe_path = std::fs::read_link(format!("/proc/{}/exe", pid_num))
            .map(|p| p.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let cmdline = std::fs::read_to_string(format!("/proc/{}/cmdline", pid_num))
            .unwrap_or_default()
            .replace('\0', " ")
            .to_lowercase();

        let is_frontend = cmdline.contains("vite")
            && (exe_path.ends_with("/node") || exe_path.contains("/bin/node"));
        if is_frontend {
            return Some(pid_num);
        }
    }
    None
}

fn read_host_network_bytes() -> (u64, u64) {
    let paths = ["/proc/1/net/dev", "/proc/net/dev", "/host/proc/net/dev"];
    for p in paths {
        if let Ok(content) = std::fs::read_to_string(p) {
            let mut total_rx = 0u64;
            let mut total_tx = 0u64;
            for line in content.lines().skip(2) {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 10 {
                    let iface = parts[0].trim_end_matches(':');
                    if iface == "lo" {
                        continue;
                    }
                    if let (Ok(rx), Ok(tx)) = (parts[1].parse::<u64>(), parts[9].parse::<u64>()) {
                        total_rx += rx;
                        total_tx += tx;
                    }
                }
            }
            if total_rx > 0 || total_tx > 0 {
                return (total_rx, total_tx);
            }
        }
    }
    (0, 0)
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    let mut sys = System::new_all();
    let mut disks = Disks::new_with_refreshed_list();
    let mut networks = Networks::new_with_refreshed_list();
    let mut components = Components::new_with_refreshed_list();

    // OPT-B1: Own PID via std::process::id() — zero I/O, no /proc scan needed
    let backend_pid = std::process::id();

    // OPT-B1: Cache vite PID; refresh only every 10 ticks (~30s at 3s interval)
    let mut vite_pid: Option<u32> = find_vite_pid();
    let mut vite_pid_ticks: u32 = 0;
    const VITE_REFRESH_EVERY: u32 = 10;

    // OPT-B2: Interval increased from 2s → 3s (~33% less CPU/I/O pressure)
    let mut interval = time::interval(Duration::from_secs(3));

    let mut prev_cpu_stats = std::collections::HashMap::new();
    let mut prev_host_rx = 0u64;
    let mut prev_host_tx = 0u64;
    let mut prev_docker_rx = 0u64;
    let mut prev_docker_tx = 0u64;
    let mut last_tick_instant = std::time::Instant::now();
    let mut first_tick = true;

    loop {
        interval.tick().await;

        let now = std::time::Instant::now();
        let elapsed_secs = now.duration_since(last_tick_instant).as_secs_f64().max(0.1);
        last_tick_instant = now;

        sys.refresh_cpu_usage();
        sys.refresh_memory();
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        disks.refresh(true);
        networks.refresh(true);
        components.refresh(true);

        let sys_cpu = sys.global_cpu_usage();
        let sys_mem = sys.used_memory();
        let num_cores = sys.cpus().len() as f32;

        // OPT-B1: Refresh vite PID periodically (not every tick)
        vite_pid_ticks += 1;
        if vite_pid_ticks >= VITE_REFRESH_EVERY {
            vite_pid = find_vite_pid();
            vite_pid_ticks = 0;
        }

        // Orbit process metrics using cached PIDs — no /proc full scan
        let orbit_cpu = {
            let mut cpu = sys.process(sysinfo::Pid::from_u32(backend_pid))
                .map(|p| p.cpu_usage() / num_cores)
                .unwrap_or(0.0);
            if let Some(vpid) = vite_pid {
                cpu += sys.process(sysinfo::Pid::from_u32(vpid))
                    .map(|p| p.cpu_usage() / num_cores)
                    .unwrap_or(0.0);
            }
            cpu
        };

        let orbit_memory = {
            let mut mem = read_private_memory(backend_pid);
            if let Some(vpid) = vite_pid {
                mem += read_private_memory(vpid);
            }
            mem
        };

        let (mut host_raw_rx, mut host_raw_tx) = read_host_network_bytes();
        if host_raw_rx == 0 && host_raw_tx == 0 {
            for (iface, data) in &networks {
                if iface != "lo" {
                    host_raw_rx += data.total_received();
                    host_raw_tx += data.total_transmitted();
                }
            }
        }

        let host_rate_rx = if first_tick || host_raw_rx < prev_host_rx {
            0u64
        } else {
            ((host_raw_rx - prev_host_rx) as f64 / elapsed_secs) as u64
        };

        let host_rate_tx = if first_tick || host_raw_tx < prev_host_tx {
            0u64
        } else {
            ((host_raw_tx - prev_host_tx) as f64 / elapsed_secs) as u64
        };

        prev_host_rx = host_raw_rx;
        prev_host_tx = host_raw_tx;

        // Fetch running containers
        let mut options = bollard::query_parameters::ListContainersOptions::default();
        options.all = false;
        let containers = match state.docker.list_containers(Some(options)).await {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut total_cpu = 0.0f64;
        let mut total_mem = 0u64;
        let mut network_tx = 0u64;
        let mut network_rx = 0u64;

        // OPT-B3: FuturesUnordered streams results as they complete (better mem efficiency)
        use futures::stream::FuturesUnordered;
        let mut stat_futures: FuturesUnordered<_> = containers
            .into_iter()
            .filter_map(|c| c.id)
            .map(|id| {
                let docker = state.docker.clone();
                async move {
                    let stats_options = bollard::query_parameters::StatsOptions {
                        stream: false,
                        ..Default::default()
                    };
                    let mut stream = docker.stats(&id, Some(stats_options));
                    stream.next().await.and_then(|r| r.ok()).map(|s| (id, s))
                }
            })
            .collect();

        while let Some(Some((id, res))) = stat_futures.next().await {
            // CPU
            let mut cpu_percent = 0.0f64;
            let current_cpu = res.cpu_stats.clone();
            if let (Some(cpu), Some(precpu)) = (
                &current_cpu,
                prev_cpu_stats.get(&id).or(res.precpu_stats.as_ref()),
            ) {
                let cpu_delta = cpu.cpu_usage.as_ref().and_then(|u| u.total_usage).unwrap_or(0) as f64
                    - precpu.cpu_usage.as_ref().and_then(|u| u.total_usage).unwrap_or(0) as f64;
                let sys_delta = cpu.system_cpu_usage.unwrap_or(0) as f64
                    - precpu.system_cpu_usage.unwrap_or(0) as f64;
                if sys_delta > 0.0 && cpu_delta > 0.0 {
                    cpu_percent = (cpu_delta / sys_delta) * 100.0;
                }
            }
            if let Some(cpu) = current_cpu {
                prev_cpu_stats.insert(id, cpu);
            }
            total_cpu += cpu_percent;

            // Accurate Memory (subtracted cache/inactive_file)
            total_mem += crate::docker::calculate_memory_used(&res);

            // Network (cumulative bytes)
            if let Some(nets) = res.networks {
                for (_, net) in nets {
                    network_tx += net.tx_bytes.unwrap_or(0);
                    network_rx += net.rx_bytes.unwrap_or(0);
                }
            }
        }

        let docker_rate_rx = if first_tick || network_rx < prev_docker_rx {
            0u64
        } else {
            ((network_rx - prev_docker_rx) as f64 / elapsed_secs) as u64
        };

        let docker_rate_tx = if first_tick || network_tx < prev_docker_tx {
            0u64
        } else {
            ((network_tx - prev_docker_tx) as f64 / elapsed_secs) as u64
        };

        prev_docker_rx = network_rx;
        prev_docker_tx = network_tx;
        first_tick = false;

        // Disks (filter overlay, tmpfs, and internal container pseudo-mounts)
        let mut disk_stats = Vec::new();
        for disk in &disks {
            let name = disk.name().to_string_lossy().into_owned();
            let mount_point = disk.mount_point().to_string_lossy().into_owned();
            let fs_type = disk.file_system().to_string_lossy().into_owned();

            let name_lower = name.to_lowercase();
            let mount_lower = mount_point.to_lowercase();
            let fs_lower = fs_type.to_lowercase();

            if name_lower.contains("overlay")
                || mount_lower.contains("overlay")
                || fs_lower.contains("overlay")
                || fs_lower.contains("tmpfs")
                || fs_lower.contains("devtmpfs")
                || fs_lower.contains("squashfs")
                || mount_lower.starts_with("/etc/")
                || mount_lower.starts_with("/proc")
                || mount_lower.starts_with("/sys")
                || mount_lower.starts_with("/dev")
                || mount_lower == "/app/data"
            {
                continue;
            }

            disk_stats.push(DiskStat {
                name,
                mount_point,
                used: disk.total_space() - disk.available_space(),
                total: disk.total_space(),
            });
        }

        // Temperature (average across all sensors)
        let mut temperature = 0.0f32;
        let mut temp_count = 0u32;
        for component in &components {
            if let Some(t) = component.temperature() {
                temperature += t;
                temp_count += 1;
            }
        }
        if temp_count > 0 {
            temperature /= temp_count as f32;
        }

        let stats = SystemStats {
            cpu_usage: sys_cpu,
            memory_used: sys_mem,
            memory_total: sys.total_memory(),
            disks: disk_stats,
            network_tx: host_rate_tx,
            network_rx: host_rate_rx,
            temperature,
            docker_cpu: total_cpu as f32,
            docker_memory: total_mem,
            docker_tx: docker_rate_tx,
            docker_rx: docker_rate_rx,
            orbit_cpu,
            orbit_memory,
        };

        let msg = match serde_json::to_string(&stats) {
            Ok(j) => j,
            Err(_) => continue,
        };

        if socket.send(Message::Text(msg.into())).await.is_err() {
            tracing::debug!("Client disconnected from stats WebSocket");
            break;
        }
    }
}
