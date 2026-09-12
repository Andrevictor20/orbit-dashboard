use std::collections::HashMap;
use bollard::query_parameters::ListContainersOptions;
use bollard::Docker;
use tracing::info;

use super::ingress::RawIngressRule;
use super::models::{IngressRule, SyncLinksResponse};

#[derive(Clone, Debug)]
pub struct ContainerSummaryInfo {
    pub id: String,
    pub name: String,
    pub ports: Vec<u16>,
    pub service_name: Option<String>,
    pub project_name: Option<String>,
    pub image_name: Option<String>,
}

impl ContainerSummaryInfo {
    pub fn new(id: impl Into<String>, name: impl Into<String>, ports: Vec<u16>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            ports,
            service_name: None,
            project_name: None,
            image_name: None,
        }
    }

    pub fn with_service_name(mut self, service_name: Option<String>) -> Self {
        self.service_name = service_name;
        self
    }

    pub fn with_project_name(mut self, project_name: Option<String>) -> Self {
        self.project_name = project_name;
        self
    }

    pub fn with_image_name(mut self, image_name: Option<String>) -> Self {
        self.image_name = image_name;
        self
    }
}

pub fn is_ip_address(host: &str) -> bool {
    host.parse::<std::net::IpAddr>().is_ok()
}

pub fn is_loopback_or_host(host: &str) -> bool {
    host.eq_ignore_ascii_case("localhost")
        || host == "127.0.0.1"
        || host == "::1"
        || host.eq_ignore_ascii_case("host.docker.internal")
        || host == "0.0.0.0"
}

/// Strips common community wrapper prefixes from container names
pub fn strip_known_prefixes(name: &str) -> &str {
    let mut s = name;
    let prefixes = [
        "linuxserver-", "linuxserver_",
        "big-bear-", "big_bear_",
        "docker-", "docker_",
        "site-", "site_",
        "app-", "app_",
    ];
    for p in prefixes {
        if s.starts_with(p) {
            s = &s[p.len()..];
            break;
        }
    }
    s
}

/// Strips common role, replica, or framework suffixes
pub fn strip_known_suffixes(name: &str) -> &str {
    let mut s = name;
    let suffixes = [
        "-app-1", "_app_1", "-app_1", "_app-1",
        "-app", "_app",
        "-1", "_1", "-2", "_2",
        "-frontend", "_frontend",
        "-backend", "_backend",
        "-server", "_server",
        "-dashboard", "_dashboard",
        "-harness", "_harness",
        "-tutorial", "_tutorial",
        "-ui", "_ui",
        "-web", "_web",
    ];
    for suf in suffixes {
        if s.ends_with(suf) {
            s = &s[..s.len() - suf.len()];
            break;
        }
    }
    s
}

/// Normalizes container name to its core application identity
pub fn clean_app_name(name: &str) -> String {
    let lower = name.trim_start_matches('/').to_lowercase();
    let without_prefix = strip_known_prefixes(&lower);
    let without_suffix = strip_known_suffixes(without_prefix);
    without_suffix.to_string()
}

/// Returns true for generic subdomains that should never trigger auto-matching
pub fn is_generic_subdomain(sub: &str) -> bool {
    matches!(
        sub,
        "cloud" | "local" | "lan" | "tunnel" | "api" | "app" | "web" | "dev" | "test" | "internal" | "hub"
    )
}

/// Checks if two names have meaningful non-generic token overlap (e.g. "pdf-lan" and "stirling-pdf" share "pdf")
pub fn has_meaningful_token_overlap(a: &str, b: &str) -> bool {
    let lower_a = a.trim_start_matches('/').to_lowercase();
    let lower_b = b.trim_start_matches('/').to_lowercase();
    let tokens_a: Vec<&str> = lower_a
        .split(['-', '_'])
        .filter(|t| t.len() >= 3 && !is_generic_subdomain(t))
        .collect();
    let tokens_b: Vec<&str> = lower_b
        .split(['-', '_'])
        .filter(|t| t.len() >= 3 && !is_generic_subdomain(t))
        .collect();

    tokens_a.iter().any(|ta| tokens_b.contains(ta))
}

