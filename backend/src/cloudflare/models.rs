use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct CloudflareConfig {
    #[serde(default)]
    pub api_token: String,
    #[serde(default)]
    pub account_id: String,
    #[serde(default)]
    pub tunnel_id: String,
    #[serde(default = "default_true")]
    pub auto_sync_links: bool,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudflareStatusResponse {
    pub configured: bool,
    pub connected: bool,
    pub mode: String, // "remote" | "local" | "none"
    pub tunnel_name: Option<String>,
    pub tunnel_id: Option<String>,
    pub account_id: Option<String>,
    pub routes_count: usize,
    pub error: Option<String>,
    pub detected_container: Option<DetectedCloudflared>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct IngressRule {
    pub hostname: String,
    pub service: String,
    #[serde(default)]
    pub path: Option<String>,
    pub public_url: String,
    pub matched_container_id: Option<String>,
    pub matched_container_name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SaveCloudflareConfigRequest {
    pub api_token: Option<String>,
    pub account_id: Option<String>,
    pub tunnel_id: Option<String>,
    pub auto_sync_links: Option<bool>,
    pub enabled: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct DetectedCloudflared {
    pub container_id: String,
    pub container_name: String,
    pub account_id: Option<String>,
    pub tunnel_id: Option<String>,
    pub has_token: bool,
    pub local_config_path: Option<String>,
    pub status: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct SyncLinksResponse {
    pub synced_count: usize,
    pub synced_links: HashMap<String, String>, // container_id -> public_url
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CreateRouteRequest {
    pub hostname: String,
    pub service: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub no_tls_verify: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DeleteRouteRequest {
    pub hostname: String,
    #[serde(default)]
    pub path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CreateRouteResponse {
    pub success: bool,
    pub message: String,
    pub dns_created: bool,
    pub dns_message: Option<String>,
    pub route: IngressRule,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DeleteRouteResponse {
    pub success: bool,
    pub message: String,
}
