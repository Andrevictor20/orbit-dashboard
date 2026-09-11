use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct OriginRequestConfig {
    #[serde(rename = "noTLSVerify", default, skip_serializing_if = "Option::is_none")]
    pub no_tls_verify: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct RawIngressRule {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    pub service: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(rename = "originRequest", default, skip_serializing_if = "Option::is_none")]
    pub origin_request: Option<OriginRequestConfig>,
}

/// Pure helper to insert or update an ingress rule, maintaining the catch-all 404 at the end.
pub fn insert_or_update_ingress_rule(
    mut rules: Vec<RawIngressRule>,
    new_rule: RawIngressRule,
) -> Vec<RawIngressRule> {
    rules.retain(|r| {
        let same_hostname = r.hostname.as_deref() == new_rule.hostname.as_deref();
        let same_path = match (r.path.as_deref(), new_rule.path.as_deref()) {
            (Some(p1), Some(p2)) => p1 == p2,
            (None, None) | (Some(""), None) | (None, Some("")) => true,
            _ => false,
        };
        !(same_hostname && same_path)
    });

    // Find position of the first catch-all rule (hostname is None)
    if let Some(pos) = rules.iter().position(|r| r.hostname.is_none()) {
        rules.insert(pos, new_rule);
    } else {
        rules.push(new_rule);
        rules.push(RawIngressRule {
            hostname: None,
            service: "http_status:404".to_string(),
            path: None,
            origin_request: None,
        });
    }

    rules
}

/// Pure helper to remove an ingress rule by hostname (and optional path), ensuring catch-all remains.
pub fn remove_ingress_rule(
    mut rules: Vec<RawIngressRule>,
    hostname: &str,
    path: Option<&str>,
) -> Vec<RawIngressRule> {
    rules.retain(|r| {
        let same_hostname = r.hostname.as_deref() == Some(hostname);
        let same_path = match (r.path.as_deref(), path) {
            (Some(p1), Some(p2)) => p1 == p2,
            (None, None) | (Some(""), None) | (None, Some("")) => true,
            _ => false,
        };
        !(same_hostname && same_path)
    });

    if !rules.iter().any(|r| r.hostname.is_none()) {
        rules.push(RawIngressRule {
            hostname: None,
            service: "http_status:404".to_string(),
            path: None,
            origin_request: None,
        });
    }

    rules
}

#[derive(Serialize)]
struct CfTunnelUpdateConfigPayload {
    config: CfTunnelUpdateConfig,
}

#[derive(Serialize)]
struct CfTunnelUpdateConfig {
    ingress: Vec<RawIngressRule>,
}

#[derive(Deserialize)]
struct CfApiResponse<T> {
    #[serde(default)]
    result: Option<T>,
    #[serde(default)]
    errors: Vec<CfApiError>,
}

#[derive(Deserialize, Debug)]
struct CfApiError {
    #[serde(default)]
    message: String,
}

/// Updates remote Cloudflare tunnel ingress configuration via PUT /accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations
pub async fn update_remote_ingress_config(
    http: &Client,
    account_id: &str,
    tunnel_id: &str,
    api_token: &str,
    ingress: Vec<RawIngressRule>,
) -> Result<(), String> {
    let url = format!(
        "https://api.cloudflare.com/client/v4/accounts/{}/cfd_tunnel/{}/configurations",
        account_id, tunnel_id
    );

    let mut headers = HeaderMap::new();
    let auth_val = format!("Bearer {}", api_token);
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&auth_val)
            .map_err(|e| format!("Invalid API token header: {}", e))?,
    );

    let payload = CfTunnelUpdateConfigPayload {
        config: CfTunnelUpdateConfig { ingress },
    };

    let resp = http
        .put(&url)
        .headers(headers)
        .json(&payload)
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

    Ok(())
}

#[derive(Deserialize)]
struct CfZoneItem {
    id: String,
    name: String,
}

/// Attempts to automatically create a DNS CNAME record if the token has Zone DNS Edit permissions.
/// If permissions are lacking or zone is not found, returns Ok(None) or Ok(Some(msg)).
pub async fn try_create_dns_cname(
    http: &Client,
    tunnel_id: &str,
    api_token: &str,
    hostname: &str,
) -> Result<(bool, Option<String>), String> {
    let mut headers = HeaderMap::new();
    let auth_val = format!("Bearer {}", api_token);
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&auth_val)
            .map_err(|e| format!("Invalid API token header: {}", e))?,
    );

    // 1. List zones
    let zones_url = "https://api.cloudflare.com/client/v4/zones";
    let Ok(resp) = http.get(zones_url).headers(headers.clone()).send().await else {
        return Ok((false, Some("Não foi possível verificar zonas DNS da Cloudflare.".into())));
    };

    if !resp.status().is_success() {
        // Token doesn't have Zone Read permission - graceful fallback
        return Ok((false, None));
    }

    let Ok(body) = resp.json::<CfApiResponse<Vec<CfZoneItem>>>().await else {
        return Ok((false, None));
    };

    let Some(zones) = body.result else {
        return Ok((false, None));
    };

    // Find zone whose name matches end of hostname (e.g. hostname "app.meudominio.com" matches zone "meudominio.com")
    let matching_zone = zones.into_iter().find(|z| {
        hostname == z.name || hostname.ends_with(&format!(".{}", z.name))
    });

    let Some(zone) = matching_zone else {
        return Ok((false, Some(format!("Nenhuma Zona DNS correspondente a '{}' foi encontrada na sua conta.", hostname))));
    };

    // 2. Create CNAME DNS record
    let dns_url = format!("https://api.cloudflare.com/client/v4/zones/{}/dns_records", zone.id);
    let target = format!("{}.cfargotunnel.com", tunnel_id);
    let record_payload = serde_json::json!({
        "type": "CNAME",
        "name": hostname,
        "content": target,
        "proxied": true,
        "ttl": 1
    });

    let create_resp = match http.post(&dns_url).headers(headers).json(&record_payload).send().await {
        Ok(r) => r,
        Err(e) => return Ok((false, Some(format!("Erro ao criar registro DNS: {}", e)))),
    };

    if create_resp.status().is_success() {
        info!("Successfully created CNAME record in Cloudflare DNS for {}", hostname);
        Ok((true, Some(format!("Apontamento CNAME criado com sucesso na zona '{}'.", zone.name))))
    } else {
        let err_text = create_resp.text().await.unwrap_or_default();
        warn!("Could not create DNS CNAME record (may already exist or need Zone DNS permissions): {}", err_text);
        Ok((false, Some("Rota criada no túnel. Verifique se o apontamento CNAME ou Wildcard DNS já está configurado.".into())))
    }
}
