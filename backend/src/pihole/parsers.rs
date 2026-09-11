use serde_json::Value;
use std::collections::HashMap;
use super::models::{PiHoleClientItem, PiHoleRecentQueryItem, PiHoleUpstreamItem};

/// Parses top domains (queries or ads) from multiple possible Pi-hole JSON response formats:
/// 1. Map of `"domain": count`
/// 2. Array of objects `[ { "domain": "...", "count": 123 } ]` (or `"name"`, `"hits"`)
/// 3. Array of pairs `[ [ "domain", 123 ] ]`
pub fn parse_domain_map(val: &Value) -> HashMap<String, u64> {
    let mut map = HashMap::new();

    if let Some(obj) = val.as_object() {
        for (k, v) in obj {
            let count = if let Some(n) = v.as_u64() {
                n
            } else if let Some(f) = v.as_f64() {
                f as u64
            } else if let Some(s) = v.as_str() {
                s.parse::<u64>().unwrap_or(0)
            } else {
                0
            };
            if !k.trim().is_empty() {
                map.insert(k.clone(), count);
            }
        }
    } else if let Some(arr) = val.as_array() {
        for item in arr {
            if let Some(obj) = item.as_object() {
                let domain = obj.get("domain")
                    .or_else(|| obj.get("name"))
                    .and_then(|v| v.as_str());
                let count = obj.get("count")
                    .or_else(|| obj.get("hits"))
                    .or_else(|| obj.get("queries"))
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
                if let Some(d) = domain {
                    if !d.trim().is_empty() {
                        map.insert(d.to_string(), count);
                    }
                }
            } else if let Some(pair) = item.as_array() {
                if pair.len() >= 2 {
                    if let Some(d) = pair[0].as_str() {
                        let count = pair[1].as_u64().unwrap_or(0);
                        if !d.trim().is_empty() {
                            map.insert(d.to_string(), count);
                        }
                    }
                }
            }
        }
    }

    map
}

/// Extracts top_queries and top_ads from a combined response, such as Pi-hole v6 `/api/stats/top_domains`
pub fn extract_top_domains_from_v6(val: &Value) -> (HashMap<String, u64>, HashMap<String, u64>) {
    let mut top_queries = HashMap::new();
    let mut top_ads = HashMap::new();

    if let Some(tq) = val.get("top_queries") {
        top_queries.extend(parse_domain_map(tq));
    }
    if let Some(ta) = val.get("top_ads") {
        top_ads.extend(parse_domain_map(ta));
    }

    // Check array under "domains" or "top_domains"
    if let Some(arr) = val.get("domains")
        .or_else(|| val.get("top_domains"))
        .and_then(|v| v.as_array())
    {
        for item in arr {
            let is_blocked = item.get("blocked").and_then(|b| b.as_bool()).unwrap_or(false);
            let domain = item.get("domain")
                .or_else(|| item.get("name"))
                .and_then(|v| v.as_str());
            let count = item.get("count")
                .or_else(|| item.get("hits"))
                .and_then(|v| v.as_u64())
                .unwrap_or(0);

            if let Some(d) = domain {
                if is_blocked {
                    top_ads.insert(d.to_string(), count);
                } else {
                    top_queries.insert(d.to_string(), count);
                }
            }
        }
    }

    (top_queries, top_ads)
}

