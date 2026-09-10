use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct PiHoleConfig {
    pub url: String,
    pub token: Option<String>,
    pub enabled: bool,
    #[serde(default)]
    pub version: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PiHoleConfigResponse {
    pub configured: bool,
    pub connected: bool,
    pub url: String,
    pub status: Option<String>,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SavePiHoleConfigRequest {
    pub url: String,
    pub token: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToggleBlockingRequest {
    pub enable: bool,
    pub duration_seconds: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DomainActionRequest {
    pub domain: String,
    pub list_type: String, // "white" or "black"
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PiHoleDomainItem {
    pub domain: String,
    pub list_type: String,
    pub enabled: bool,
}

pub struct CachedStats {
    pub data: serde_json::Value,
    pub timestamp: Instant,
}
