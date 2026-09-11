use bollard::query_parameters::ListContainersOptions;
use bollard::Docker;
use once_cell::sync::Lazy;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tracing::{info, warn};

use super::models::{
    CloudflareConfig, IngressRule, SaveCloudflareConfigRequest, SyncLinksResponse,
};

static CLOUDFLARE_CONFIG_CACHE: Lazy<Arc<RwLock<Option<CloudflareConfig>>>> = Lazy::new(|| {
    let path = get_config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(config) = serde_json::from_str::<CloudflareConfig>(&data) {
            return Arc::new(RwLock::new(Some(config)));
        }
    }
    Arc::new(RwLock::new(None))
});

pub fn get_config_path() -> PathBuf {
    crate::system::data_migrator::get_active_data_dir().join("cloudflare.json")
}

pub fn get_config() -> Option<CloudflareConfig> {
    CLOUDFLARE_CONFIG_CACHE.read().ok().and_then(|guard| guard.clone())
}

pub fn save_config(new_config: Option<CloudflareConfig>) {
    let path = get_config_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Some(ref cfg) = new_config {
        if let Ok(json) = serde_json::to_string_pretty(cfg) {
            let _ = fs::write(path, json);
        }
    } else if path.exists() {
        let _ = fs::remove_file(path);
    }

    if let Ok(mut guard) = CLOUDFLARE_CONFIG_CACHE.write() {
        *guard = new_config;
    }
}

pub fn update_config(req: SaveCloudflareConfigRequest) -> CloudflareConfig {
    let mut current = get_config().unwrap_or_default();

    if let Some(token) = req.api_token {
        current.api_token = token.trim().to_string();
    }
    if let Some(account_id) = req.account_id {
        current.account_id = account_id.trim().to_string();
    }
    if let Some(tunnel_id) = req.tunnel_id {
        current.tunnel_id = tunnel_id.trim().to_string();
    }
    if let Some(auto_sync) = req.auto_sync_links {
        current.auto_sync_links = auto_sync;
    }
    if let Some(enabled) = req.enabled {
        current.enabled = enabled;
    }

    save_config(Some(current.clone()));
    current
}

pub fn mask_token(token: &str) -> String {
    if token.len() <= 8 {
        "••••••••".to_string()
    } else {
        format!("{}••••{}", &token[..4], &token[token.len() - 4..])
    }
}

// -----------------------------------------------------------------------------
// Remote Cloudflare API structs
// -----------------------------------------------------------------------------

#[derive(Deserialize)]
struct CfApiResponse<T> {
    success: bool,
    result: Option<T>,
    #[serde(default)]
    errors: Vec<CfApiError>,
}

#[derive(Deserialize, Debug)]
struct CfApiError {
    #[serde(default)]
    message: String,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct CfTunnelDetails {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    status: Option<String>,
}

#[derive(Deserialize)]
struct CfTunnelConfigResult {
    #[serde(default)]
    config: Option<CfTunnelInnerConfig>,
}

#[derive(Deserialize)]
struct CfTunnelInnerConfig {
    #[serde(default)]
    ingress: Vec<RawIngressRule>,
}

pub use super::ingress::{
    insert_or_update_ingress_rule, remove_ingress_rule, try_create_dns_cname,
    update_remote_ingress_config, OriginRequestConfig, RawIngressRule,
};

#[derive(Deserialize)]
struct LocalYamlConfig {
    #[serde(default)]
    tunnel: Option<String>,
    #[serde(default)]
    ingress: Vec<RawIngressRule>,
}

pub struct CloudflareClient {
    http: Client,
}

impl Default for CloudflareClient {
    fn default() -> Self {
        Self::new()
    }
}

impl CloudflareClient {
    pub fn new() -> Self {
        let http = Client::builder()
            .timeout(Duration::from_secs(8))
            .build()
            .unwrap_or_default();
        Self { http }
    }

    /// Fetches ingress rules and tunnel metadata from Cloudflare API v4
    pub async fn fetch_remote_config(
        &self,
        account_id: &str,
        tunnel_id: &str,
        api_token: &str,
    ) -> Result<(Option<String>, Vec<RawIngressRule>), String> {
        let mut headers = HeaderMap::new();
        let auth_val = format!("Bearer {}", api_token);
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&auth_val)
                .map_err(|e| format!("Invalid API token header: {}", e))?,
        );

