use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppStoreItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub category: String,
    pub store: String,
    pub compose_file: String,
}

#[derive(Serialize, Clone)]
pub struct InstallTask {
    pub id: String,
    pub status: String,       // "starting" | "pulling" | "installing" | "done" | "error"
    pub progress: u8,         // 0-100
    pub logs: Vec<String>,    // linhas de output do docker compose
    pub error: Option<String>, // mensagem de erro se falhou
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct PortMapping {
    pub host: u16,
    pub container: u16,
    pub protocol: String,
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct VolumeMapping {
    pub host: String,
    pub container: String,
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct CustomInstallPayload {
    pub env: Option<HashMap<String, String>>,
    pub ports: Option<Vec<PortMapping>>,
    pub volumes: Option<Vec<VolumeMapping>>,
}
