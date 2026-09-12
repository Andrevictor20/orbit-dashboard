use once_cell::sync::Lazy;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest::Client;
use serde::Deserialize;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tracing::warn;

use super::models::{
    CloudflareConfig, SaveCloudflareConfigRequest,
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

#[derive(Deserialize, serde::Serialize)]
struct LocalYamlConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    tunnel: Option<String>,
    #[serde(default, rename = "credentials-file", skip_serializing_if = "Option::is_none")]
    credentials_file: Option<String>,
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
                    let lower = msg.to_lowercase();
                    if lower.contains("not authorized") || status.as_u16() == 403 || status.as_u16() == 401 {
                        return Err("Cloudflare API: Não autorizado (Not authorized). O seu API Token não possui permissão para ler ou modificar as configurações do túnel. Adicione a permissão 'Account > Cloudflare Tunnel > Edit' (e opcionalmente 'Zone > DNS > Edit') no painel da Cloudflare (dash.cloudflare.com/profile/api-tokens).".to_string());
                    }
                    return Err(format!("Cloudflare API: {}", msg));
                }
            }
            if status.as_u16() == 403 || status.as_u16() == 401 || err_text.to_lowercase().contains("not authorized") {
                return Err("Cloudflare API: Não autorizado (Not authorized). O seu API Token não possui permissão para ler ou modificar as configurações do túnel. Adicione a permissão 'Account > Cloudflare Tunnel > Edit' no painel da Cloudflare (dash.cloudflare.com/profile/api-tokens).".to_string());
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

    /// Adds or updates an ingress rule on a local config.yml file on disk
    pub fn add_route_local(&self, file_path: &str, new_rule: RawIngressRule) -> Result<RawIngressRule, String> {
        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("Could not read local config file '{}': {}", file_path, e))?;
        let mut parsed: LocalYamlConfig = serde_yaml::from_str(&content)
            .map_err(|e| format!("Failed to parse YAML file '{}': {}", file_path, e))?;
        parsed.ingress = insert_or_update_ingress_rule(parsed.ingress, new_rule.clone());
        let updated_yaml = serde_yaml::to_string(&parsed)
            .map_err(|e| format!("Failed to serialize updated YAML: {}", e))?;
        fs::write(file_path, updated_yaml)
            .map_err(|e| format!("Could not write to local config file '{}': {}", file_path, e))?;
        Ok(new_rule)
    }

    /// Deletes an ingress rule from a local config.yml file on disk
    pub fn delete_route_local(&self, file_path: &str, hostname: &str, path: Option<&str>) -> Result<(), String> {
        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("Could not read local config file '{}': {}", file_path, e))?;
        let mut parsed: LocalYamlConfig = serde_yaml::from_str(&content)
            .map_err(|e| format!("Failed to parse YAML file '{}': {}", file_path, e))?;
        parsed.ingress = remove_ingress_rule(parsed.ingress, hostname, path);
        let updated_yaml = serde_yaml::to_string(&parsed)
            .map_err(|e| format!("Failed to serialize updated YAML: {}", e))?;
        fs::write(file_path, updated_yaml)
            .map_err(|e| format!("Could not write to local config file '{}': {}", file_path, e))?;
        Ok(())
    }
}

// -----------------------------------------------------------------------------
// Ingress Rule Container Matching Engine (Extracted to matching.rs)
// -----------------------------------------------------------------------------

pub use super::matching::*;