        // 1. Fetch tunnel info (name, status)
        let info_url = format!(
            "https://api.cloudflare.com/client/v4/accounts/{}/cfd_tunnel/{}",
            account_id, tunnel_id
        );
        let tunnel_name = match self.http.get(&info_url).headers(headers.clone()).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(body) = resp.json::<CfApiResponse<CfTunnelDetails>>().await {
                    body.result.and_then(|r| r.name)
                } else {
                    None
                }
            }
            Ok(resp) => {
                warn!("Cloudflare API tunnel info returned status {}", resp.status());
                None
            }
            Err(e) => {
                warn!("Failed to query Cloudflare tunnel info: {}", e);
                None
            }
        };

        // 2. Fetch tunnel configuration (ingress rules)
        let config_url = format!(
            "https://api.cloudflare.com/client/v4/accounts/{}/cfd_tunnel/{}/configurations",
            account_id, tunnel_id
        );
        let resp = self
            .http
            .get(&config_url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Network error communicating with Cloudflare API: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().await.unwrap_or_default();
            if let Ok(err_body) = serde_json::from_str::<CfApiResponse<serde_json::Value>>(&err_text) {
                if !err_body.errors.is_empty() {
                    let msg = err_body
                        .errors
                        .into_iter()
                        .map(|e| e.message)
                        .collect::<Vec<_>>()
                        .join(", ");
                    return Err(format!("Cloudflare API: {}", msg));
                }
            }
            return Err(format!("Cloudflare API status {}: {}", status, err_text));
        }

        let body: CfApiResponse<CfTunnelConfigResult> = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse Cloudflare configuration response: {}", e))?;

        if !body.success {
            let msg = body
                .errors
                .into_iter()
                .map(|e| e.message)
                .collect::<Vec<_>>()
                .join(", ");
            return Err(format!("Cloudflare API error: {}", msg));
        }

        let rules = body
            .result
            .and_then(|r| r.config)
            .map(|c| c.ingress)
            .unwrap_or_default();

        Ok((tunnel_name, rules))
    }

    /// Parses ingress rules from a local config.yml file on disk
    pub fn parse_local_yaml(&self, file_path: &str) -> Result<(Option<String>, Vec<RawIngressRule>), String> {
        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("Could not read local config file '{}': {}", file_path, e))?;

        let parsed: LocalYamlConfig = serde_yaml::from_str(&content)
            .map_err(|e| format!("Failed to parse YAML file '{}': {}", file_path, e))?;

        Ok((parsed.tunnel, parsed.ingress))
    }

    /// Adds or updates an ingress rule on the remote Cloudflare Tunnel
    pub async fn add_route(
        &self,
        account_id: &str,
        tunnel_id: &str,
        api_token: &str,
        new_rule: RawIngressRule,
    ) -> Result<RawIngressRule, String> {
        let (_, existing_rules) = self.fetch_remote_config(account_id, tunnel_id, api_token).await?;
        let updated_rules = insert_or_update_ingress_rule(existing_rules, new_rule.clone());
        update_remote_ingress_config(&self.http, account_id, tunnel_id, api_token, updated_rules).await?;
        Ok(new_rule)
    }

    /// Deletes an ingress rule from the remote Cloudflare Tunnel
    pub async fn delete_route(
        &self,
        account_id: &str,
        tunnel_id: &str,
        api_token: &str,
        hostname: &str,
        path: Option<&str>,
    ) -> Result<(), String> {
        let (_, existing_rules) = self.fetch_remote_config(account_id, tunnel_id, api_token).await?;
        let updated_rules = remove_ingress_rule(existing_rules, hostname, path);
        update_remote_ingress_config(&self.http, account_id, tunnel_id, api_token, updated_rules).await?;
        Ok(())
    }
}

// -----------------------------------------------------------------------------
// Ingress Rule Container Matching Engine
// -----------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct ContainerSummaryInfo {
    pub id: String,
    pub name: String,
    pub ports: Vec<u16>,
}

impl ContainerSummaryInfo {
    pub fn new(id: impl Into<String>, name: impl Into<String>, ports: Vec<u16>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            ports,
        }
    }
}

