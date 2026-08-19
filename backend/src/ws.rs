use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
};
use sysinfo::System;
use std::time::Duration;
use serde::Serialize;
use tokio::time;

#[derive(Serialize)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_used: u64,
    pub memory_total: u64,
}

pub async fn stats_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    let mut sys = System::new_all();
    
    // Refresh interval
    let mut interval = time::interval(Duration::from_secs(2));

    loop {
        // Wait for the next tick
        interval.tick().await;

        sys.refresh_cpu_usage();
        sys.refresh_memory();

        let cpu_usage = sys.global_cpu_usage();
        let memory_used = sys.used_memory();
        let memory_total = sys.total_memory();

        let stats = SystemStats {
            cpu_usage,
            memory_used,
            memory_total,
        };

        let msg = match serde_json::to_string(&stats) {
            Ok(j) => j,
            Err(_) => continue,
        };

        if socket.send(Message::Text(msg.into())).await.is_err() {
            // Client disconnected
            println!("Client disconnected from stats WebSocket");
            break;
        }
    }
}
