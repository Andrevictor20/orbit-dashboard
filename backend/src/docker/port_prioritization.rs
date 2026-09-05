//! Container web port prioritization, well-known port database, and deduplication logic.

use std::collections::{HashMap, HashSet};
use bollard::models::PortSummary;
use crate::docker::types::PortInfo;

/// Well-known web ports for popular self-hosted container applications.
pub fn detect_well_known_web_port(image: &str, name: &str) -> Option<u16> {
    let combined = format!("{}/{}", image.to_lowercase(), name.to_lowercase());
    
    if combined.contains("home-assistant") || combined.contains("homeassistant") {
        Some(8123)
    } else if combined.contains("pihole") || combined.contains("pi-hole") {
        Some(80)
    } else if combined.contains("jellyfin") || combined.contains("emby") {
        Some(8096)
    } else if combined.contains("plex") {
        Some(32400)
    } else if combined.contains("adguard") {
        Some(3000)
    } else if combined.contains("kavita") {
        Some(5000)
    } else if combined.contains("metube") {
        Some(8081)
    } else if combined.contains("moodle") {
        Some(80)
    } else if combined.contains("n8n") {
        Some(5678)
    } else if combined.contains("cloudflared-web") || combined.contains("cloudflared") {
        Some(14333)
    } else if combined.contains("node-red") || combined.contains("nodered") {
        Some(1880)
    } else if combined.contains("overseerr") {
        Some(5055)
    } else if combined.contains("portainer") {
        Some(9000)
    } else if combined.contains("syncthing") {
        Some(8384)
    } else if combined.contains("qbittorrent") {
        Some(8080)
    } else if combined.contains("transmission") {
        Some(9091)
    } else if combined.contains("deluge") {
        Some(8112)
    } else if combined.contains("uptime-kuma") {
        Some(3001)
    } else if combined.contains("wireguard") || combined.contains("wg-easy") {
        Some(51821)
    } else if combined.contains("tailscale") {
        Some(8088)
    } else if combined.contains("esphome") {
        Some(6052)
    } else if combined.contains("zigbee2mqtt") {
        Some(8080)
    } else if combined.contains("vaultwarden") || combined.contains("bitwarden") {
        Some(80)
    } else if combined.contains("grafana") {
        Some(3000)
    } else if combined.contains("prometheus") {
        Some(9090)
    } else if combined.contains("radarr") {
        Some(7878)
    } else if combined.contains("sonarr") {
        Some(8989)
    } else if combined.contains("lidarr") {
        Some(8686)
    } else if combined.contains("bazarr") {
        Some(6767)
    } else if combined.contains("prowlarr") {
        Some(9696)
    } else if combined.contains("readarr") {
        Some(8787)
    } else if combined.contains("audiobookshelf") {
        Some(13378)
    } else if combined.contains("photoprism") {
        Some(2342)
    } else if combined.contains("immich") {
        Some(2283)
    } else if combined.contains("paperless") {
        Some(8000)
    } else if combined.contains("navidrome") {
        Some(4533)
    } else if combined.contains("nginx-proxy-manager") || combined.contains("npm") {
        Some(81)
    } else if combined.contains("nginx") || combined.contains("caddy") {
        Some(80)
    } else if combined.contains("nextcloud") {
        Some(80)
    } else if combined.contains("beszel") {
        Some(8090)
    } else if combined.contains("dozzle") {
        Some(8080)
    } else if combined.contains("glances") {
        Some(61208)
    } else if combined.contains("netdata") {
        Some(19999)
    } else if combined.contains("homarr") {
        Some(7575)
    } else if combined.contains("homepage") {
        Some(3000)
    } else if combined.contains("flaresolverr") {
        Some(8191)
    } else if combined.contains("calibre-web") {
        Some(8083)
    } else if combined.contains("komga") {
        Some(25600)
    } else if combined.contains("mealie") {
        Some(9000)
    } else if combined.contains("wikijs") {
        Some(3000)
    } else if combined.contains("trilium") {
        Some(8080)
    } else if combined.contains("stirling-pdf") {
        Some(8080)
    } else if combined.contains("it-tools") || combined.contains("cyberchef") {
        Some(80)
    } else if combined.contains("changedetection") {
        Some(5000)
    } else if combined.contains("rustdesk") {
        Some(21117)
    } else if combined.contains("guacamole") {
        Some(8080)
    } else if combined.contains("cockpit") {
        Some(9090)
    } else {
        None
    }
}

/// Helper to parse web port from container labels (e.g. CasaOS, Traefik).
pub fn detect_label_web_port(labels: &HashMap<String, String>) -> Option<u16> {
    const LABEL_KEYS: &[&str] = &[
        "io.casaos.port.web",
        "io.casaos.app.port",
        "io.casaos.app.main_port",
        "dev.casaos.app.port",
        "webui.port",
        "web.port",
        "port",
        "PORT",
    ];

    for key in LABEL_KEYS {
        if let Some(val) = labels.get(*key) {
            if let Ok(p) = val.trim().parse::<u16>() {
                if p > 0 {
                    return Some(p);
                }
            }
        }
    }

    // Traefik labels
    for (k, v) in labels {
        if k.starts_with("traefik.") && k.ends_with(".loadbalancer.server.port") {
            if let Ok(p) = v.trim().parse::<u16>() {
                if p > 0 {
                    return Some(p);
                }
            }
        }
    }

    None
}

