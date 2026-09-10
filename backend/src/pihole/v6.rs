use reqwest::Client;
use serde_json::{json, Value};
use super::models::PiHoleDomainItem;

pub struct V6Client;

impl V6Client {
    /// Attempts login via Pi-hole v6 FTL REST API (`POST /api/auth`).
    /// Returns Ok(session_id) on success, or an error message.
    /// If endpoint returns 404, returns Err("NOT_V6") to signal fallback to v5.
    pub async fn auth_login(client: &Client, base_url: &str, password: &str) -> Result<String, String> {
        let auth_url = format!("{}/api/auth", base_url);
        let resp = match client.post(&auth_url)
            .json(&json!({ "password": password }))
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => return Err(format!("Could not reach Pi-hole v6 API: {}", e)),
        };

        if resp.status().as_u16() == 404 {
            return Err("NOT_V6".to_string());
        }

        let status = resp.status();
        let val: Value = resp.json().await.unwrap_or_default();

        if status.is_success() {
            if let Some(session) = val.get("session") {
                let is_valid = session.get("valid").and_then(|v| v.as_bool()).unwrap_or(false);
                if is_valid {
                    if let Some(sid) = session.get("sid").and_then(|v| v.as_str()) {
                        return Ok(sid.to_string());
                    }
                    // If no auth is required, empty sid might be returned
                    return Ok(String::new());
                }
                if let Some(msg) = session.get("message").and_then(|v| v.as_str()) {
                    return Err(format!("Pi-hole auth failed: {}", msg));
                }
            }
            return Err("Pi-hole auth response missing valid session".to_string());
        }

        if status.as_u16() == 401 || status.as_u16() == 400 {
            if let Some(session) = val.get("session") {
                if let Some(msg) = session.get("message").and_then(|v| v.as_str()) {
                    return Err(format!("Invalid credentials: {}", msg));
                }
            }
            return Err("Pi-hole v6 authentication failed. Check your password or App Password.".to_string());
        }

