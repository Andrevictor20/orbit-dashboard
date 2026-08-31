use serde::{Deserialize, Serialize};
use serde_yaml::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParsedPort {
    pub host_port: Option<u16>,
    pub container_port: u16,
    pub protocol: String,
    pub host_ip: Option<String>,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParsedVolume {
    pub host_path: String,
    pub container_path: String,
    pub mode: Option<String>,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParsedService {
    pub name: String,
    pub image: String,
    pub restart: Option<String>,
    pub ports: Vec<ParsedPort>,
    pub volumes: Vec<ParsedVolume>,
    pub environment: HashMap<String, String>,
    pub command: Option<Vec<String>>,
    pub network: Option<String>,
    pub privileged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedDockerInput {
    pub input_type: String, // "docker_run" | "docker_compose"
    pub app_name: String,
    pub image: String,
    pub services: Vec<ParsedService>,
    pub compose_yaml: String,
}

/// Tokenizes a shell command string respecting quotes and backslash line continuations
pub fn tokenize_command(cmd_str: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_single_quote = false;
    let mut in_double_quote = false;
    let mut chars = cmd_str.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '\\' {
            if let Some(&next_c) = chars.peek() {
                if next_c == '\n' || next_c == '\r' {
                    chars.next(); // skip newline
                    if next_c == '\r' && chars.peek() == Some(&'\n') {
                        chars.next();
                    }
                    continue;
                } else if !in_single_quote {
                    current.push(chars.next().unwrap());
                    continue;
                }
            }
        }

        if c == '\'' && !in_double_quote {
            in_single_quote = !in_single_quote;
            continue;
        }

        if c == '"' && !in_single_quote {
            in_double_quote = !in_double_quote;
            continue;
        }

        if (c.is_whitespace()) && !in_single_quote && !in_double_quote {
            if !current.is_empty() {
                tokens.push(current.clone());
                current.clear();
            }
        } else {
            current.push(c);
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    tokens
}

/// Parses port specification (e.g., "8080:80", "127.0.0.1:8080:80/udp", "80")
pub fn parse_port_spec(spec: &str) -> Option<ParsedPort> {
    let clean = spec.trim().trim_matches('\'').trim_matches('"');
    let (port_part, proto) = if let Some((p, pr)) = clean.rsplit_once('/') {
        (p, pr.to_lowercase())
    } else {
        (clean, "tcp".to_string())
    };

    let parts: Vec<&str> = port_part.split(':').collect();
    match parts.len() {
        1 => {
            let container_p = parts[0].parse::<u16>().ok()?;
            Some(ParsedPort {
                host_port: None,
                container_port: container_p,
                protocol: proto,
                host_ip: None,
                raw: spec.to_string(),
            })
        }
        2 => {
            let host_p = parts[0].parse::<u16>().ok()?;
            let container_p = parts[1].parse::<u16>().ok()?;
            Some(ParsedPort {
                host_port: Some(host_p),
                container_port: container_p,
                protocol: proto,
                host_ip: None,
                raw: spec.to_string(),
            })
        }
        3 => {
            let host_ip = parts[0].to_string();
            let host_p = parts[1].parse::<u16>().ok()?;
            let container_p = parts[2].parse::<u16>().ok()?;
            Some(ParsedPort {
                host_port: Some(host_p),
                container_port: container_p,
                protocol: proto,
                host_ip: Some(host_ip),
                raw: spec.to_string(),
            })
        }
        _ => None,
    }
}

/// Parses volume specification (e.g., "/host/path:/container/path:ro", "./data:/app")
pub fn parse_volume_spec(spec: &str) -> Option<ParsedVolume> {
    let clean = spec.trim().trim_matches('\'').trim_matches('"');
    let parts: Vec<&str> = clean.split(':').collect();
    if parts.len() >= 2 {
        let host_path = parts[0].to_string();
        let container_path = parts[1].to_string();
        let mode = if parts.len() > 2 {
            Some(parts[2].to_string())
        } else {
            None
        };
        Some(ParsedVolume {
            host_path,
            container_path,
            mode,
            raw: spec.to_string(),
        })
    } else {
        None
    }
}

/// Parses environment key=value
pub fn parse_env_spec(spec: &str) -> (String, String) {
    let clean = spec.trim().trim_matches('\'').trim_matches('"');
    if let Some((k, v)) = clean.split_once('=') {
        (k.trim().to_string(), v.trim().to_string())
    } else {
        (clean.to_string(), String::new())
    }
}

/// Parses a `docker run` command into a structured service and compose YAML
pub fn parse_docker_run_command(cmd_str: &str) -> Result<ParsedDockerInput, String> {
    let tokens = tokenize_command(cmd_str);
    if tokens.is_empty() {
        return Err("Empty command".to_string());
    }

    let mut name = None;
    let mut image = None;
    let mut restart = None;
    let mut network = None;
    let mut privileged = false;
    let mut ports = Vec::new();
    let mut volumes = Vec::new();
    let mut environment = HashMap::new();
    let mut command_args = Vec::new();

    let mut i = 0;
    // Skip 'docker' and 'run' if present
    if i < tokens.len() && tokens[i] == "docker" {
        i += 1;
    }
    if i < tokens.len() && tokens[i] == "run" {
        i += 1;
    }

    while i < tokens.len() {
        let token = &tokens[i];

        if token == "--name" && i + 1 < tokens.len() {
            name = Some(tokens[i + 1].clone());
            i += 2;
        } else if token.starts_with("--name=") {
            name = Some(token["--name=".len()..].to_string());
            i += 1;
        } else if (token == "-p" || token == "--publish") && i + 1 < tokens.len() {
            if let Some(port) = parse_port_spec(&tokens[i + 1]) {
                ports.push(port);
            }
            i += 2;
        } else if token.starts_with("-p=") || token.starts_with("--publish=") {
            let val = token.split_once('=').map(|(_, v)| v).unwrap_or("");
            if let Some(port) = parse_port_spec(val) {
                ports.push(port);
            }
            i += 1;
        } else if (token == "-v" || token == "--volume") && i + 1 < tokens.len() {
            if let Some(vol) = parse_volume_spec(&tokens[i + 1]) {
                volumes.push(vol);
            }
            i += 2;
        } else if token.starts_with("-v=") || token.starts_with("--volume=") {
            let val = token.split_once('=').map(|(_, v)| v).unwrap_or("");
            if let Some(vol) = parse_volume_spec(val) {
                volumes.push(vol);
            }
            i += 1;
        } else if (token == "-e" || token == "--env") && i + 1 < tokens.len() {
            let (k, v) = parse_env_spec(&tokens[i + 1]);
            environment.insert(k, v);
            i += 2;
        } else if token.starts_with("-e=") || token.starts_with("--env=") {
            let val = token.split_once('=').map(|(_, v)| v).unwrap_or("");
            let (k, v) = parse_env_spec(val);
            environment.insert(k, v);
            i += 1;
        } else if token == "--restart" && i + 1 < tokens.len() {
            restart = Some(tokens[i + 1].clone());
            i += 2;
        } else if token.starts_with("--restart=") {
            restart = Some(token["--restart=".len()..].to_string());
            i += 1;
        } else if (token == "--network" || token == "--net") && i + 1 < tokens.len() {
            network = Some(tokens[i + 1].clone());
            i += 2;
        } else if token.starts_with("--network=") || token.starts_with("--net=") {
            let val = token.split_once('=').map(|(_, v)| v).unwrap_or("");
            network = Some(val.to_string());
            i += 1;
        } else if token == "--privileged" {
            privileged = true;
            i += 1;
        } else if token == "-d" || token == "-it" || token == "-i" || token == "-t" || token == "--rm" || token == "--detach" {
            // boolean flags to ignore/absorb
            i += 1;
        } else if token.starts_with('-') {
            // Option with argument or other flag
            if i + 1 < tokens.len() && !tokens[i + 1].starts_with('-') {
                i += 2; // skip flag + arg
            } else {
                i += 1;
            }
        } else {
            // Positional argument: first is image, rest are command args
            if image.is_none() {
                image = Some(token.clone());
                i += 1;
            } else {
                command_args.push(token.clone());
                i += 1;
            }
        }
    }

    let img = match image {
        Some(i) => i,
        None => return Err("No image specified in docker run command".to_string()),
    };

    // Derive app name from --name or image name (e.g. "nginx:alpine" -> "nginx")
    let app_name = match name {
        Some(n) => n,
        None => {
            let img_base = img.split('/').last().unwrap_or(&img);
            let raw_name = img_base.split(':').next().unwrap_or(img_base);
            raw_name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "-")
        }
    };

    let service = ParsedService {
        name: app_name.clone(),
        image: img.clone(),
        restart: restart.or_else(|| Some("unless-stopped".to_string())),
        ports,
        volumes,
        environment,
        command: if command_args.is_empty() { None } else { Some(command_args) },
        network,
        privileged,
    };

    let compose_yaml = generate_compose_yaml(&app_name, std::slice::from_ref(&service));

    Ok(ParsedDockerInput {
        input_type: "docker_run".to_string(),
        app_name,
        image: img,
        services: vec![service],
        compose_yaml,
    })
}

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
                        out.push_str(&format!("      - \"{}:{}/{}\"\n", hp, p.container_port, p.protocol));
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
                    out.push_str(&format!("      - \"{}:{}:{}\"\n", v.host_path, v.container_path, m));
                } else {
                    out.push_str(&format!("      - \"{}:{}\"\n", v.host_path, v.container_path));
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
    let parsed: Value = serde_yaml::from_str(yaml_str).map_err(|e| format!("YAML parse error: {}", e))?;

    let services_map = parsed.get("services")
        .and_then(|s| s.as_mapping())
        .ok_or_else(|| "Missing 'services' mapping in Docker Compose YAML".to_string())?;

    let mut services = Vec::new();
    let mut primary_app_name = String::new();
    let mut primary_image = String::new();

    for (k, v) in services_map {
        let svc_name = k.as_str().unwrap_or("service").to_string();
        let svc_map = v.as_mapping();

        let image = svc_map.and_then(|m| m.get(&Value::String("image".to_string())))
            .and_then(|img| img.as_str())
            .unwrap_or("")
            .to_string();

        let container_name = svc_map.and_then(|m| m.get(&Value::String("container_name".to_string())))
            .and_then(|cn| cn.as_str())
            .map(|cn| cn.to_string())
            .unwrap_or_else(|| svc_name.clone());

        let restart = svc_map.and_then(|m| m.get(&Value::String("restart".to_string())))
            .and_then(|r| r.as_str())
            .map(|r| r.to_string());

        let mut ports = Vec::new();
        if let Some(ports_seq) = svc_map.and_then(|m| m.get(&Value::String("ports".to_string()))).and_then(|p| p.as_sequence()) {
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
        if let Some(vols_seq) = svc_map.and_then(|m| m.get(&Value::String("volumes".to_string()))).and_then(|v| v.as_sequence()) {
            for vol in vols_seq {
                if let Some(v_str) = vol.as_str() {
                    if let Some(parsed_v) = parse_volume_spec(v_str) {
                        volumes.push(parsed_v);
                    }
                }
            }
        }

        let mut environment = HashMap::new();
        if let Some(env_val) = svc_map.and_then(|m| m.get(&Value::String("environment".to_string()))) {
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
        app_name: if primary_app_name.is_empty() { "compose-app".to_string() } else { primary_app_name },
        image: primary_image,
        services,
        compose_yaml: yaml_str.trim().to_string(),
    })
}

/// Automatically identifies if the input is a docker run command or docker compose YAML and parses it
pub fn parse_docker_command_or_compose(input: &str) -> Result<ParsedDockerInput, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Entrada vazia".to_string());
    }

    // Check if it looks like YAML compose
    if trimmed.starts_with("services:") || trimmed.starts_with("version:") || trimmed.contains("\nservices:") || trimmed.contains("services:\n") {
        return parse_docker_compose_yaml(trimmed);
    }

    // If it starts with docker run or has flags, parse as docker run
    if trimmed.starts_with("docker run") || trimmed.starts_with("docker compose") || trimmed.contains("-p ") || trimmed.contains("-v ") || trimmed.contains("-d ") {
        return parse_docker_run_command(trimmed);
    }

    // Attempt compose YAML first, then docker run as fallback
    if let Ok(compose_res) = parse_docker_compose_yaml(trimmed) {
        return Ok(compose_res);
    }

    parse_docker_run_command(trimmed)
}
