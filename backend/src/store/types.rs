use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct AppStoreItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub category: String,
    pub store: String,
    pub compose_file: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tagline: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub developer: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub architectures: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct StoreRepository {
    pub id: String,
    pub name: String,
    pub url: String,
    #[serde(default)]
    pub is_official: bool,
    #[serde(default)]
    pub enabled: bool,
}

#[derive(Deserialize, Clone, Debug)]
pub struct AddStoreRepositoryPayload {
    pub name: String,
    pub url: String,
}

#[derive(Serialize, Clone)]
pub struct InstallTask {
    pub id: String,
    pub status: String,       // "starting" | "pulling" | "installing" | "done" | "error" | "cancelled"
    pub progress: u8,         // 0-100
    pub logs: Vec<String>,    // linhas de output do docker compose
    pub error: Option<String>, // mensagem de erro se falhou
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct PortMapping {
    pub host: u16,
    pub container: u16,
    pub protocol: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct VolumeMapping {
    pub host: String,
    pub container: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct CustomInstallPayload {
    pub env: Option<HashMap<String, String>>,
    pub ports: Option<Vec<PortMapping>>,
    pub volumes: Option<Vec<VolumeMapping>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfigInspection {
    pub id: String,
    pub name: String,
    pub ports: Vec<PortMapping>,
    pub volumes: Vec<VolumeMapping>,
    pub env: HashMap<String, String>,
    pub raw_compose: String,
}
