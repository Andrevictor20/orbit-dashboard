use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Query, State},
    response::IntoResponse,
};
use sysinfo::{System, Disks, Networks, Components};
use std::collections::VecDeque;
use std::time::Duration;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::RwLock;
use serde::{Serialize, Deserialize};
use tokio::time;
use tokio::sync::broadcast;
use once_cell::sync::Lazy;
use bollard::Docker;
use crate::docker::AppState;
use crate::system::alerts::{push_alert_if_needed, SystemAlert, get_current_timestamp};
use futures::StreamExt;

#[derive(Serialize, Deserialize, Clone)]
pub struct DiskStat {
    pub name: String,
    pub mount_point: String,
    pub used: u64,
    pub total: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SystemStats {
    #[serde(default)]
    pub timestamp: u64,
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

#[derive(Deserialize, Default)]
pub struct StatsHistoryQuery {
    pub limit: Option<usize>,
}

// Global Broadcaster, Ring Buffer History and Cache for O(1) CPU/RAM scaling across all clients/tabs
static STATS_TX: Lazy<broadcast::Sender<Arc<String>>> = Lazy::new(|| {
    let (tx, _) = broadcast::channel(32);
    tx
});
static LATEST_STATS: Lazy<RwLock<Option<Arc<String>>>> = Lazy::new(|| RwLock::new(None));
static STATS_HISTORY: Lazy<RwLock<VecDeque<SystemStats>>> = Lazy::new(|| RwLock::new(VecDeque::with_capacity(3600)));
static COLLECTOR_INITIALIZED: Lazy<AtomicBool> = Lazy::new(|| AtomicBool::new(false));

pub fn ensure_stats_collector(docker: Arc<Docker>) {
    if COLLECTOR_INITIALIZED.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_ok() {
        tokio::spawn(async move {
            run_singleton_stats_collector(docker).await;
        });
    }
}

pub async fn stats_handler(State(state): State<AppState>, ws: WebSocketUpgrade) -> impl IntoResponse {
    ensure_stats_collector(state.docker.clone());
    ws.on_upgrade(move |socket| handle_socket(socket))
}

pub async fn get_stats_history_handler(
    State(state): State<AppState>,
    Query(params): Query<StatsHistoryQuery>,
) -> impl IntoResponse {
    ensure_stats_collector(state.docker.clone());
    let limit = params.limit.unwrap_or(300).clamp(1, 3600);
    let history: Vec<SystemStats> = if let Ok(guard) = STATS_HISTORY.read() {
        let count = guard.len();
        if count <= limit {
            guard.iter().cloned().collect()
        } else {
            guard.iter().skip(count - limit).cloned().collect()
        }
    } else {
        Vec::new()
    };

    (axum::http::StatusCode::OK, axum::Json(history))
}

async fn handle_socket(mut socket: WebSocket) {
    let mut rx = STATS_TX.subscribe();

    // 1. Send immediate cached snapshot so UI renders instantly without waiting for next tick
    let initial_msg = LATEST_STATS.read().ok().and_then(|g| g.clone());
    if let Some(cached) = initial_msg {
        if socket.send(Message::Text(cached.as_str().into())).await.is_err() {
            return;
        }
    }

    // 2. Stream broadcasts with zero CPU overhead per connection
    while let Ok(msg) = rx.recv().await {
        if socket.send(Message::Text(msg.as_str().into())).await.is_err() {
            tracing::debug!("Client disconnected from stats WebSocket");
            break;
        }
    }
}

/// Returns private memory (RSS equivalent) for a PID via smaps_rollup or VmRSS (bytes).
fn read_private_memory(pid: u32) -> u64 {
    // 1. Try smaps_rollup (Private_Dirty + Private_Clean)
    let smaps = std::fs::read_to_string(format!("/proc/{}/smaps_rollup", pid)).unwrap_or_default();
    let val: u64 = smaps.lines().filter_map(|l| {
        if l.starts_with("Private_Dirty:") || l.starts_with("Private_Clean:") {
            l.split_whitespace().nth(1).and_then(|v| v.parse::<u64>().ok())
        } else {
            None
        }
    }).sum();
    if val > 0 {
        return val * 1024;
    }

    // 2. Fallback to /proc/{pid}/status VmRSS
    if let Ok(status) = std::fs::read_to_string(format!("/proc/{}/status", pid)) {
        for line in status.lines() {
            if line.starts_with("VmRSS:") {
                if let Some(kb) = line.split_whitespace().nth(1).and_then(|v| v.parse::<u64>().ok()) {
                    return kb * 1024;
                }
            }
        }
    }

    // 3. Fallback to sysinfo process memory
    0
}

/// Scans /proc to discover all PIDs associated with Orbit (Rust Backend, child worker processes, and Frontend dev/node/vite processes).
fn find_orbit_pids(backend_pid: u32) -> Vec<u32> {
    let mut pids = vec![backend_pid];
    let Ok(proc_entries) = std::fs::read_dir("/proc") else {
        return pids;
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
        if pid_num == backend_pid {
            continue;
        }

        // 1. Child of backend process (e.g. background runners, rclone, docker helpers)
        if let Ok(stat) = std::fs::read_to_string(format!("/proc/{}/stat", pid_num)) {
            let parts: Vec<&str> = stat.split_whitespace().collect();
            if let Some(ppid_str) = parts.get(3) {
                if let Ok(ppid) = ppid_str.parse::<u32>() {
                    if ppid == backend_pid {
                        pids.push(pid_num);
                        continue;
                    }
                }
            }
        }

        // 2. Frontend runtime / dev server (vite, node, npm, bun, esbuild, pnpm, yarn)
        let cmdline = std::fs::read_to_string(format!("/proc/{}/cmdline", pid_num))
            .unwrap_or_default()
            .replace('\0', " ")
            .to_lowercase();

        let is_frontend = cmdline.contains("vite")
            || cmdline.contains("orbit-dashboard")
            || (cmdline.contains("frontend") && (cmdline.contains("node") || cmdline.contains("npm") || cmdline.contains("dev")))
            || (cmdline.contains("esbuild") && cmdline.contains("orbit"));

        if is_frontend {
            pids.push(pid_num);
        }
    }
    pids.sort_unstable();
    pids.dedup();
    pids
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

async fn run_singleton_stats_collector(docker: Arc<Docker>) {
    let mut sys = System::new_all();
    let mut disks = Disks::new_with_refreshed_list();
    let mut networks = Networks::new_with_refreshed_list();
    let mut components = Components::new_with_refreshed_list();

    let backend_pid = std::process::id();
    let mut orbit_pids = find_orbit_pids(backend_pid);
    let mut orbit_pids_ticks: u32 = 0;
    const ORBIT_PIDS_REFRESH_EVERY: u32 = 10;

    let mut prev_cpu_stats = std::collections::HashMap::new();
    let mut prev_host_rx = 0u64;
    let mut prev_host_tx = 0u64;
    let mut prev_docker_rx = 0u64;
    let mut prev_docker_tx = 0u64;
    let mut cached_docker_cpu = 0.0f32;
    let mut cached_docker_mem = 0u64;
    let mut cached_docker_rate_rx = 0u64;
    let mut cached_docker_rate_tx = 0u64;
    let mut docker_poll_ticks = 0u32;
    let mut disk_poll_ticks = 0u32;
    let mut last_tick_instant = std::time::Instant::now();
    let mut first_tick = true;

    loop {
        // Adaptive sleep: 2s if active subscribers, 6s if idle (power/CPU conservation)
        let has_subscribers = STATS_TX.receiver_count() > 0;
        let sleep_duration = if has_subscribers { Duration::from_secs(2) } else { Duration::from_secs(6) };
        time::sleep(sleep_duration).await;

        let now = std::time::Instant::now();
        let elapsed_secs = now.duration_since(last_tick_instant).as_secs_f64().max(0.1);
        last_tick_instant = now;

        sys.refresh_cpu_usage();
        sys.refresh_memory();
        networks.refresh(true);
        components.refresh(true);

        disk_poll_ticks += 1;
        if disk_poll_ticks >= 8 || first_tick {
            disks.refresh(true);
            disk_poll_ticks = 0;
        }

        let sys_cpu = sys.global_cpu_usage();
        let sys_mem = sys.used_memory();
        let num_cores = sys.cpus().len() as f32;

        orbit_pids_ticks += 1;
        if orbit_pids_ticks >= ORBIT_PIDS_REFRESH_EVERY || first_tick {
            orbit_pids = find_orbit_pids(backend_pid);
            orbit_pids_ticks = 0;
            // Periodically reclaim unused arena memory back to the Linux OS
            crate::store::catalog::trim_memory();
        }

        // Targeted process refresh only for Orbit PIDs instead of all 350+ host processes
        let orbit_pids_sysinfo: Vec<sysinfo::Pid> = orbit_pids.iter().map(|&p| sysinfo::Pid::from_u32(p)).collect();
        sys.refresh_processes(sysinfo::ProcessesToUpdate::Some(&orbit_pids_sysinfo), true);

        let orbit_cpu: f32 = orbit_pids.iter()
            .filter_map(|&p| sys.process(sysinfo::Pid::from_u32(p)))
            .map(|proc| proc.cpu_usage() / num_cores)
            .sum();

        let orbit_memory: u64 = orbit_pids.iter()
            .map(|&p| read_private_memory(p))
            .sum();

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

        // Poll Docker container stats every 6 seconds (3 ticks) to minimize Docker socket overhead
        docker_poll_ticks += 1;
        if docker_poll_ticks >= 3 || first_tick {
            docker_poll_ticks = 0;

            let mut options = bollard::query_parameters::ListContainersOptions::default();
            options.all = false;
            if let Ok(containers) = docker.list_containers(Some(options)).await {
                let mut total_cpu = 0.0f64;
                let mut total_mem = 0u64;
                let mut network_tx = 0u64;
                let mut network_rx = 0u64;

                use futures::stream::FuturesUnordered;
                let mut stat_futures: FuturesUnordered<_> = containers
                    .into_iter()
                    .filter_map(|c| c.id)
                    .map(|id| {
                        let d = docker.clone();
                        async move {
                            let stats_options = bollard::query_parameters::StatsOptions {
                                stream: false,
                                ..Default::default()
                            };
                            let mut stream = d.stats(&id, Some(stats_options));
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

                    // Memory
                    total_mem += crate::docker::calculate_memory_used(&res);

                    // Network
                    if let Some(nets) = res.networks {
                        for (_, net) in nets {
                            network_tx += net.tx_bytes.unwrap_or(0);
                            network_rx += net.rx_bytes.unwrap_or(0);
                        }
                    }
                }

                cached_docker_cpu = total_cpu as f32;
                cached_docker_mem = total_mem;

                cached_docker_rate_rx = if first_tick || network_rx < prev_docker_rx {
                    0u64
                } else {
                    ((network_rx - prev_docker_rx) as f64 / (elapsed_secs * 3.0).max(0.1)) as u64
                };

                cached_docker_rate_tx = if first_tick || network_tx < prev_docker_tx {
                    0u64
                } else {
                    ((network_tx - prev_docker_tx) as f64 / (elapsed_secs * 3.0).max(0.1)) as u64
                };

                prev_docker_rx = network_rx;
                prev_docker_tx = network_tx;
            }
        }
        first_tick = false;

        // Disks
        let mut disk_stats_map: std::collections::HashMap<String, DiskStat> = std::collections::HashMap::new();
        for disk in &disks {
            let name = disk.name().to_string_lossy().into_owned();
            let raw_mount = disk.mount_point().to_string_lossy().into_owned();
            let fs_type = disk.file_system().to_string_lossy().into_owned();
            let total_space = disk.total_space();

            if !crate::files::is_valid_storage_disk(&name, &raw_mount, &fs_type, total_space) {
                continue;
            }

            let mount_point = if raw_mount == "/host" {
                "/".to_string()
            } else if raw_mount.starts_with("/host/") {
                raw_mount.replacen("/host", "", 1)
            } else {
                raw_mount
            };

            let group_key = if name.contains("nvme") {
                let parts: Vec<&str> = name.split('p').collect();
                parts.first().copied().unwrap_or(&name).to_string()
            } else if name.starts_with("/dev/sd") && name.len() >= 8 {
                name[..8].to_string()
            } else if name.starts_with("sd") && name.len() >= 3 {
                name[..3].to_string()
            } else {
                name.clone()
            };

            let available = disk.available_space();
            let used = total_space.saturating_sub(available);

            let stat = DiskStat {
                name,
                mount_point,
                used,
                total: total_space,
            };

            if let Some(existing) = disk_stats_map.get_mut(&group_key) {
                if stat.total > existing.total {
                    *existing = stat;
                }
            } else {
                disk_stats_map.insert(group_key, stat);
            }
        }

        let mut disk_stats: Vec<DiskStat> = disk_stats_map.into_values().collect();
        disk_stats.sort_by(|a, b| b.total.cmp(&a.total));

        // Temperature
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

        let now_millis = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        let stats = SystemStats {
            timestamp: now_millis,
            cpu_usage: sys_cpu,
            memory_used: sys_mem,
            memory_total: sys.total_memory(),
            disks: disk_stats,
            network_tx: host_rate_tx,
            network_rx: host_rate_rx,
            temperature,
            docker_cpu: cached_docker_cpu,
            docker_memory: cached_docker_mem,
            docker_tx: cached_docker_rate_tx,
            docker_rx: cached_docker_rate_rx,
            orbit_cpu,
            orbit_memory,
        };

        evaluate_and_push_alerts(&stats);

        if let Ok(mut hist) = STATS_HISTORY.write() {
            if hist.len() >= 3600 {
                hist.pop_front();
            }
            hist.push_back(stats.clone());
        }

        if let Ok(j) = serde_json::to_string(&stats) {
            let msg_arc = Arc::new(j);
            if let Ok(mut guard) = LATEST_STATS.write() {
                *guard = Some(msg_arc.clone());
            }
            let _ = STATS_TX.send(msg_arc);
        }
    }
}

pub fn evaluate_and_push_alerts(stats: &SystemStats) {
    if stats.cpu_usage > 90.0 {
        push_alert_if_needed(SystemAlert {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: get_current_timestamp(),
            level: "critical".to_string(),
            title: "Alto Consumo de CPU".to_string(),
            message: format!("O consumo de CPU do host atingiu {:.1}%.", stats.cpu_usage),
            source: "metrics".to_string(),
        });
    }

    let memory_percent = (stats.memory_used as f64 / stats.memory_total.max(1) as f64) * 100.0;
    if memory_percent > 90.0 {
        push_alert_if_needed(SystemAlert {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: get_current_timestamp(),
            level: "critical".to_string(),
            title: "Alto Consumo de RAM".to_string(),
            message: format!("O uso de memória RAM está em {:.1}%.", memory_percent),
            source: "metrics".to_string(),
        });
    }

    if stats.temperature > 80.0 {
        push_alert_if_needed(SystemAlert {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: get_current_timestamp(),
            level: "warning".to_string(),
            title: "Alta Temperatura".to_string(),
            message: format!("A temperatura do host atingiu {:.1}°C.", stats.temperature),
            source: "metrics".to_string(),
        });
    }

    for disk in &stats.disks {
        let disk_percent = (disk.used as f64 / disk.total.max(1) as f64) * 100.0;
        if disk_percent > 90.0 {
            push_alert_if_needed(SystemAlert {
                id: uuid::Uuid::new_v4().to_string(),
                timestamp: get_current_timestamp(),
                level: "warning".to_string(),
                title: "Disco Quase Cheio".to_string(),
                message: format!("O disco {} ({}) está com {:.1}% de uso.", disk.name, disk.mount_point, disk_percent),
                source: "metrics".to_string(),
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::system::alerts::{ALERTS_HISTORY, ALERTS_COOLDOWN, TEST_ALERT_LOCK};

    #[test]
    fn test_evaluate_and_push_alerts_critical_cpu() {
        let _guard = TEST_ALERT_LOCK.lock().unwrap();

        {
            let mut hist = ALERTS_HISTORY.write().unwrap();
            hist.clear();
        }
        {
            let mut cd = ALERTS_COOLDOWN.write().unwrap();
            cd.clear();
        }

        let mut stats = SystemStats {
            timestamp: 0,
            cpu_usage: 95.0, // Should trigger
            memory_used: 1000,
            memory_total: 2000,
            disks: vec![],
            network_tx: 0,
            network_rx: 0,
            temperature: 50.0,
            docker_cpu: 0.0,
            docker_memory: 0,
            docker_rx: 0,
            docker_tx: 0,
            orbit_cpu: 0.0,
            orbit_memory: 0,
        };

        evaluate_and_push_alerts(&stats);

        {
            let history = ALERTS_HISTORY.read().unwrap();
            assert_eq!(history.len(), 1);
            assert_eq!(history[0].title, "Alto Consumo de CPU");
            assert_eq!(history[0].level, "critical");
        }

        // Verify it doesn't trigger if below 90%
        {
            let mut hist = ALERTS_HISTORY.write().unwrap();
            hist.clear();
        }
        {
            let mut cd = ALERTS_COOLDOWN.write().unwrap();
            cd.clear();
        }
        stats.cpu_usage = 89.0;
        evaluate_and_push_alerts(&stats);
        {
            let history2 = ALERTS_HISTORY.read().unwrap();
            assert_eq!(history2.len(), 0);
        }
    }

    #[test]
    fn test_evaluate_and_push_alerts_ram_and_temp() {
        let _guard = TEST_ALERT_LOCK.lock().unwrap();

        {
            let mut hist = ALERTS_HISTORY.write().unwrap();
            hist.clear();
        }
        {
            let mut cd = ALERTS_COOLDOWN.write().unwrap();
            cd.clear();
        }

        let stats = SystemStats {
            timestamp: 0,
            cpu_usage: 50.0, 
            memory_used: 9500, // 95%
            memory_total: 10000,
            disks: vec![],
            network_tx: 0,
            network_rx: 0,
            temperature: 85.0, // Should trigger
            docker_cpu: 0.0,
            docker_memory: 0,
            docker_rx: 0,
            docker_tx: 0,
            orbit_cpu: 0.0,
            orbit_memory: 0,
        };

        evaluate_and_push_alerts(&stats);

        {
            let history = ALERTS_HISTORY.read().unwrap();
            assert_eq!(history.len(), 2);
            let titles: Vec<String> = history.iter().map(|a| a.title.clone()).collect();
            assert!(titles.contains(&"Alto Consumo de RAM".to_string()));
            assert!(titles.contains(&"Alta Temperatura".to_string()));
        }
    }
}
