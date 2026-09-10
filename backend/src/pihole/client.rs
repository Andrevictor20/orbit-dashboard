use once_cell::sync::Lazy;
use reqwest::Client;
use serde_json::Value;
use std::sync::RwLock;
use std::time::Duration;
use super::models::{PiHoleConfig, PiHoleDomainItem};
use super::v5::V5Client;
use super::v6::V6Client;

pub static PIHOLE_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .unwrap_or_else(|_| Client::new())
});

static V6_SID_CACHE: Lazy<RwLock<Option<String>>> = Lazy::new(|| RwLock::new(None));

pub fn invalidate_sid() {
    if let Ok(mut guard) = V6_SID_CACHE.write() {
        *guard = None;
    }
}

pub struct PiHoleOrchestrator;

impl PiHoleOrchestrator {
    /// Attempts connection to Pi-hole, automatically discovering whether it is v6 or v5.
    /// Returns Ok((detected_version, current_status)) or Err(reason).
    pub async fn test_connection(url: &str, token: Option<&str>) -> Result<(String, String), String> {
        let tok = token.unwrap_or("");
        // 1. Try modern Pi-hole v6 REST API first
        match V6Client::auth_login(&PIHOLE_CLIENT, url, tok).await {
            Ok(sid) => {
                if let Ok(mut guard) = V6_SID_CACHE.write() {
                    *guard = Some(sid.clone());
                }
                let stats = V6Client::get_summary(&PIHOLE_CLIENT, url, &sid).await
                    .unwrap_or_default();
                let status = stats.get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("enabled")
                    .to_string();
                return Ok(("v6".to_string(), status));
            }
            Err(e) if e == "NOT_V6" => {
                // Fallthrough to v5
            }
            Err(e) => {
                // It is v6, but credentials or server rejected it
                return Err(e);
            }
        }

        // 2. Fallback to legacy Pi-hole v5 PHP API
        match V5Client::get_summary(&PIHOLE_CLIENT, url, token).await {
            Ok(stats) => {
                let status = stats.get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("enabled")
                    .to_string();
                Ok(("v5".to_string(), status))
            }
            Err(e) => Err(format!("Could not connect to Pi-hole (v6 and v5 failed): {}", e)),
        }
    }

    async fn get_valid_v6_sid(url: &str, token: Option<&str>) -> Result<String, String> {
        {
            if let Ok(guard) = V6_SID_CACHE.read() {
                if let Some(ref sid) = *guard {
                    return Ok(sid.clone());
                }
            }
        }

        let tok = token.unwrap_or("");
        let sid = V6Client::auth_login(&PIHOLE_CLIENT, url, tok).await?;
        if let Ok(mut guard) = V6_SID_CACHE.write() {
            *guard = Some(sid.clone());
        }
        Ok(sid)
    }

    pub async fn fetch_stats(cfg: &PiHoleConfig) -> Result<Value, String> {
        if cfg.version.as_deref() == Some("v5") {
            return V5Client::get_summary(&PIHOLE_CLIENT, &cfg.url, cfg.token.as_deref()).await;
        }

        // Try v6
        match Self::get_valid_v6_sid(&cfg.url, cfg.token.as_deref()).await {
            Ok(sid) => {
                match V6Client::get_summary(&PIHOLE_CLIENT, &cfg.url, &sid).await {
                    Ok(val) => Ok(val),
                    Err(e) if e == "UNAUTHORIZED" => {
                        invalidate_sid();
                        let new_sid = Self::get_valid_v6_sid(&cfg.url, cfg.token.as_deref()).await?;
                        V6Client::get_summary(&PIHOLE_CLIENT, &cfg.url, &new_sid).await
                    }
                    Err(e) if e == "NOT_V6" => {
                        V5Client::get_summary(&PIHOLE_CLIENT, &cfg.url, cfg.token.as_deref()).await
                    }
                    Err(e) => Err(e),
                }
            }
            Err(e) if e == "NOT_V6" => {
                V5Client::get_summary(&PIHOLE_CLIENT, &cfg.url, cfg.token.as_deref()).await
            }
            Err(e) => Err(e),
        }
    }

    pub async fn toggle_blocking(
        cfg: &PiHoleConfig,
        enable: bool,
        duration_seconds: Option<u64>,
    ) -> Result<String, String> {
        if cfg.version.as_deref() == Some("v5") {
            return V5Client::set_blocking(&PIHOLE_CLIENT, &cfg.url, cfg.token.as_deref(), enable, duration_seconds).await;
        }

        match Self::get_valid_v6_sid(&cfg.url, cfg.token.as_deref()).await {
            Ok(sid) => {
                match V6Client::set_blocking(&PIHOLE_CLIENT, &cfg.url, &sid, enable, duration_seconds).await {
                    Ok(st) => Ok(st),
                    Err(e) if e == "UNAUTHORIZED" => {
                        invalidate_sid();
                        let new_sid = Self::get_valid_v6_sid(&cfg.url, cfg.token.as_deref()).await?;
                        V6Client::set_blocking(&PIHOLE_CLIENT, &cfg.url, &new_sid, enable, duration_seconds).await
                    }
                    Err(e) if e == "NOT_V6" => {
                        V5Client::set_blocking(&PIHOLE_CLIENT, &cfg.url, cfg.token.as_deref(), enable, duration_seconds).await
                    }
                    Err(e) => Err(e),
                }
            }
            Err(e) if e == "NOT_V6" => {
                V5Client::set_blocking(&PIHOLE_CLIENT, &cfg.url, cfg.token.as_deref(), enable, duration_seconds).await
            }
            Err(e) => Err(e),
        }
    }