pub fn match_ingress_with_containers(
    raw_rules: Vec<RawIngressRule>,
    containers: &[ContainerSummaryInfo],
) -> Vec<IngressRule> {
    let mut results = Vec::new();

    for raw in raw_rules {
        let hostname = match raw.hostname {
            Some(ref h) if !h.trim().is_empty() => h.trim().to_string(),
            _ => continue, // Ignore catch-all rules without hostname (e.g. http_status:404)
        };

        let service = raw.service.trim().to_string();
        let public_url = format!("https://{}", hostname);

        // Parse service target host and port (e.g. "http://jellyfin:8096" -> host="jellyfin", port=8096)
        let (service_host, service_port) = parse_service_target(&service);

        // Extract subdomain from hostname (e.g. "jellyfin.example.com" -> "jellyfin")
        let subdomain = hostname.split('.').next().unwrap_or("").to_lowercase();

        let mut matched_id = None;
        let mut matched_name = None;

        // Matching Pass 1: Service host exactly matches container name
        if let Some(ref sh) = service_host {
            let sh_lower = sh.to_lowercase();
            if let Some(c) = containers.iter().find(|c| c.name.to_lowercase() == sh_lower) {
                matched_id = Some(c.id.clone());
                matched_name = Some(c.name.clone());
            }
        }

        // Matching Pass 2: Service host contains container name or container name contains service host
        if matched_id.is_none() {
            if let Some(ref sh) = service_host {
                let sh_lower = sh.to_lowercase();
                if sh_lower != "localhost" && sh_lower != "127.0.0.1" && sh_lower != "host.docker.internal" {
                    if let Some(c) = containers.iter().find(|c| {
                        let cn = c.name.to_lowercase();
                        cn.contains(&sh_lower) || sh_lower.contains(&cn)
                    }) {
                        matched_id = Some(c.id.clone());
                        matched_name = Some(c.name.clone());
                    }
                }
            }
        }

        // Matching Pass 3: Port matching when service points to localhost / internal host
        if matched_id.is_none() {
            if let Some(port) = service_port {
                if let Some(c) = containers.iter().find(|c| c.ports.contains(&port)) {
                    matched_id = Some(c.id.clone());
                    matched_name = Some(c.name.clone());
                }
            }
        }

        // Matching Pass 4: Subdomain of hostname matches container name
        if matched_id.is_none() && !subdomain.is_empty() {
            if let Some(c) = containers.iter().find(|c| {
                let cn = c.name.to_lowercase();
                cn == subdomain || cn.contains(&subdomain) || subdomain.contains(&cn)
            }) {
                matched_id = Some(c.id.clone());
                matched_name = Some(c.name.clone());
            }
        }

        results.push(IngressRule {
            hostname,
            service,
            path: raw.path,
            public_url,
            matched_container_id: matched_id,
            matched_container_name: matched_name,
        });
    }

    results
}

/// Parses target host and port from service URI string
fn parse_service_target(service: &str) -> (Option<String>, Option<u16>) {
    let clean = service
        .strip_prefix("http://")
        .or_else(|| service.strip_prefix("https://"))
        .or_else(|| service.strip_prefix("tcp://"))
        .unwrap_or(service);

    let host_and_port = clean.split('/').next().unwrap_or("");
    if let Some((host, port_str)) = host_and_port.split_once(':') {
        let port = port_str.parse::<u16>().ok();
        (Some(host.trim().to_string()), port)
    } else if !host_and_port.trim().is_empty() {
        (Some(host_and_port.trim().to_string()), None)
    } else {
        (None, None)
    }
}

/// Gathers container summary info (id, clean name, ports) from Docker daemon
pub async fn fetch_docker_containers_for_matching(docker: &Docker) -> Vec<ContainerSummaryInfo> {
    let mut options = ListContainersOptions::default();
    options.all = true;

    let containers = docker.list_containers(Some(options)).await.unwrap_or_default();
    let mut results = Vec::new();

    for c in containers {
        let id = c.id.unwrap_or_default();
        if id.is_empty() {
            continue;
        }

        let name = c
            .names
            .and_then(|names| names.into_iter().next())
            .map(|n| n.trim_start_matches('/').to_string())
            .unwrap_or_else(|| id[..12.min(id.len())].to_string());

        let mut ports = Vec::new();
        if let Some(port_list) = c.ports {
            for p in port_list {
                ports.push(p.private_port);
                if let Some(pub_port) = p.public_port {
                    ports.push(pub_port);
                }
            }
        }

        results.push(ContainerSummaryInfo { id, name, ports });
    }

    results
}

/// Syncs matched ingress rules into Orbit's custom links
pub fn sync_ingress_rules_to_links(rules: &[IngressRule]) -> SyncLinksResponse {
    let mut links_to_update = HashMap::new();

    for rule in rules {
        if let Some(ref container_id) = rule.matched_container_id {
            links_to_update.insert(container_id.clone(), rule.public_url.clone());
        }
    }

    let synced_count = crate::links::update_links_batch(&links_to_update);
    info!(
        "Synced {} Cloudflare tunnel links to container custom_links.json",
        synced_count
    );

    SyncLinksResponse {
        synced_count,
        synced_links: links_to_update,
    }
}
