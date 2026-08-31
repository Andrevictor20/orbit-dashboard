use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::IntoResponse,
};
use bollard::exec::{CreateExecOptions, ResizeExecOptions, StartExecResults};
use bollard::Docker;
use futures::sink::SinkExt;
use futures::StreamExt;
use serde::Deserialize;
use std::sync::Arc;
use crate::state::AppState;

#[derive(Deserialize, Debug)]
struct ControlMessage {
    #[serde(rename = "type")]
    #[allow(dead_code)]
    msg_type: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
}

pub async fn container_exec_ws(
    State(state): State<AppState>,
    Path(id): Path<String>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_exec_socket(socket, state.docker, id))
}

async fn handle_exec_socket(socket: WebSocket, docker: Arc<Docker>, id: String) {
    let (mut sender, mut receiver) = socket.split();

    // 1. Create Exec
    let exec_options = CreateExecOptions {
        attach_stdout: Some(true),
        attach_stderr: Some(true),
        attach_stdin: Some(true),
        tty: Some(true),
        cmd: Some(vec!["/bin/sh".to_string()]), // Default to sh, usually available
        ..Default::default()
    };

    let exec = match docker.create_exec(&id, exec_options).await {
        Ok(e) => e,
        Err(err) => {
            let _ = sender.send(Message::Text(format!("Failed to create exec: {}", err).into())).await;
            return;
        }
    };

    // 2. Start Exec
    let start_options = bollard::exec::StartExecOptions {
        detach: false,
        tty: true,
        output_capacity: None,
    };

    let exec_id = exec.id.clone();
    let docker_for_resize = docker.clone();

    match docker.start_exec(&exec.id, Some(start_options)).await {
        Ok(StartExecResults::Attached { mut output, mut input }) => {
            // Forward from Docker to WebSocket
            let mut send_task = tokio::spawn(async move {
                while let Some(Ok(msg)) = output.next().await {
                    let text = msg.to_string();
                    if sender.send(Message::Text(text.into())).await.is_err() {
                        break;
                    }
                }
            });

            // Forward from WebSocket to Docker
            let mut recv_task = tokio::spawn(async move {
                while let Some(Ok(msg)) = receiver.next().await {
                    match msg {
                        Message::Text(text) => {
                            if text.starts_with('{') && text.contains("cols") && text.contains("rows") {
                                if let Ok(ctrl) = serde_json::from_str::<ControlMessage>(&text) {
                                    if let (Some(c), Some(r)) = (ctrl.cols, ctrl.rows) {
                                        let _ = docker_for_resize.resize_exec(
                                            &exec_id,
                                            ResizeExecOptions {
                                                height: r,
                                                width: c,
                                            },
                                        ).await;
                                        continue;
                                    }
                                }
                            }
                            use tokio::io::AsyncWriteExt;
                            let _ = input.write_all(text.as_bytes()).await;
                            let _ = input.flush().await;
                        }
                        Message::Binary(bin) => {
                            use tokio::io::AsyncWriteExt;
                            let _ = input.write_all(&bin).await;
                            let _ = input.flush().await;
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
        },
        Ok(StartExecResults::Detached) => {
            let _ = sender.send(Message::Text("Exec started detached".into())).await;
        },
        Err(err) => {
            let _ = sender.send(Message::Text(format!("Failed to start exec: {}", err).into())).await;
        }
    }
}