    pub async fn list_domains(cfg: &PiHoleConfig) -> Result<Vec<PiHoleDomainItem>, String> {
        if cfg.version.as_deref() == Some("v5") {
            return V5Client::list_domains(&PIHOLE_CLIENT, &cfg.url, cfg.token.as_deref()).await;
        }

        match Self::get_valid_v6_sid(&cfg.url, cfg.token.as_deref()).await {
            Ok(sid) => {
                match V6Client::list_domains(&PIHOLE_CLIENT, &cfg.url, &sid).await {
                    Ok(items) => Ok(items),
                    Err(e) if e == "UNAUTHORIZED" => {
                        invalidate_sid();
                        let new_sid = Self::get_valid_v6_sid(&cfg.url, cfg.token.as_deref()).await?;
                        V6Client::list_domains(&PIHOLE_CLIENT, &cfg.url, &new_sid).await
                    }
                    Err(e) if e == "NOT_V6" => {
                        V5Client::list_domains(&PIHOLE_CLIENT, &cfg.url, cfg.token.as_deref()).await
                    }
                    Err(e) => Err(e),
                }
            }
            Err(e) if e == "NOT_V6" => {
                V5Client::list_domains(&PIHOLE_CLIENT, &cfg.url, cfg.token.as_deref()).await
            }
            Err(e) => Err(e),
        }
    }

    pub async fn add_domain(cfg: &PiHoleConfig, domain: &str, list_type: &str) -> Result<(), String> {
        if cfg.version.as_deref() == Some("v5") {
            return V5Client::add_domain(&PIHOLE_CLIENT, &cfg.url, cfg.token.as_deref(), domain, list_type).await;
        }

        match Self::get_valid_v6_sid(&cfg.url, cfg.token.as_deref()).await {
            Ok(sid) => {
                match V6Client::add_domain(&PIHOLE_CLIENT, &cfg.url, &sid, domain, list_type).await {
                    Ok(()) => Ok(()),
                    Err(e) if e == "UNAUTHORIZED" => {
                        invalidate_sid();
                        let new_sid = Self::get_valid_v6_sid(&cfg.url, cfg.token.as_deref()).await?;
                        V6Client::add_domain(&PIHOLE_CLIENT, &cfg.url, &new_sid, domain, list_type).await
                    }
                    Err(e) if e == "NOT_V6" => {
                        V5Client::add_domain(&PIHOLE_CLIENT, &cfg.url, cfg.token.as_deref(), domain, list_type).await
                    }
                    Err(e) => Err(e),
                }
            }
            Err(e) if e == "NOT_V6" => {
                V5Client::add_domain(&PIHOLE_CLIENT, &cfg.url, cfg.token.as_deref(), domain, list_type).await
            }
            Err(e) => Err(e),
        }
    }

    pub async fn remove_domain(cfg: &PiHoleConfig, domain: &str, list_type: &str) -> Result<(), String> {
        if cfg.version.as_deref() == Some("v5") {
            return V5Client::remove_domain(&PIHOLE_CLIENT, &cfg.url, cfg.token.as_deref(), domain, list_type).await;
        }

        match Self::get_valid_v6_sid(&cfg.url, cfg.token.as_deref()).await {
            Ok(sid) => {
                match V6Client::delete_domain(&PIHOLE_CLIENT, &cfg.url, &sid, domain, list_type).await {
                    Ok(()) => Ok(()),
                    Err(e) if e == "UNAUTHORIZED" => {
                        invalidate_sid();
                        let new_sid = Self::get_valid_v6_sid(&cfg.url, cfg.token.as_deref()).await?;
                        V6Client::delete_domain(&PIHOLE_CLIENT, &cfg.url, &new_sid, domain, list_type).await
                    }
                    Err(e) if e == "NOT_V6" => {
                        V5Client::remove_domain(&PIHOLE_CLIENT, &cfg.url, cfg.token.as_deref(), domain, list_type).await
                    }
                    Err(e) => Err(e),
                }
            }
            Err(e) if e == "NOT_V6" => {
                V5Client::remove_domain(&PIHOLE_CLIENT, &cfg.url, cfg.token.as_deref(), domain, list_type).await
            }
            Err(e) => Err(e),
        }
    }
}
