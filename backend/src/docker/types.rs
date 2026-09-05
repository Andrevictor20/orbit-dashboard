use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize)]
pub struct PortInfo {
    pub ip: Option<String>,
    pub private_port: u16,
    pub public_port: Option<u16>,
    pub typ: String,
}

#[derive(Serialize)]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
    pub ports: Vec<PortInfo>,
    pub labels: HashMap<String, String>,
    pub size_rw: Option<i64>,
    pub size_root_fs: Option<i64>,
}

#[derive(Deserialize)]
pub struct UpdateEnvPayload {
    pub env: Vec<String>,
}

#[derive(Deserialize)]
pub struct UpdateVolumesPayload {
    pub volumes: Vec<String>,
}

#[derive(Serialize)]
pub struct ContainerSnapshot {
    pub id: String,
    pub cpu_percent: f64,
    pub memory_used: u64,
    pub memory_limit: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_rw: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_root_fs: Option<i64>,
}

#[derive(Serialize)]
pub struct ImageInfo {
    pub id: String,
    pub tags: Vec<String>,
    pub size: i64,
    pub in_use: bool,
    pub containers_count: usize,
}

#[derive(Serialize)]
pub struct NetworkInfo {
    pub id: String,
    pub name: String,
    pub driver: String,
    pub in_use: bool,
    pub containers_count: usize,
}

#[derive(Serialize)]
pub struct VolumeInfo {
    pub name: String,
    pub driver: String,
    pub mountpoint: String,
    pub in_use: bool,
    pub containers_count: usize,
    pub size: Option<i64>,
}

#[derive(Deserialize)]
pub struct DeleteContainerQuery {
    pub v: Option<bool>,
    pub image: Option<bool>,
    pub network: Option<bool>,
}