/// Parses top clients from Pi-hole v6 (`/api/stats/top_clients`) or v5 (`topClients=10`)
pub fn parse_clients_list(val: &Value, total_queries: u64) -> Vec<PiHoleClientItem> {
    let mut result = Vec::new();

    // v5/v6 map format: { "192.168.1.10|hostname": 1500 } or { "192.168.1.10": 1500 }
    let raw_map = if let Some(ts) = val.get("top_sources").and_then(|v| v.as_object()) {
        Some(ts)
    } else if let Some(tc) = val.get("top_clients").and_then(|v| v.as_object()) {
        Some(tc)
    } else if val.is_object() && !val.get("clients").is_some() {
        val.as_object()
    } else {
        None
    };

    if let Some(map) = raw_map {
        for (key, count_val) in map {
            let count = count_val.as_u64().unwrap_or(0);
            let (ip, name) = if let Some((first, second)) = key.split_once('|') {
                (first.trim().to_string(), second.trim().to_string())
            } else {
                (key.trim().to_string(), key.trim().to_string())
            };

            let percentage = if total_queries > 0 {
                ((count as f64 / total_queries as f64) * 100.0 * 10.0).round() / 10.0
            } else {
                0.0
            };

            result.push(PiHoleClientItem {
                ip,
                name: if name.is_empty() { key.clone() } else { name },
                count,
                percentage,
            });
        }
    } else {
        let raw_arr = val.get("clients").and_then(|v| v.as_array())
            .or_else(|| val.get("top_clients").and_then(|v| v.as_array()))
            .or_else(|| val.as_array());

        if let Some(arr) = raw_arr {
            for item in arr {
                let ip = item.get("ip")
                    .or_else(|| item.get("client"))
                    .or_else(|| item.get("address"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let name = item.get("name")
                    .or_else(|| item.get("hostname"))
                    .and_then(|v| v.as_str())
                    .unwrap_or(&ip)
                    .to_string();
                let count = item.get("count")
                    .or_else(|| item.get("queries"))
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);

                let percentage = if total_queries > 0 {
                    ((count as f64 / total_queries as f64) * 100.0 * 10.0).round() / 10.0
                } else {
                    0.0
                };

                if !ip.is_empty() || !name.is_empty() {
                    result.push(PiHoleClientItem {
                        ip: if ip.is_empty() { name.clone() } else { ip },
                        name,
                        count,
                        percentage,
                    });
                }
            }
        }
    }

    result.sort_by(|a, b| b.count.cmp(&a.count));
    result.truncate(10);
    result
}

/// Parses upstreams / forward destinations from v6 (`/api/stats/upstreams`) or v5 (`getForwardDestinations`)
pub fn parse_upstreams(val: &Value) -> Vec<PiHoleUpstreamItem> {
    let mut list = Vec::new();

    // 1. Array format (v6)
    let raw_upstreams = val.get("upstreams").and_then(|v| v.as_array())
        .or_else(|| val.as_array());

    if let Some(arr) = raw_upstreams {
        for item in arr {
            let destination = item.get("ip")
                .or_else(|| item.get("destination"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let raw_name = item.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let name = if raw_name.is_empty() {
                format_upstream_name(&destination)
            } else {
                raw_name.to_string()
            };

            let count = item.get("count").and_then(|v| v.as_u64()).unwrap_or(0);
            let percentage = item.get("percentage").and_then(|v| v.as_f64()).unwrap_or(0.0);

            if !destination.is_empty() {
                list.push(PiHoleUpstreamItem {
                    destination,
                    name,
                    count,
                    percentage: (percentage * 10.0).round() / 10.0,
                });
            }
        }
    }

    // 2. Object format (v5/v6 `forward_destinations`: { "1.1.1.1#53|one.one.one.one": 84.5 })
    if list.is_empty() {
        let raw_destinations = val.get("forward_destinations").and_then(|v| v.as_object())
            .or_else(|| val.as_object());

        if let Some(obj) = raw_destinations {
            for (key, pct_val) in obj {
                let percentage = if let Some(f) = pct_val.as_f64() {
                    f
                } else if let Some(n) = pct_val.as_u64() {
                    n as f64
                } else {
                    0.0
                };

                let (dest, name) = if let Some((first, second)) = key.split_once('|') {
                    let clean_dest = first.split('#').next().unwrap_or(first).trim();
                    (clean_dest.to_string(), second.trim().to_string())
                } else {
                    let clean_dest = key.split('#').next().unwrap_or(key).trim();
                    (clean_dest.to_string(), format_upstream_name(clean_dest))
                };

                list.push(PiHoleUpstreamItem {
                    destination: dest.clone(),
                    name: if name.is_empty() { format_upstream_name(&dest) } else { name },
                    count: 0,
                    percentage: (percentage * 10.0).round() / 10.0,
                });
            }
        }
    }

    list.sort_by(|a, b| b.percentage.partial_cmp(&a.percentage).unwrap_or(std::cmp::Ordering::Equal));
    list
}

/// Parses query types from summary `queries.types` or `/api/stats/query_types` or v5 `getQueryTypes`
pub fn parse_query_types(val: &Value) -> HashMap<String, u64> {
    let mut map = HashMap::new();
    let target = val.get("querytypes")
        .or_else(|| val.get("query_types"))
        .or_else(|| val.get("types"))
        .unwrap_or(val);

    if let Some(obj) = target.as_object() {
        for (k, v) in obj {
            let clean_key = k.split(' ').next().unwrap_or(k).trim().to_uppercase();
            let count = if let Some(n) = v.as_u64() {
                n
            } else if let Some(f) = v.as_f64() {
                f.round() as u64
            } else {
                0
            };
            if !clean_key.is_empty() && count > 0 {
                map.insert(clean_key, count);
            }
        }
    }
    map
}

/// Parses recent queries from v6 (`/api/queries`) or v5 (`getAllQueries=10`)
pub fn parse_recent_queries(val: &Value) -> Vec<PiHoleRecentQueryItem> {
    let mut items = Vec::new();

    let raw_queries = val.get("queries").and_then(|v| v.as_array())
        .or_else(|| val.get("data").and_then(|v| v.as_array()))
        .or_else(|| val.as_array());

    if let Some(arr) = raw_queries {
        for item in arr.iter().take(10) {
            if let Some(obj) = item.as_object() {
                let timestamp = obj.get("time").or_else(|| obj.get("timestamp")).and_then(|v| v.as_u64()).unwrap_or(0);
                let qtype = obj.get("type").and_then(|v| v.as_str()).unwrap_or("A").to_string();
                let domain = obj.get("domain").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let client = obj.get("client").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let raw_status = obj.get("status").and_then(|v| v.as_str()).unwrap_or("forwarded");
                let status = normalize_query_status(raw_status);
                let reply = obj.get("reply").and_then(|v| v.as_str()).map(|s| s.to_string());

                if !domain.is_empty() {
                    items.push(PiHoleRecentQueryItem {
                        timestamp,
                        time: format_time_from_ts(timestamp),
                        query_type: qtype,
                        domain,
                        client,
                        status,
                        reply,
                    });
                }
            } else if let Some(row) = item.as_array() {
                // v5 format: [timestamp, type, domain, client, status_code, ...]
                if row.len() >= 4 {
                    let timestamp = row[0].as_str().and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
                    let qtype = row[1].as_str().unwrap_or("A").to_string();
                    let domain = row[2].as_str().unwrap_or("").to_string();
                    let client = row[3].as_str().unwrap_or("").to_string();
                    let status_code = row.get(4).and_then(|v| v.as_str()).unwrap_or("2");
                    let status = match status_code {
                        "1" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" => "blocked",
                        "2" => "forwarded",
                        "3" => "cached",
                        _ => "forwarded",
                    }.to_string();

                    if !domain.is_empty() {
                        items.push(PiHoleRecentQueryItem {
                            timestamp,
                            time: format_time_from_ts(timestamp),
                            query_type: qtype,
                            domain,
                            client,
                            status,
                            reply: None,
                        });
                    }
                }
            }
        }
    }

    items
}

fn format_upstream_name(dest: &str) -> String {
    match dest {
        "1.1.1.1" | "1.0.0.1" => "Cloudflare DNS".to_string(),
        "8.8.8.8" | "8.8.4.4" => "Google Public DNS".to_string(),
        "9.9.9.9" | "149.112.112.112" => "Quad9 DNS".to_string(),
        "208.67.222.222" | "208.67.220.220" => "OpenDNS".to_string(),
        "127.0.0.1" | "localhost" => "Localhost / Unbound".to_string(),
        "blocklist" => "Gravity (Blocklist)".to_string(),
        "cache" => "Local Cache".to_string(),
        other => {
            if other.contains(':') {
                format!("IPv6 DNS ({})", other)
            } else {
                format!("DNS ({})", other)
            }
        }
    }
}

fn normalize_query_status(raw: &str) -> String {
    let lower = raw.to_lowercase();
    if lower.contains("block") || lower.contains("gravity") || lower.contains("deny") {
        "blocked".to_string()
    } else if lower.contains("cache") {
        "cached".to_string()
    } else {
        "forwarded".to_string()
    }
}

fn format_time_from_ts(ts: u64) -> String {
    if ts == 0 {
        return "--:--:--".to_string();
    }
    // Simple UTC time formatting from epoch seconds without extra crates
    let secs_in_day = ts % 86400;
    let hours = secs_in_day / 3600;
    let minutes = (secs_in_day % 3600) / 60;
    let seconds = secs_in_day % 60;
    format!("{:02}:{:02}:{:02}", hours, minutes, seconds)
}