/// Computes relevance score for sorting container ports (highest score first).
/// Prioritizes Web/HTTP UI ports over infrastructure/UDP/DHCP/DNS ports.
pub fn score_port(port: &PortInfo, label_port: Option<u16>, well_known: Option<u16>) -> i32 {
    let mut score = 0;

    let pub_p = port.public_port;
    let priv_p = port.private_port;
    let is_tcp = port.typ.eq_ignore_ascii_case("tcp");

    // 1. Matches explicit CasaOS/Traefik label port
    if let Some(lp) = label_port {
        if pub_p == Some(lp) || priv_p == lp {
            return 10000;
        }
    }

    // 2. Matches detected well-known image port
    if let Some(wk) = well_known {
        if pub_p == Some(wk) || priv_p == wk {
            return 8000;
        }
    }

    if let Some(pub_val) = pub_p {
        if is_tcp {
            // Standard web ports
            match pub_val {
                80 | 443 | 8080 | 8443 | 3000 | 8000 | 8081 | 8096 | 8123 | 9000 | 9443 | 5000 | 5055 | 1880 | 5678 | 14333 | 32400 => {
                    score += 5000;
                }
                53 | 67 | 68 | 123 | 161 | 514 => {
                    // DNS, DHCP, NTP, SNMP, Syslog
                    score -= 3000;
                }
                _ => {
                    score += 2000;
                }
            }

            match priv_p {
                80 | 443 | 8080 | 8443 | 3000 | 8000 | 8081 | 8096 | 8123 | 9000 | 9443 | 5000 | 5055 | 1880 | 5678 | 14333 => {
                    score += 1500;
                }
                _ => {}
            }
        } else {
            // UDP ports are lower priority than web TCP ports
            score -= 1000;
        }
    } else {
        // No public port mapped
        score -= 4000;
    }

    score
}

/// Deduplicates ports (collapsing IPv4 0.0.0.0 and IPv6 :: into a single entry),
/// enriches missing public ports in host network mode or CasaOS labels,
/// and orders ports placing primary web ports first.
pub fn process_and_prioritize_ports(
    raw_ports: Option<Vec<PortSummary>>,
    labels: &HashMap<String, String>,
    image: &str,
    name: &str,
    network_mode: Option<&str>,
) -> Vec<PortInfo> {
    let label_port = detect_label_web_port(labels);
    let well_known_port = detect_well_known_web_port(image, name);

    let mut dedup_map: Vec<PortInfo> = Vec::new();
    let mut seen_keys: HashSet<(Option<u16>, u16, String)> = HashSet::new();

    let is_host_net = network_mode.map(|m| m.eq_ignore_ascii_case("host")).unwrap_or(false);

    if let Some(ports) = raw_ports {
        for p in ports {
            let typ = p.typ.map(|t| t.to_string()).unwrap_or_else(|| "tcp".to_string());
            let mut pub_port = p.public_port;
            // In host network mode, exposed private port is directly reachable on host
            if is_host_net && pub_port.is_none() {
                pub_port = Some(p.private_port);
            }
            let key = (pub_port, p.private_port, typ.clone());

            if seen_keys.contains(&key) {
                // If the previously seen entry had IPv6 ("::") and current has IPv4 ("0.0.0.0"), prefer IPv4
                if let Some(existing) = dedup_map.iter_mut().find(|e| {
                    e.public_port == pub_port && e.private_port == p.private_port && e.typ == typ
                }) {
                    if existing.ip.as_deref() == Some("::") && p.ip.as_deref() == Some("0.0.0.0") {
                        existing.ip = p.ip;
                    }
                }
                continue;
            }

            seen_keys.insert(key);
            dedup_map.push(PortInfo {
                ip: if is_host_net && p.ip.is_none() { Some("0.0.0.0".to_string()) } else { p.ip },
                private_port: p.private_port,
                public_port: pub_port,
                typ,
            });
        }
    }

    let has_public_port = dedup_map.iter().any(|p| p.public_port.is_some());

    // If container runs in host mode OR has no public ports, check labels and well-known image ports
    if !has_public_port || is_host_net || dedup_map.is_empty() {
        let synthesized_port = label_port.or(well_known_port);
        if let Some(port_num) = synthesized_port {
            let key = (Some(port_num), port_num, "tcp".to_string());
            if !seen_keys.contains(&key) {
                seen_keys.insert(key);
                dedup_map.push(PortInfo {
                    ip: Some("0.0.0.0".to_string()),
                    private_port: port_num,
                    public_port: Some(port_num),
                    typ: "tcp".to_string(),
                });
            }
        }
    }

    // Sort ports putting highest priority (web UI) first
    dedup_map.sort_by(|a, b| {
        let score_b = score_port(b, label_port, well_known_port);
        let score_a = score_port(a, label_port, well_known_port);
        score_b.cmp(&score_a)
            .then_with(|| a.public_port.cmp(&b.public_port))
            .then_with(|| a.private_port.cmp(&b.private_port))
    });

    dedup_map
}
