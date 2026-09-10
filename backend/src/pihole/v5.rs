use reqwest::Client;
use serde_json::Value;
use super::models::PiHoleDomainItem;

pub struct V5Client;

impl V5Client {
    pub async fn get_summary(client: &Client, base_url: &str, token: Option<&str>) -> Result<Value, String> {
        let mut summary_url = format!("{}/admin/api.php?summaryRaw", base_url);
        let mut top_url = format!("{}/admin/api.php?topItems=10", base_url);
        if let Some(tok) = token.filter(|t| !t.is_empty()) {
            summary_url.push_str(&format!("&auth={}", tok));
            top_url.push_str(&format!("&auth={}", tok));
        }

        let (summary_res, top_res) = tokio::join!(
            client.get(&summary_url).send(),
            client.get(&top_url).send()
        );

        let mut stats: Value = match summary_res {
            Ok(r) if r.status().is_success() => r.json().await.unwrap_or(serde_json::json!({})),
            Ok(r) => return Err(format!("Pi-hole v5 summary returned status {}", r.status())),
            Err(e) => return Err(format!("Could not reach Pi-hole v5: {}", e)),
        };

        if let Ok(r) = top_res {
            if r.status().is_success() {
                if let Ok(top_data) = r.json::<Value>().await {
                    if let Some(obj) = stats.as_object_mut() {
                        if let Some(tq) = top_data.get("top_queries") {
                            obj.insert("top_queries".to_string(), tq.clone());
                        }
                        if let Some(ta) = top_data.get("top_ads") {
                            obj.insert("top_ads".to_string(), ta.clone());
                        }
                    }
                }
            }
        }

        Ok(stats)
    }

    pub async fn set_blocking(
        client: &Client,
        base_url: &str,
        token: Option<&str>,
        enable: bool,
        duration_seconds: Option<u64>,
    ) -> Result<String, String> {
        let mut action_url = if enable {
            format!("{}/admin/api.php?enable", base_url)
        } else if let Some(sec) = duration_seconds {
            format!("{}/admin/api.php?disable={}", base_url, sec)
        } else {
            format!("{}/admin/api.php?disable", base_url)
        };

        if let Some(tok) = token.filter(|t| !t.is_empty()) {
            action_url.push_str(&format!("&auth={}", tok));
        }

        let resp = match client.get(&action_url).send().await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to reach Pi-hole v5: {}", e)),
        };

        if !resp.status().is_success() {
            return Err(format!("Pi-hole v5 returned status {}", resp.status()));
        }

        let res_json: Value = resp.json().await.unwrap_or_default();
        let new_status = res_json
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or(if enable { "enabled" } else { "disabled" });

        Ok(new_status.to_string())
    }

    pub async fn list_domains(client: &Client, base_url: &str, token: Option<&str>) -> Result<Vec<PiHoleDomainItem>, String> {
        let mut white_url = format!("{}/admin/api.php?list=white", base_url);
        let mut black_url = format!("{}/admin/api.php?list=black", base_url);
        if let Some(tok) = token.filter(|t| !t.is_empty()) {
            white_url.push_str(&format!("&auth={}", tok));
            black_url.push_str(&format!("&auth={}", tok));
        }

        let (white_res, black_res) = tokio::join!(
            client.get(&white_url).send(),
            client.get(&black_url).send()
        );

        let mut items = Vec::new();

        if let Ok(resp) = white_res {
            if resp.status().is_success() {
                if let Ok(val) = resp.json::<Value>().await {
                    Self::extract_domains(&val, "white", &mut items);
                }
            }
        }

        if let Ok(resp) = black_res {
            if resp.status().is_success() {
                if let Ok(val) = resp.json::<Value>().await {
                    Self::extract_domains(&val, "black", &mut items);
                }
            }
        }

        Ok(items)
    }

    pub async fn add_domain(
        client: &Client,
        base_url: &str,
        token: Option<&str>,
        domain: &str,
        list_type: &str,
    ) -> Result<(), String> {
        let list = if list_type == "black" { "black" } else { "white" };
        let mut add_url = format!("{}/admin/api.php?list={}&add={}", base_url, list, domain);
        if let Some(tok) = token.filter(|t| !t.is_empty()) {
            add_url.push_str(&format!("&auth={}", tok));
        }

        let resp = match client.get(&add_url).send().await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to reach Pi-hole v5: {}", e)),
        };

        if !resp.status().is_success() {
            return Err(format!("Pi-hole v5 returned status {}", resp.status()));
        }

        Ok(())
    }

    pub async fn remove_domain(
        client: &Client,
        base_url: &str,
        token: Option<&str>,
        domain: &str,
        list_type: &str,
    ) -> Result<(), String> {
        let list = if list_type == "black" { "black" } else { "white" };
        let mut sub_url = format!("{}/admin/api.php?list={}&sub={}", base_url, list, domain);
        if let Some(tok) = token.filter(|t| !t.is_empty()) {
            sub_url.push_str(&format!("&auth={}", tok));
        }

        let resp = match client.get(&sub_url).send().await {
            Ok(r) => r,
            Err(e) => return Err(format!("Failed to reach Pi-hole v5: {}", e)),
        };

        if !resp.status().is_success() {
            return Err(format!("Pi-hole v5 returned status {}", resp.status()));
        }

        Ok(())
    }

    fn extract_domains(val: &Value, list_type: &str, items: &mut Vec<PiHoleDomainItem>) {
        if let Some(arr) = val.as_array() {
            for entry in arr {
                if let Some(s) = entry.as_str() {
                    items.push(PiHoleDomainItem {
                        domain: s.to_string(),
                        list_type: list_type.to_string(),
                        enabled: true,
                    });
                } else if let Some(sub_arr) = entry.as_array() {
                    if let Some(first) = sub_arr.first().and_then(|v| v.as_str()) {
                        items.push(PiHoleDomainItem {
                            domain: first.to_string(),
                            list_type: list_type.to_string(),
                            enabled: true,
                        });
                    }
                }
            }
        }
    }
}
