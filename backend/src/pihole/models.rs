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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PiHoleClientItem {
    pub ip: String,
    pub name: String,
    pub count: u64,
    pub percentage: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PiHoleUpstreamItem {
    pub destination: String,
    pub name: String,
    pub count: u64,
    pub percentage: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PiHoleRecentQueryItem {
    pub timestamp: u64,
    pub time: String,
    pub query_type: String,
    pub domain: String,
    pub client: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply: Option<String>,
}

pub struct CachedStats {
    pub data: serde_json::Value,
    pub timestamp: Instant,
}

