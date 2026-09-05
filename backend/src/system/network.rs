//! Host network telemetry, interface detection (cable/wifi), routing table parsing, and byte counters.

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NetworkInterfaceInfo {
    pub name: String,
    pub kind: String, // "ethernet" | "wifi"
}

/// Classifies an interface as "wifi" or "ethernet" (cable)
pub fn detect_interface_kind(iface: &str) -> String {
    let lower = iface.to_lowercase();
    if lower.starts_with("wl") || lower.contains("wifi") || lower.contains("wlan") {
        return "wifi".to_string();
    }
    // Check sysfs for wireless extension
    let sys_wireless_paths = [
        format!("/host/sys/class/net/{}/wireless", iface),
        format!("/sys/class/net/{}/wireless", iface),
        format!("/host/sys/class/net/{}/phy80211", iface),
        format!("/sys/class/net/{}/phy80211", iface),
    ];
    for p in sys_wireless_paths {
        if std::path::Path::new(&p).exists() {
            return "wifi".to_string();
        }
    }
    "ethernet".to_string()
}

/// Pure helper to parse the default route interface with the lowest metric from route table content.
pub fn parse_default_route_interface(content: &str) -> Option<String> {
    let mut best_route: Option<(String, u32)> = None;

    for line in content.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 7 {
            let iface = parts[0];
            let destination = parts[1];
            let flags_str = parts[3];
            let metric = parts[6].parse::<u32>().unwrap_or(0);

            // Skip loopback, docker virtual bridges, veths, tailscale
            if iface == "lo"
                || iface.starts_with("docker")
                || iface.starts_with("veth")
                || iface.starts_with("br-")
                || iface.starts_with("tailscale")
                || iface.starts_with("virbr")
                || iface.starts_with("tun")
                || iface.starts_with("tap")
            {
                continue;
            }

            // Destination 00000000 = 0.0.0.0 (default gateway)
            // Flags: RTF_UP (0x0001) | RTF_GATEWAY (0x0002) => flags & 0x0002 != 0
            if destination == "00000000" {
                let flags = u32::from_str_radix(flags_str, 16).unwrap_or(0);
                if (flags & 0x0002) != 0 && (flags & 0x0001) != 0 {
                    match &best_route {
                        Some((_, best_metric)) if metric < *best_metric => {
                            best_route = Some((iface.to_string(), metric));
                        }
                        None => {
                            best_route = Some((iface.to_string(), metric));
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    best_route.map(|(iface, _)| iface)
}

/// Pure helper to extract (rx_bytes, tx_bytes) for a specific interface from /proc/net/dev content.
/// Robust against joined or spaced colon formats (e.g. "eth0: 1234" or "eth0:1234").
pub fn parse_dev_interface_bytes(content: &str, target_iface: &str) -> Option<(u64, u64)> {
    for line in content.lines().skip(2) {
        let line = line.trim();
        if let Some((name, rest)) = line.split_once(':') {
            if name.trim() == target_iface {
                let nums: Vec<&str> = rest.split_whitespace().collect();
                if nums.len() >= 9 {
                    if let (Ok(rx), Ok(tx)) = (nums[0].parse::<u64>(), nums[8].parse::<u64>()) {
                        return Some((rx, tx));
                    }
                }
            }
        }
    }
    None
}

/// Identifies the primary network interface (cable or wifi) used for internet traffic.
/// Priority:
/// 1. `ORBIT_NETWORK_INTERFACE` environment variable override (e.g. "eth0")
/// 2. Default route with lowest metric from routing tables (/host/proc/1/net/route, /proc/1/net/route, etc.)
/// 3. Active physical network interface (prioritizing ethernet `eth*`, `en*` over wifi `wl*`)
pub fn detect_primary_network_interface() -> Option<NetworkInterfaceInfo> {
    // 1. Explicit environment override
    if let Ok(override_iface) = std::env::var("ORBIT_NETWORK_INTERFACE") {
        let trimmed = override_iface.trim();
        if !trimmed.is_empty() {
            return Some(NetworkInterfaceInfo {
                name: trimmed.to_string(),
                kind: detect_interface_kind(trimmed),
            });
        }
    }

    // 2. Default route from Linux routing tables
    let route_paths = [
        "/host/proc/1/net/route",
        "/proc/1/net/route",
        "/host/proc/net/route",
        "/proc/net/route",
    ];

    for path in route_paths {
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Some(iface) = parse_default_route_interface(&content) {
                return Some(NetworkInterfaceInfo {
                    kind: detect_interface_kind(&iface),
                    name: iface,
                });
            }
        }
    }

    // 3. Fallback: inspect dev tables to find active physical interface
    let dev_paths = [
        "/host/proc/1/net/dev",
        "/proc/1/net/dev",
        "/host/proc/net/dev",
        "/proc/net/dev",
    ];

    let mut candidate_ethernet: Option<String> = None;
    let mut candidate_wifi: Option<String> = None;
    let mut candidate_other: Option<String> = None;

    for path in dev_paths {
        if let Ok(content) = std::fs::read_to_string(path) {
            for line in content.lines().skip(2) {
                let line = line.trim();
                if let Some((iface_part, rest)) = line.split_once(':') {
                    let iface = iface_part.trim();
                    if iface == "lo"
                        || iface.starts_with("docker")
                        || iface.starts_with("veth")
                        || iface.starts_with("br-")
                        || iface.starts_with("tailscale")
                        || iface.starts_with("virbr")
                        || iface.starts_with("tun")
                        || iface.starts_with("tap")
                    {
                        continue;
                    }

                    let nums: Vec<&str> = rest.split_whitespace().collect();
                    let rx = nums.first().and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
                    let tx = nums.get(8).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);

                    // Prefer interface with actual traffic
                    if rx > 0 || tx > 0 {
                        let lower = iface.to_lowercase();
                        if lower.starts_with("eth")
                            || lower.starts_with("en")
                            || lower.starts_with("em")
                        {
                            if candidate_ethernet.is_none() || iface == "eth0" {
                                candidate_ethernet = Some(iface.to_string());
                            }
                        } else if lower.starts_with("wl") {
                            if candidate_wifi.is_none() {
                                candidate_wifi = Some(iface.to_string());
                            }
                        } else if candidate_other.is_none() {
                            candidate_other = Some(iface.to_string());
                        }
                    }
                }
            }
            if candidate_ethernet.is_some() || candidate_wifi.is_some() || candidate_other.is_some() {
                break;
            }
        }
    }

    let selected = candidate_ethernet
        .or(candidate_wifi)
        .or(candidate_other);

    selected.map(|iface| NetworkInterfaceInfo {
        kind: detect_interface_kind(&iface),
        name: iface,
    })
}

/// Reads rx and tx bytes for the host primary network interface.
/// If an interface cannot be identified or read, falls back to summing all physical interfaces.
pub fn read_host_network_bytes(preferred_iface: Option<&str>) -> (Option<NetworkInterfaceInfo>, u64, u64) {
    let iface_info = match preferred_iface {
        Some(name) => Some(NetworkInterfaceInfo {
            name: name.to_string(),
            kind: detect_interface_kind(name),
        }),
        None => detect_primary_network_interface(),
    };

    let dev_paths = [
        "/host/proc/1/net/dev",
        "/proc/1/net/dev",
        "/host/proc/net/dev",
        "/proc/net/dev",
    ];

    if let Some(ref info) = iface_info {
        for path in dev_paths {
            if let Ok(content) = std::fs::read_to_string(path) {
                if let Some((rx, tx)) = parse_dev_interface_bytes(&content, &info.name) {
                    return (iface_info, rx, tx);
                }
            }
        }

        // Sysfs fallback for chosen interface
        let sys_paths = [
            format!("/host/sys/class/net/{}/statistics", info.name),
            format!("/sys/class/net/{}/statistics", info.name),
        ];
        for base in sys_paths {
            let rx_file = format!("{}/rx_bytes", base);
            let tx_file = format!("{}/tx_bytes", base);
            if let (Ok(rx_str), Ok(tx_str)) = (std::fs::read_to_string(&rx_file), std::fs::read_to_string(&tx_file)) {
                if let (Ok(rx), Ok(tx)) = (rx_str.trim().parse::<u64>(), tx_str.trim().parse::<u64>()) {
                    return (iface_info, rx, tx);
                }
            }
        }
    }

    // Fallback if no specific interface could be matched: sum all physical non-virtual interfaces
    for path in dev_paths {
        if let Ok(content) = std::fs::read_to_string(path) {
            let mut total_rx = 0u64;
            let mut total_tx = 0u64;
            let mut found_any = false;
            for line in content.lines().skip(2) {
                let line = line.trim();
                if let Some((name, rest)) = line.split_once(':') {
                    let iface = name.trim();
                    if iface == "lo"
                        || iface.starts_with("docker")
                        || iface.starts_with("veth")
                        || iface.starts_with("br-")
                        || iface.starts_with("tailscale")
                        || iface.starts_with("virbr")
                        || iface.starts_with("tun")
                        || iface.starts_with("tap")
                    {
                        continue;
                    }
                    let nums: Vec<&str> = rest.split_whitespace().collect();
                    if nums.len() >= 9 {
                        if let (Ok(rx), Ok(tx)) = (nums[0].parse::<u64>(), nums[8].parse::<u64>()) {
                            total_rx += rx;
                            total_tx += tx;
                            found_any = true;
                        }
                    }
                }
            }
            if found_any && (total_rx > 0 || total_tx > 0) {
                return (iface_info, total_rx, total_tx);
            }
        }
    }

    (iface_info, 0, 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_default_route_interface() {
        let route_content = "\
Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT
docker0\t000011AC\t00000000\t0001\t0\t0\t0\t0000FFFF\t0\t0\t0
eth0\t00000000\t0101A8C0\t0003\t0\t0\t100\t00000000\t0\t0\t0
eth0\t0001A8C0\t00000000\t0001\t0\t0\t100\t00FFFFFF\t0\t0\t0";

        let detected = parse_default_route_interface(route_content);
        assert_eq!(detected, Some("eth0".to_string()));
    }

    #[test]
    fn test_parse_default_route_metric_priority() {
        let route_content = "\
Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT
wlan0\t00000000\t0101A8C0\t0003\t0\t0\t600\t00000000\t0\t0\t0
eth0\t00000000\t0101A8C0\t0003\t0\t0\t100\t00000000\t0\t0\t0";

        let detected = parse_default_route_interface(route_content);
        assert_eq!(detected, Some("eth0".to_string()), "eth0 with metric 100 must be chosen over wlan0 with metric 600");
    }

    #[test]
    fn test_parse_dev_interface_bytes_with_colon_spacing() {
        let dev_spaced = "\
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 63057098   70026    0    0    0     0          0         0 63057098   70026    0    0    0     0       0          0
  eth0: 15000000  120000    0    0    0     0          0         0  8000000   90000    0    0    0     0       0          0";

        let bytes = parse_dev_interface_bytes(dev_spaced, "eth0");
        assert_eq!(bytes, Some((15000000, 8000000)));

        let dev_touching = "\
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
  eth0:999999999 120000    0    0    0     0          0         0 444444444   90000    0    0    0     0       0          0";

        let bytes_touching = parse_dev_interface_bytes(dev_touching, "eth0");
        assert_eq!(bytes_touching, Some((999999999, 444444444)));
    }

    #[test]
    fn test_detect_interface_kind() {
        assert_eq!(detect_interface_kind("eth0"), "ethernet");
        assert_eq!(detect_interface_kind("enp3s0"), "ethernet");
        assert_eq!(detect_interface_kind("eno1"), "ethernet");
        assert_eq!(detect_interface_kind("wlan0"), "wifi");
        assert_eq!(detect_interface_kind("wlp2s0"), "wifi");
    }
}
