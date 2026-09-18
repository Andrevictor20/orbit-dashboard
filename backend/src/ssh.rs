use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::sync::{Arc, Mutex};
use std::thread;
use std::io::{Read, Write};
use std::net::ToSocketAddrs;
use tokio::sync::mpsc;
use futures::{sink::SinkExt, stream::StreamExt};
use serde::Deserialize;

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
struct InitMessage {
    #[serde(alias = "username")]
    user: Option<String>,
    #[serde(alias = "password")]
    pass: Option<String>,
    host: Option<String>,
    port: Option<u16>,
    cols: Option<u16>,
    rows: Option<u16>,
    #[serde(alias = "type")]
    msg_type: Option<String>,
    mode: Option<String>,
}

pub async fn terminal_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

fn is_executable_in_path(cmd: &str) -> bool {
    if let Ok(paths) = std::env::var("PATH") {
        for path in std::env::split_paths(&paths) {
            let p = path.join(cmd);
            if p.is_file() {
                return true;
            }
        }
    }
    false
}

pub fn get_docker_gateway_ip() -> Option<String> {
    if let Ok(content) = std::fs::read_to_string("/proc/net/route") {
        for line in content.lines().skip(1) {
            let fields: Vec<&str> = line.split_whitespace().collect();
            if fields.len() >= 3 && fields[1] == "00000000" {
                if let Ok(gw_hex) = u32::from_str_radix(fields[2], 16) {
                    if gw_hex != 0 {
                        // gw_hex is little-endian in /proc/net/route on x86/ARM
                        let b0 = (gw_hex & 0xFF) as u8;
                        let b1 = ((gw_hex >> 8) & 0xFF) as u8;
                        let b2 = ((gw_hex >> 16) & 0xFF) as u8;
                        let b3 = ((gw_hex >> 24) & 0xFF) as u8;
                        return Some(format!("{}.{}.{}.{}", b0, b1, b2, b3));
                    }
                }
            }
        }
    }
    None
}