/// Checks if an IP is private/local/loopback and NOT an external router gateway (.1)
pub fn is_targetable_private_or_local_ip(ip_str: &str) -> bool {
    if let Ok(ip) = ip_str.parse::<std::net::IpAddr>() {
        match ip {
            std::net::IpAddr::V4(v4) => {
                if v4.is_loopback() {
                    return true;
                }
                let oct = v4.octets();
                // Exclude router gateway default addresses ending in .1
                if oct[3] == 1 {
                    return false;
                }
                // RFC 1918 private ranges & Docker bridge
                oct[0] == 10 
                    || (oct[0] == 172 && (16..=31).contains(&oct[1]))
                    || (oct[0] == 192 && oct[1] == 168)
            }
            std::net::IpAddr::V6(v6) => v6.is_loopback(),
        }
    } else {
        false
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

        let is_ip = service_host.as_deref().map(is_ip_address).unwrap_or(false);
        let is_loopback = service_host.as_deref().map(is_loopback_or_host).unwrap_or(false);

        // Matching Pass 1: Exact container name, exact container ID, exact Compose service, or exact Compose project
        if let Some(ref sh) = service_host {
            let sh_lower = sh.to_lowercase();
            if !is_ip && !is_loopback {
                if let Some(c) = containers.iter().find(|c| {
                    let cn = c.name.to_lowercase();
                    cn == sh_lower 
                        || c.id == *sh 
                        || (sh.len() >= 12 && c.id.starts_with(sh))
                        || c.service_name.as_ref().map(|s| s.to_lowercase() == sh_lower).unwrap_or(false)
                        || c.project_name.as_ref().map(|p| p.to_lowercase() == sh_lower).unwrap_or(false)
                }) {
                    matched_id = Some(c.id.clone());
                    matched_name = Some(c.name.clone());
                }
            }
        }

        // Matching Pass 2: Cleaned container name (without community wrapper prefixes or replica suffixes)
        if matched_id.is_none() && !is_ip && !is_loopback {
            if let Some(ref sh) = service_host {
                let sh_lower = sh.to_lowercase();
                let clean_sh = clean_app_name(&sh_lower);
                if clean_sh.len() >= 3 {
                    if let Some(c) = containers.iter().find(|c| {
                        let clean_cn = clean_app_name(&c.name);
                        clean_cn == clean_sh 
                            || clean_cn == sh_lower
                            || c.service_name.as_ref().map(|s| clean_app_name(s) == clean_sh).unwrap_or(false)
                    }) {
                        matched_id = Some(c.id.clone());
                        matched_name = Some(c.name.clone());
                    }
                }
            }
        }

        // Matching Pass 3: Port matching for loopback OR targetable private LAN IPs (excluding router gateway .1)
        let is_lan_ip = is_ip && service_host.as_deref().map(is_targetable_private_or_local_ip).unwrap_or(false);
        if matched_id.is_none() && (is_loopback || is_lan_ip) {
            if let Some(port) = service_port {
                let candidate_containers: Vec<_> = containers
                    .iter()
                    .filter(|c| c.ports.contains(&port))
                    .collect();

                if is_loopback {
                    if candidate_containers.len() == 1 {
                        let c = candidate_containers[0];
                        if !is_generic_subdomain(&subdomain) || clean_app_name(&c.name) == subdomain {
                            matched_id = Some(c.id.clone());
                            matched_name = Some(c.name.clone());
                        }
                    } else if candidate_containers.len() > 1 {
                        if let Some(c) = candidate_containers.iter().find(|c| {
                            let clean_c = clean_app_name(&c.name);
                            clean_c == subdomain
                                || (!is_generic_subdomain(&subdomain) && (
                                    c.name.to_lowercase().contains(&subdomain)
                                    || has_meaningful_token_overlap(&c.name, &subdomain)
                                ))
                        }) {
                            matched_id = Some(c.id.clone());
                            matched_name = Some(c.name.clone());
                        }
                    }
                } else if is_lan_ip && !candidate_containers.is_empty() {
                    if let Some(c) = candidate_containers.iter().find(|c| {
                        let clean_c = clean_app_name(&c.name);
                        clean_c == subdomain
                            || (!is_generic_subdomain(&subdomain) && (
                                c.name.to_lowercase().contains(&subdomain)
                                || has_meaningful_token_overlap(&c.name, &subdomain)
                                || c.service_name.as_ref().map(|s| clean_app_name(s) == subdomain).unwrap_or(false)
                            ))
                    }) {
                        matched_id = Some(c.id.clone());
                        matched_name = Some(c.name.clone());
                    }
                }
            }
        }

        // Matching Pass 4: Subdomain semantic matching
        if matched_id.is_none() && !is_generic_subdomain(&subdomain) && subdomain.len() >= 3 {
            if let Some(c) = containers.iter().find(|c| {
                let clean_cn = clean_app_name(&c.name);
                clean_cn == subdomain
                    || clean_cn.replace('-', "") == subdomain.replace('-', "")
                    || c.service_name.as_ref().map(|s| clean_app_name(s) == subdomain).unwrap_or(false)
                    || c.project_name.as_ref().map(|p| clean_app_name(p) == subdomain).unwrap_or(false)
                    || has_meaningful_token_overlap(&c.name, &subdomain)
            }) {
                matched_id = Some(c.id.clone());
                matched_name = Some(c.name.clone());
            }
        }

        // Matching Pass 5: Image name matching
        if matched_id.is_none() && !is_generic_subdomain(&subdomain) && subdomain.len() >= 3 {
            if let Some(c) = containers.iter().find(|c| {
                if let Some(ref img) = c.image_name {
                    let img_base = img.split(':').next().unwrap_or("").split('/').last().unwrap_or("");
                    clean_app_name(img_base) == subdomain || img_base.to_lowercase().contains(&subdomain)
                } else {
                    false
                }
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
pub fn parse_service_target(service: &str) -> (Option<String>, Option<u16>) {
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

/// Gathers container summary info (id, clean name, ports, compose service/project, image) from Docker daemon
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

        let service_name = c
            .labels
            .as_ref()
            .and_then(|l| l.get("com.docker.compose.service").or_else(|| l.get("io.casaos.app.name")))
            .cloned();

        let project_name = c
            .labels
            .as_ref()
            .and_then(|l| l.get("com.docker.compose.project"))
            .cloned();

        let image_name = c.image.clone();

        results.push(ContainerSummaryInfo {
            id,
            name,
            ports,
            service_name,
            project_name,
            image_name,
        });
    }

    results
}

/// Syncs matched ingress rules into Orbit's custom links
pub fn sync_ingress_rules_to_links(rules: &[IngressRule]) -> SyncLinksResponse {
    let mut links_to_update = HashMap::new();

    for rule in rules {
        if let Some(ref container_id) = rule.matched_container_id {
            links_to_update.insert(container_id.clone(), rule.public_url.clone());
            if container_id.len() >= 12 {
                links_to_update.insert(container_id[..12].to_string(), rule.public_url.clone());
            }
        }
        if let Some(ref name) = rule.matched_container_name {
            let clean = name.trim_start_matches('/');
            if !clean.is_empty() {
                links_to_update.insert(clean.to_string(), rule.public_url.clone());
                links_to_update.insert(clean.to_lowercase(), rule.public_url.clone());

                let cleaned = clean_app_name(clean);
                if !cleaned.is_empty() {
                    links_to_update.insert(cleaned, rule.public_url.clone());
                }

                for tok in clean.split(['-', '_']) {
                    let tok_lower = tok.to_lowercase();
                    if tok_lower.len() >= 3 && !is_generic_subdomain(&tok_lower) {
                        links_to_update.entry(tok_lower).or_insert_with(|| rule.public_url.clone());
                    }
                }
            }
        }

        let subdomain = rule.hostname.split('.').next().unwrap_or("").to_lowercase();
        if subdomain.len() >= 3 && !is_generic_subdomain(&subdomain) {
            links_to_update.entry(subdomain).or_insert_with(|| rule.public_url.clone());
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
