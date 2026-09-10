use base64::engine::general_purpose::{STANDARD, STANDARD_NO_PAD, URL_SAFE, URL_SAFE_NO_PAD};
use base64::Engine;
use bollard::query_parameters::ListContainersOptions;
use bollard::Docker;
use serde::Deserialize;
use std::path::Path;
use tracing::{debug, info};

use super::models::DetectedCloudflared;

#[derive(Deserialize)]
struct RawTunnelTokenPayload {
    #[serde(default)]
    a: Option<String>, // account_id
    #[serde(default)]
    t: Option<String>, // tunnel_id
}

/// Attempts to decode a Cloudflare TUNNEL_TOKEN base64 string into (account_id, tunnel_id).
/// Cloudflare encodes tunnel credentials as base64 JSON: {"a":"...","t":"...","s":"..."}
pub fn decode_tunnel_token(token: &str) -> Option<(String, String)> {
    let clean_token = token.trim();
    if clean_token.is_empty() {
        return None;
    }

    // Try multiple base64 variants (standard with/without pad, url-safe with/without pad)
    let decoded_bytes = STANDARD
        .decode(clean_token)
        .or_else(|_| STANDARD_NO_PAD.decode(clean_token))
        .or_else(|_| URL_SAFE.decode(clean_token))
        .or_else(|_| URL_SAFE_NO_PAD.decode(clean_token))
        .ok()?;

    let json_str = std::str::from_utf8(&decoded_bytes).ok()?;
    let payload: RawTunnelTokenPayload = serde_json::from_str(json_str).ok()?;

    if let (Some(account_id), Some(tunnel_id)) = (payload.a, payload.t) {
        if !account_id.trim().is_empty() && !tunnel_id.trim().is_empty() {
            return Some((account_id.trim().to_string(), tunnel_id.trim().to_string()));
        }
    }

    None
}

/// Detects a running or existing cloudflared container in the Docker daemon.
/// Extracts account_id and tunnel_id automatically from TUNNEL_TOKEN or mounts.
pub async fn detect_cloudflared(docker: &Docker) -> Option<DetectedCloudflared> {
    let mut options = ListContainersOptions::default();
    options.all = true;

    let containers = docker.list_containers(Some(options)).await.ok()?;

    for summary in containers {
        let image = summary.image.as_deref().unwrap_or("").to_lowercase();
        let names = summary.names.as_deref().unwrap_or(&[]);
        let is_cloudflared_image = image.contains("cloudflare/cloudflared") || image.contains("cloudflared");
        let is_cloudflared_name = names.iter().any(|n| n.to_lowercase().contains("cloudflared"));

        if !is_cloudflared_image && !is_cloudflared_name {
            continue;
        }

        let container_id = summary.id.as_deref().unwrap_or("").to_string();
        if container_id.is_empty() {
            continue;
        }

        let container_name = names
            .first()
            .map(|n| n.trim_start_matches('/').to_string())
            .unwrap_or_else(|| "cloudflared".to_string());

        let status = summary.state.map(|s| s.to_string()).unwrap_or_else(|| "unknown".to_string());

        let mut detected = DetectedCloudflared {
            container_id: container_id.clone(),
            container_name,
            account_id: None,
            tunnel_id: None,
            has_token: false,
            local_config_path: None,
            status,
        };

        // Inspect container for environment variables and volume mounts
        if let Ok(inspect) = docker.inspect_container(&container_id, None).await {
            // Check Environment variables
            if let Some(config) = inspect.config {
                if let Some(env_list) = config.env {
                    for env in env_list {
                        if let Some((key, val)) = env.split_once('=') {
                            match key.trim() {
                                "TUNNEL_TOKEN" => {
                                    detected.has_token = true;
                                    if let Some((acc, tun)) = decode_tunnel_token(val) {
                                        info!(
                                            "Found and decoded Cloudflare TUNNEL_TOKEN from container {}: account={}, tunnel={}",
                                            detected.container_name, acc, tun
                                        );
                                        detected.account_id = Some(acc);
                                        detected.tunnel_id = Some(tun);
                                    }
                                }
                                "TUNNEL_ID" => {
                                    if detected.tunnel_id.is_none() && !val.trim().is_empty() {
                                        detected.tunnel_id = Some(val.trim().to_string());
                                    }
                                }
                                "TUNNEL_ACCOUNT_TAG" | "CLOUDFLARE_ACCOUNT_ID" => {
                                    if detected.account_id.is_none() && !val.trim().is_empty() {
                                        detected.account_id = Some(val.trim().to_string());
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }

            // Check mounts for config.yml / config.yaml
            if let Some(mounts) = inspect.mounts {
                for mount in mounts {
                    let dest = mount.destination.as_deref().unwrap_or("");
                    let src = mount.source.as_deref().unwrap_or("");

                    if dest.ends_with("config.yml")
                        || dest.ends_with("config.yaml")
                        || src.ends_with("config.yml")
                        || src.ends_with("config.yaml")
                    {
                        let candidate_path = if Path::new(src).exists() {
                            src.to_string()
                        } else {
                            dest.to_string()
                        };
                        detected.local_config_path = Some(candidate_path);
                    }
                }
            }
        }

        return Some(detected);
    }

    debug!("No cloudflared container detected");
    None
}