        Err(format!("Pi-hole v6 auth returned unexpected status {}", status))
    }

    /// Fetches normalized stats from Pi-hole v6 FTL REST API
    pub async fn get_summary(client: &Client, base_url: &str, sid: &str) -> Result<Value, String> {
        let summary_url = format!("{}/api/stats/summary", base_url);
        let blocking_url = format!("{}/api/dns/blocking", base_url);

        let mut req = client.get(&summary_url);
        if !sid.is_empty() {
            req = req.header("sid", sid).header("X-FTL-SID", sid);
        }

        let resp = match req.send().await {
            Ok(r) => r,
            Err(e) => return Err(format!("Could not reach Pi-hole stats: {}", e)),
        };

        if resp.status().as_u16() == 401 {
            return Err("UNAUTHORIZED".to_string());
        }

        if !resp.status().is_success() {
            return Err(format!("Pi-hole stats returned status {}", resp.status()));
        }

        let val: Value = resp.json().await.unwrap_or_default();

        // Check blocking status
        let mut blocking_req = client.get(&blocking_url);
        if !sid.is_empty() {
            blocking_req = blocking_req.header("sid", sid).header("X-FTL-SID", sid);
        }
        let blocking_status = match blocking_req.send().await {
            Ok(r) if r.status().is_success() => {
                let b_val: Value = r.json().await.unwrap_or_default();
                if let Some(s) = b_val.get("blocking").and_then(|v| v.as_str()) {
                    s.to_string()
                } else if let Some(b) = b_val.get("blocking").and_then(|v| v.as_bool()) {
                    if b { "enabled".to_string() } else { "disabled".to_string() }
                } else {
                    "enabled".to_string()
                }
            }
            _ => "enabled".to_string(),
        };

        let queries = val.get("queries").cloned().unwrap_or(json!({}));
        let gravity = val.get("gravity").cloned().unwrap_or(json!({}));
        let clients = val.get("clients").cloned().unwrap_or(json!({}));

        let total = queries.get("total").and_then(|v| v.as_u64()).unwrap_or(0);
        let blocked = queries.get("blocked").and_then(|v| v.as_u64()).unwrap_or(0);
        let percent = queries.get("percent_blocked").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let domains_blocked = gravity.get("domains_being_blocked").and_then(|v| v.as_u64()).unwrap_or(0);
        let active_clients = clients.get("active").and_then(|v| v.as_u64()).unwrap_or(0);

        Ok(json!({
            "dns_queries_today": total,
            "ads_blocked_today": blocked,
            "ads_percentage_today": percent,
            "domains_being_blocked": domains_blocked,
            "unique_clients": active_clients,
            "clients_ever_seen": clients.get("total").and_then(|v| v.as_u64()).unwrap_or(active_clients),
            "unique_domains": queries.get("unique_domains").and_then(|v| v.as_u64()).unwrap_or(0),
            "queries_forwarded": queries.get("forwarded").and_then(|v| v.as_u64()).unwrap_or(0),
            "queries_cached": queries.get("cached").and_then(|v| v.as_u64()).unwrap_or(0),
            "status": blocking_status,
            "top_queries": json!({}),
            "top_ads": json!({})
        }))
    }

    /// Sets blocking mode on Pi-hole v6 (`POST /api/dns/blocking`)
    pub async fn set_blocking(
        client: &Client,
        base_url: &str,
        sid: &str,
        enable: bool,
        duration_seconds: Option<u64>,
    ) -> Result<String, String> {
        let blocking_url = format!("{}/api/dns/blocking", base_url);
        let payload = if enable {
            json!({ "blocking": true })
        } else if let Some(sec) = duration_seconds {
            json!({ "blocking": false, "timer": sec })
        } else {
            json!({ "blocking": false })
        };

        let mut req = client.post(&blocking_url).json(&payload);
        if !sid.is_empty() {
            req = req.header("sid", sid).header("X-FTL-SID", sid);
        }

        let resp = match req.send().await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to reach Pi-hole blocking endpoint: {}", e)),
        };

        if resp.status().as_u16() == 401 {
            return Err("UNAUTHORIZED".to_string());
        }

        if !resp.status().is_success() {
            return Err(format!("Pi-hole blocking returned status {}", resp.status()));
        }

        let val: Value = resp.json().await.unwrap_or_default();
        let new_status = if let Some(s) = val.get("blocking").and_then(|v| v.as_str()) {
            s.to_string()
        } else if let Some(b) = val.get("blocking").and_then(|v| v.as_bool()) {
            if b { "enabled".to_string() } else { "disabled".to_string() }
        } else {
            if enable { "enabled".to_string() } else { "disabled".to_string() }
        };

        Ok(new_status)
    }

    /// Lists domains from Pi-hole v6 (`GET /api/domains`)
    pub async fn list_domains(client: &Client, base_url: &str, sid: &str) -> Result<Vec<PiHoleDomainItem>, String> {
        let domains_url = format!("{}/api/domains", base_url);
        let mut req = client.get(&domains_url);
        if !sid.is_empty() {
            req = req.header("sid", sid).header("X-FTL-SID", sid);
        }

        let resp = match req.send().await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to fetch Pi-hole domains: {}", e)),
        };

        if resp.status().as_u16() == 401 {
            return Err("UNAUTHORIZED".to_string());
        }

        if !resp.status().is_success() {
            return Err(format!("Pi-hole domains returned status {}", resp.status()));
        }

        let val: Value = resp.json().await.unwrap_or_default();
        let mut items = Vec::new();

        let entries = if let Some(arr) = val.get("domains").and_then(|v| v.as_array()) {
            arr
        } else if let Some(arr) = val.as_array() {
            arr
        } else {
            return Ok(items);
        };

        for item in entries {
            if let Some(domain) = item.get("domain").and_then(|v| v.as_str()) {
                let raw_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("allow");
                let list_type = if raw_type.eq_ignore_ascii_case("deny") || raw_type.eq_ignore_ascii_case("black") {
                    "black".to_string()
                } else {
                    "white".to_string()
                };
                let enabled = item.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);

                items.push(PiHoleDomainItem {
                    domain: domain.to_string(),
                    list_type,
                    enabled,
                });
            }
        }

        Ok(items)
    }

    /// Adds a domain to Pi-hole v6 (`POST /api/domains/{type}/exact`)
    pub async fn add_domain(
        client: &Client,
        base_url: &str,
        sid: &str,
        domain: &str,
        list_type: &str,
    ) -> Result<(), String> {
        let v6_type = if list_type == "black" { "deny" } else { "allow" };
        let url = format!("{}/api/domains/{}/exact", base_url, v6_type);
        let payload = json!({
            "domain": domain,
            "comment": "Added via Orbit Dashboard"
        });

        let mut req = client.post(&url).json(&payload);
        if !sid.is_empty() {
            req = req.header("sid", sid).header("X-FTL-SID", sid);
        }

        let resp = match req.send().await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to reach Pi-hole add domain: {}", e)),
        };

        if resp.status().as_u16() == 401 {
            return Err("UNAUTHORIZED".to_string());
        }

        if !resp.status().is_success() && resp.status().as_u16() != 201 {
            return Err(format!("Pi-hole add domain returned status {}", resp.status()));
        }

        Ok(())
    }

    /// Deletes a domain from Pi-hole v6 (`DELETE /api/domains/{type}/exact/{domain}`)
    pub async fn delete_domain(
        client: &Client,
        base_url: &str,
        sid: &str,
        domain: &str,
        list_type: &str,
    ) -> Result<(), String> {
        let v6_type = if list_type == "black" { "deny" } else { "allow" };
        let url = format!("{}/api/domains/{}/exact/{}", base_url, v6_type, domain);

        let mut req = client.delete(&url);
        if !sid.is_empty() {
            req = req.header("sid", sid).header("X-FTL-SID", sid);
        }

        let resp = match req.send().await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to reach Pi-hole delete domain: {}", e)),
        };

        if resp.status().as_u16() == 401 {
            return Err("UNAUTHORIZED".to_string());
        }

        if !resp.status().is_success() && resp.status().as_u16() != 204 && resp.status().as_u16() != 404 {
            return Err(format!("Pi-hole delete domain returned status {}", resp.status()));
        }

        Ok(())
    }
}
