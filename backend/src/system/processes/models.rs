use serde::{Deserialize, Serialize};

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
    pub is_kernel_thread: bool,
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
    pub user_processes_count: usize,
    pub kernel_threads_count: usize,
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

#[derive(Deserialize)]
pub struct KillProcessPayload {
    pub signal: Option<String>,
}