pub fn resolve_ssh_target_host(custom_host: Option<String>, port: u16) -> String {
    if let Some(h) = custom_host {
        let trimmed = h.trim();
        // If the user specified a custom external IP or hostname that is NOT localhost/127.0.0.1, use it!
        if !trimmed.is_empty() 
            && trimmed != "localhost" 
            && trimmed != "127.0.0.1" 
            && trimmed != "0.0.0.0" 
            && trimmed != "::1" 
        {
            return trimmed.to_string();
        }
    }

    let mut candidates: Vec<String> = Vec::new();

    // 1. SSH_HOST env var if set
    if let Ok(env_host) = std::env::var("SSH_HOST") {
        let trimmed = env_host.trim();
        if !trimmed.is_empty() && trimmed != "localhost" && trimmed != "127.0.0.1" {
            candidates.push(trimmed.to_string());
        }
    }

    // 2. host.docker.internal
    candidates.push("host.docker.internal".to_string());

    // 3. Docker container gateway IP from /proc/net/route
    if let Some(gw) = get_docker_gateway_ip() {
        if !candidates.contains(&gw) {
            candidates.push(gw);
        }
    }

    // 4. Common Docker bridge gateways
    for fallback_ip in &["172.17.0.1", "172.18.0.1", "172.19.0.1", "172.20.0.1", "172.21.0.1", "172.22.0.1"] {
        let ip_str = fallback_ip.to_string();
        if !candidates.contains(&ip_str) {
            candidates.push(ip_str);
        }
    }

    // 5. Bare-metal localhost / 127.0.0.1 (if running directly on host)
    candidates.push("127.0.0.1".to_string());
    candidates.push("localhost".to_string());

    // Probe candidates via fast TCP connect (300ms timeout) to see which one has SSH port open!
    for candidate in &candidates {
        let addr_str = format!("{}:{}", candidate, port);
        if let Ok(addrs) = addr_str.to_socket_addrs() {
            for addr in addrs {
                if std::net::TcpStream::connect_timeout(&addr, std::time::Duration::from_millis(300)).is_ok() {
                    tracing::info!("[SSH] Probed and selected reachable SSH host '{}' ({}) on port {}", candidate, addr, port);
                    return candidate.clone();
                }
            }
        }
    }

    // If no TCP probe succeeded, pick the most appropriate default candidate
    if let Ok(env_host) = std::env::var("SSH_HOST") {
        let trimmed = env_host.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    if let Some(gw) = get_docker_gateway_ip() {
        return gw;
    }

    "host.docker.internal".to_string()
}

async fn handle_socket(socket: WebSocket) {
    let (mut sender, mut receiver) = socket.split();

    // 1. Wait for Init message
    let mut init_msg: Option<InitMessage> = None;
    tracing::debug!("Awaiting WebSocket init message...");
    if let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            match serde_json::from_str::<InitMessage>(&text) {
                Ok(m) => {
                    tracing::debug!("Terminal init message: user={:?}, mode={:?}", m.user, m.mode);
                    init_msg = Some(m);
                }
                Err(e) => {
                    tracing::warn!("Failed to parse Terminal init message: {}", e);
                }
            }
        }
    } else {
        tracing::debug!("WebSocket closed before init message");
    }

    let init_msg = match init_msg {
        Some(m) => m,
        None => InitMessage {
            user: None,
            pass: None,
            host: Some("localhost".to_string()),
            port: Some(22),
            cols: Some(80),
            rows: Some(24),
            msg_type: None,
            mode: Some("local".to_string()),
        },
    };

    let cols = init_msg.cols.unwrap_or(100).max(10).min(500);
    let rows = init_msg.rows.unwrap_or(30).max(5).min(200);
    let port = init_msg.port.unwrap_or(22);

    let is_explicit_ssh = init_msg.mode.as_deref() == Some("ssh");
    let has_ssh_creds = init_msg.user.as_ref().map(|u| !u.trim().is_empty()).unwrap_or(false)
        && init_msg.pass.as_ref().map(|p| !p.is_empty()).unwrap_or(false);

    let is_local = (!is_explicit_ssh && !has_ssh_creds)
        || init_msg.mode.as_deref() == Some("local")
        || init_msg.mode.as_deref() == Some("internal");

    // 2. Setup command based on Init message
    let (cmd, target_host_display) = if is_local {
        // Internal local shell execution
        let shell = std::env::var("SHELL").unwrap_or_else(|_| {
            if is_executable_in_path("bash") {
                "bash".to_string()
            } else {
                "sh".to_string()
            }
        });
        tracing::info!("[Terminal] Spawning internal shell: {}", shell);

        let mut builder = CommandBuilder::new(&shell);
        builder.env("TERM", "xterm-256color");
        builder.env("COLORTERM", "truecolor");
        if let Ok(path) = std::env::var("PATH") {
            builder.env("PATH", path);
        }
        if let Ok(home) = std::env::var("HOME") {
            builder.env("HOME", home);
        }
        if let Ok(pwd) = std::env::current_dir() {
            builder.cwd(pwd);
        }
        (builder, "Saturn Host (internal shell)".to_string())
    } else if let (Some(user), Some(pass)) = (init_msg.user, init_msg.pass) {
        if !is_executable_in_path("sshpass") {
            let err_json = serde_json::json!({
                "type": "error",
                "message": "sshpass não encontrado no container para conexão SSH"
            });
            let _ = sender.send(Message::Text(err_json.to_string().into())).await;
            return;
        }

        let ssh_host = resolve_ssh_target_host(init_msg.host, port);
        tracing::info!("[SSH] Connecting to {}@{} on port {}", user, ssh_host, port);

        let mut builder = CommandBuilder::new("sshpass");
        builder.arg("-p");
        builder.arg(pass);
        builder.arg("ssh");
        builder.arg("-p");
        builder.arg(port.to_string());
        builder.arg("-o");
        builder.arg("StrictHostKeyChecking=no");
        builder.arg("-o");
        builder.arg("UserKnownHostsFile=/dev/null");
        builder.arg("-o");
        builder.arg("LogLevel=ERROR");
        builder.arg("-o");
        builder.arg("ConnectTimeout=10");
        builder.arg(format!("{}@{}", user, ssh_host));
        (builder, format!("{}:{}", ssh_host, port))
    } else {
        let err_json = serde_json::json!({
            "type": "error",
            "message": "Credenciais ausentes para conexão SSH"
        });
        let _ = sender.send(Message::Text(err_json.to_string().into())).await;
        return;
    };

    let pty_system = native_pty_system();
    
    // Create a new pty with initial dimensions from client
    let pair = match pty_system.openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }) {
        Ok(p) => p,
        Err(e) => {
            let err_json = serde_json::json!({
                "type": "error",
                "message": format!("Falha ao inicializar PTY: {}", e)
            });
            let _ = sender.send(Message::Text(err_json.to_string().into())).await;
            return;
        }
    };

    // Spawn the child process
    let _child = match pair.slave.spawn_command(cmd) {
        Ok(c) => c,
        Err(e) => {
            let err_json = serde_json::json!({
                "type": "error",
                "message": format!("Falha ao iniciar processo do shell: {}", e)
            });
            let _ = sender.send(Message::Text(err_json.to_string().into())).await;
            return;
        }
    };

    // Drop the slave side in the parent process so that the master reader 
    // will see EOF when the child process exits.
    drop(pair.slave);

    let mut reader = match pair.master.try_clone_reader() {
        Ok(r) => r,
        Err(_) => return,
    };
    let writer = match pair.master.take_writer() {
        Ok(w) => w,
        Err(_) => return,
    };

    let master = Arc::new(Mutex::new(pair.master));
    let writer = Arc::new(Mutex::new(writer));

    // Notify frontend that connection is established (both JSON and banner output)
    let connected_json = serde_json::json!({
        "type": "connected",
        "data": format!("\x1b[1;32mConectado com sucesso!\x1b[0m \x1b[1;30m({})\x1b[0m\r\n", target_host_display)
    });
    let _ = sender.send(Message::Text(connected_json.to_string().into())).await;

    let (tx, mut rx) = mpsc::channel::<String>(256);

    // Thread to read from PTY and send to WS
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let s = String::from_utf8_lossy(&buf[..n]).to_string();
                    if tx.blocking_send(s).is_err() {
                        break;
                    }
                }
                _ => break, // EOF or error
            }
        }
    });

    let master_clone = master.clone();
    let writer_clone = writer.clone();

    // Tokio task to forward messages from PTY to WS
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let out_json = serde_json::json!({
                "type": "output",
                "data": msg
            });
            if sender.send(Message::Text(out_json.to_string().into())).await.is_err() {
                break;
            }
        }
    });

    // Tokio task to forward WS messages to PTY / handle resize
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    // Try parsing as JSON control message
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(msg_type) = val.get("type").and_then(|t| t.as_str()) {
                            if msg_type == "input" {
                                if let Some(data) = val.get("data").and_then(|d| d.as_str()) {
                                    if let Ok(mut w) = writer_clone.lock() {
                                        let _ = w.write_all(data.as_bytes());
                                        let _ = w.flush();
                                    }
                                }
                                continue;
                            } else if msg_type == "resize" {
                                let cols = val.get("cols").and_then(|c| c.as_u64()).map(|c| c as u16);
                                let rows = val.get("rows").and_then(|r| r.as_u64()).map(|r| r as u16);
                                if let (Some(c), Some(r)) = (cols, rows) {
                                    if let Ok(m) = master_clone.lock() {
                                        let _ = m.resize(PtySize {
                                            rows: r.max(5).min(500),
                                            cols: c.max(10).min(1000),
                                            pixel_width: 0,
                                            pixel_height: 0,
                                        });
                                    }
                                }
                                continue;
                            }
                        }

                        if val.get("cols").is_some() && val.get("rows").is_some() {
                            let cols = val.get("cols").and_then(|c| c.as_u64()).map(|c| c as u16);
                            let rows = val.get("rows").and_then(|r| r.as_u64()).map(|r| r as u16);
                            if let (Some(c), Some(r)) = (cols, rows) {
                                if let Ok(m) = master_clone.lock() {
                                    let _ = m.resize(PtySize {
                                        rows: r.max(5).min(500),
                                        cols: c.max(10).min(1000),
                                        pixel_width: 0,
                                        pixel_height: 0,
                                    });
                                }
                            }
                            continue;
                        }
                    }

                    // Direct raw terminal input fallback
                    if let Ok(mut w) = writer_clone.lock() {
                        let _ = w.write_all(text.as_bytes());
                        let _ = w.flush();
                    }
                }
                Message::Binary(bin) => {
                    if let Ok(mut w) = writer_clone.lock() {
                        let _ = w.write_all(&bin);
                        let _ = w.flush();
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };
}

