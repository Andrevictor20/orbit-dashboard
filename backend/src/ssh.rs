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
struct InitMessage {
    user: Option<String>,
    pass: Option<String>,
    host: Option<String>,
    port: Option<u16>,
    cols: Option<u16>,
    rows: Option<u16>,
}

#[derive(Deserialize, Debug)]
struct ControlMessage {
    #[serde(rename = "type")]
    #[allow(dead_code)]
    msg_type: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
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

fn resolve_default_ssh_host(custom_host: Option<String>) -> String {
    if let Some(h) = custom_host {
        let trimmed = h.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    if let Ok(h) = std::env::var("SSH_HOST") {
        let trimmed = h.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    // Try resolving host.docker.internal first
    if ("host.docker.internal", 22).to_socket_addrs().is_ok() {
        return "host.docker.internal".to_string();
    }

    // Fallback 1: Docker default bridge gateway
    if ("172.17.0.1", 22).to_socket_addrs().is_ok() {
        return "172.17.0.1".to_string();
    }

    // Fallback 2: 127.0.0.1
    "127.0.0.1".to_string()
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
                    tracing::debug!("SSH init: user={:?}", m.user);
                    init_msg = Some(m);
                }
                Err(e) => {
                    tracing::warn!("Failed to parse SSH init message: {}", e);
                }
            }
        }
    } else {
        tracing::debug!("WebSocket closed before init message");
    }

    let init_msg = match init_msg {
        Some(m) => m,
        None => {
            let _ = sender.send(Message::Text("Invalid or missing init message\r\n".into())).await;
            return;
        }
    };

    let cols = init_msg.cols.unwrap_or(100).max(10).min(500);
    let rows = init_msg.rows.unwrap_or(30).max(5).min(200);
    let port = init_msg.port.unwrap_or(22);

    // 2. Setup command based on Init message
    let cmd = if let (Some(user), Some(pass)) = (init_msg.user, init_msg.pass) {
        if !is_executable_in_path("sshpass") {
            let _ = sender.send(Message::Text("Error: sshpass not found in container image\r\n".into())).await;
            return;
        }

        let ssh_host = resolve_default_ssh_host(init_msg.host);

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
        builder
    } else {
        let _ = sender.send(Message::Text("Missing credentials for SSH\r\n".into())).await;
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
            let _ = sender.send(Message::Text(format!("Failed to open PTY: {}\r\n", e).into())).await;
            return;
        }
    };

    // Spawn the child process
    let _child = match pair.slave.spawn_command(cmd) {
        Ok(c) => c,
        Err(e) => {
            let _ = sender.send(Message::Text(format!("Failed to spawn shell: {}\r\n", e).into())).await;
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

    // Notify frontend we are connected
    let _ = sender.send(Message::Text("\x1b[1;32mConnected!\x1b[0m\r\n".into())).await;

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
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Tokio task to forward WS messages to PTY / handle resize
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    // Check if this is a resize control message
                    if text.starts_with('{') && text.contains("cols") && text.contains("rows") {
                        if let Ok(ctrl) = serde_json::from_str::<ControlMessage>(&text) {
                            if let (Some(c), Some(r)) = (ctrl.cols, ctrl.rows) {
                                if let Ok(m) = master_clone.lock() {
                                    let _ = m.resize(PtySize {
                                        rows: r.max(5).min(500),
                                        cols: c.max(10).min(1000),
                                        pixel_width: 0,
                                        pixel_height: 0,
                                    });
                                }
                                continue;
                            }
                        }
                    }

                    // Regular terminal input
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
