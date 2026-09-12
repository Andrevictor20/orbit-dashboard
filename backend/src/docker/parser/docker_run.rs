use std::collections::HashMap;

use super::compose::generate_compose_yaml;
use super::models::{ParsedDockerInput, ParsedPort, ParsedService, ParsedVolume};

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
        } else if token == "-d"
            || token == "-it"
            || token == "-i"
            || token == "-t"
            || token == "--rm"
            || token == "--detach"
        {
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
        command: if command_args.is_empty() {
            None
        } else {
            Some(command_args)
        },
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
