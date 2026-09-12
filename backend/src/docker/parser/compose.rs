use serde_yaml::Value;
use std::collections::HashMap;

use super::docker_run::{parse_env_spec, parse_port_spec, parse_volume_spec};
use super::models::{ParsedDockerInput, ParsedService};

/// Generates a clean Docker Compose YAML string from parsed services
pub fn generate_compose_yaml(_app_name: &str, services: &[ParsedService]) -> String {
    let mut out = String::new();
    out.push_str("services:\n");

    for svc in services {
        let svc_key = &svc.name;
        out.push_str(&format!("  {}:\n", svc_key));
        out.push_str(&format!("    container_name: {}\n", svc.name));
        out.push_str(&format!("    image: {}\n", svc.image));

        if let Some(ref r) = svc.restart {
            out.push_str(&format!("    restart: {}\n", r));
        }

        if svc.privileged {
            out.push_str("    privileged: true\n");
        }

        if let Some(ref net) = svc.network {
            out.push_str(&format!("    network_mode: {}\n", net));
        }

        if !svc.ports.is_empty() {
            out.push_str("    ports:\n");
            for p in &svc.ports {
                if let Some(hp) = p.host_port {
                    if p.protocol != "tcp" {
                        out.push_str(&format!(
                            "      - \"{}:{}/{}\"\n",
                            hp, p.container_port, p.protocol
                        ));
                    } else {
                        out.push_str(&format!("      - \"{}:{}\"\n", hp, p.container_port));
                    }
                } else {
                    out.push_str(&format!("      - \"{}\"\n", p.container_port));
                }
            }
        }

        if !svc.volumes.is_empty() {
            out.push_str("    volumes:\n");
            for v in &svc.volumes {
                if let Some(ref m) = v.mode {
                    out.push_str(&format!(
                        "      - \"{}:{}:{}\"\n",
                        v.host_path, v.container_path, m
                    ));
                } else {
                    out.push_str(&format!(
                        "      - \"{}:{}\"\n",
                        v.host_path, v.container_path
                    ));
                }
            }
        }

        if !svc.environment.is_empty() {
            out.push_str("    environment:\n");
            let mut sorted_keys: Vec<_> = svc.environment.keys().collect();
            sorted_keys.sort();
            for k in sorted_keys {
                let v = &svc.environment[k];
                out.push_str(&format!("      - {}={}\n", k, v));
            }
        }

        if let Some(ref cmd) = svc.command {
            out.push_str("    command: ");
            if cmd.len() == 1 {
                out.push_str(&format!("\"{}\"\n", cmd[0]));
            } else {
                let formatted: Vec<String> = cmd.iter().map(|c| format!("\"{}\"", c)).collect();
                out.push_str(&format!("[{}]\n", formatted.join(", ")));
            }
        }
    }

    out
}

/// Parses Docker Compose YAML string directly
pub fn parse_docker_compose_yaml(yaml_str: &str) -> Result<ParsedDockerInput, String> {
    let parsed: Value =
        serde_yaml::from_str(yaml_str).map_err(|e| format!("YAML parse error: {}", e))?;

    let services_map = parsed
        .get("services")
        .and_then(|s| s.as_mapping())
        .ok_or_else(|| "Missing 'services' mapping in Docker Compose YAML".to_string())?;

    let mut services = Vec::new();
    let mut primary_app_name = String::new();
    let mut primary_image = String::new();

    for (k, v) in services_map {
        let svc_name = k.as_str().unwrap_or("service").to_string();
        let svc_map = v.as_mapping();

        let image = svc_map
            .and_then(|m| m.get(&Value::String("image".to_string())))
            .and_then(|img| img.as_str())
            .unwrap_or("")
            .to_string();

        let container_name = svc_map
            .and_then(|m| m.get(&Value::String("container_name".to_string())))
            .and_then(|cn| cn.as_str())
            .map(|cn| cn.to_string())
            .unwrap_or_else(|| svc_name.clone());

        let restart = svc_map
            .and_then(|m| m.get(&Value::String("restart".to_string())))
            .and_then(|r| r.as_str())
            .map(|r| r.to_string());

        let mut ports = Vec::new();
        if let Some(ports_seq) = svc_map
            .and_then(|m| m.get(&Value::String("ports".to_string())))
            .and_then(|p| p.as_sequence())
        {
            for p in ports_seq {
                if let Some(p_str) = p.as_str() {
                    if let Some(parsed_p) = parse_port_spec(p_str) {
                        ports.push(parsed_p);
                    }
                } else if let Some(p_int) = p.as_i64() {
                    if let Some(parsed_p) = parse_port_spec(&p_int.to_string()) {
                        ports.push(parsed_p);
                    }
                }
            }
        }

        let mut volumes = Vec::new();
        if let Some(vols_seq) = svc_map
            .and_then(|m| m.get(&Value::String("volumes".to_string())))
            .and_then(|v| v.as_sequence())
        {
            for vol in vols_seq {
                if let Some(v_str) = vol.as_str() {
                    if let Some(parsed_v) = parse_volume_spec(v_str) {
                        volumes.push(parsed_v);
                    }
                }
            }
        }

        let mut environment = HashMap::new();
        if let Some(env_val) =
            svc_map.and_then(|m| m.get(&Value::String("environment".to_string())))
        {
            if let Some(env_seq) = env_val.as_sequence() {
                for e in env_seq {
                    if let Some(e_str) = e.as_str() {
                        let (k, v) = parse_env_spec(e_str);
                        environment.insert(k, v);
                    }
                }
            } else if let Some(env_map) = env_val.as_mapping() {
                for (ek, ev) in env_map {
                    if let Some(ek_str) = ek.as_str() {
                        let ev_str = match ev {
                            Value::String(s) => s.clone(),
                            Value::Number(n) => n.to_string(),
                            Value::Bool(b) => b.to_string(),
                            _ => String::new(),
                        };
                        environment.insert(ek_str.to_string(), ev_str);
                    }
                }
            }
        }

        if primary_app_name.is_empty() {
            primary_app_name = container_name.clone();
            primary_image = image.clone();
        }

        services.push(ParsedService {
            name: container_name,
            image,
            restart,
            ports,
            volumes,
            environment,
            command: None,
            network: None,
            privileged: false,
        });
    }

    Ok(ParsedDockerInput {
        input_type: "docker_compose".to_string(),
        app_name: if primary_app_name.is_empty() {
            "compose-app".to_string()
        } else {
            primary_app_name
        },
        image: primary_image,
        services,
        compose_yaml: yaml_str.trim().to_string(),
    })
}
