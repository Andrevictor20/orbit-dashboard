use bollard::query_parameters::ListContainersOptions;
use bollard::Docker;
use serde::{Deserialize, Serialize};
use std::net::{TcpListener, UdpSocket};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PortConflictInfo {
    pub host_port: u16,
    pub container_port: u16,
    pub protocol: String,
    pub in_use: bool,
    pub in_use_by: Option<String>,
    pub suggested_port: u16,
}

/// Checks socket level port availability on host
pub fn is_socket_port_in_use(port: u16, protocol: &str) -> bool {
    if protocol.eq_ignore_ascii_case("udp") {
        match UdpSocket::bind(("0.0.0.0", port)) {
            Ok(_) => false,
            Err(_) => true,
        }
    } else {
        match TcpListener::bind(("0.0.0.0", port)) {
            Ok(_) => false,
            Err(_) => true,
        }
    }
}

/// Finds the next available port starting from `start_port`
pub fn find_next_available_port(start_port: u16, protocol: &str, occupied_docker_ports: &[(u16, String)]) -> u16 {
    let mut candidate = start_port;
    for _ in 0..500 {
        if candidate == 0 || candidate >= 65535 {
            break;
        }
        let in_docker = occupied_docker_ports.iter().any(|(p, _)| *p == candidate);
        let in_socket = is_socket_port_in_use(candidate, protocol);

        if !in_docker && !in_socket {
            return candidate;
        }
        candidate += 1;
    }
    start_port + 1
}

/// Synchronously checks port availability with fallback
pub fn check_port_availability(port: u16, protocol: &str) -> PortConflictInfo {
    let in_use = is_socket_port_in_use(port, protocol);
    let in_use_by = if in_use {
        Some("Serviço do Host / Socket em uso".to_string())
    } else {
        None
    };

    let suggested_port = if in_use {
        find_next_available_port(port + 1, protocol, &[])
    } else {
        port
    };

    PortConflictInfo {
        host_port: port,
        container_port: port,
        protocol: protocol.to_lowercase(),
        in_use,
        in_use_by,
        suggested_port,
    }
}

/// Asynchronously checks a list of ports querying both Docker daemon and host sockets
pub async fn check_ports_with_docker(
    docker: Option<&Docker>,
    ports_to_check: &[(u16, u16, String)], // (host_port, container_port, protocol)
) -> Vec<PortConflictInfo> {
    // 1. Gather all occupied ports in active Docker containers
    let mut docker_ports: Vec<(u16, String)> = Vec::new();

    if let Some(d) = docker {
        let options = ListContainersOptions {
            all: false, // only running containers
            ..Default::default()
        };

        if let Ok(containers) = d.list_containers(Some(options)).await {
            for c in containers {
                let c_name = c.names
                    .and_then(|n| n.first().cloned())
                    .unwrap_or_else(|| c.id.unwrap_or_default().chars().take(12).collect());
                let clean_name = c_name.trim_start_matches('/').to_string();

                if let Some(ports) = c.ports {
                    for p in ports {
                        if let Some(pub_p) = p.public_port {
                            docker_ports.push((pub_p, clean_name.clone()));
                        }
                    }
                }
            }
        }
    }

    // 2. Check each requested port
    let mut results = Vec::new();

    for &(host_p, cont_p, ref proto) in ports_to_check {
        let docker_occupant = docker_ports.iter().find(|(p, _)| *p == host_p).map(|(_, name)| name.clone());
        let socket_in_use = is_socket_port_in_use(host_p, proto);

        let in_use = docker_occupant.is_some() || socket_in_use;
        let in_use_by = if let Some(ref c_name) = docker_occupant {
            Some(format!("Container '{}'", c_name))
        } else if socket_in_use {
            Some("Serviço do Host / Socket em uso".to_string())
        } else {
            None
        };

        let suggested_port = if in_use {
            find_next_available_port(host_p + 1, proto, &docker_ports)
        } else {
            host_p
        };

        results.push(PortConflictInfo {
            host_port: host_p,
            container_port: cont_p,
            protocol: proto.clone(),
            in_use,
            in_use_by,
            suggested_port,
        });
    }

    results
}
