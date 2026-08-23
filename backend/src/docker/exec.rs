use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::IntoResponse,
};
use bollard::exec::{CreateExecOptions, StartExecResults};
use bollard::Docker;
use futures::sink::SinkExt;
use futures::StreamExt;
use std::sync::Arc;
use crate::state::AppState;

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
                    if let Message::Text(text) = msg {
                        use tokio::io::AsyncWriteExt;
                        let _ = input.write_all(text.as_bytes()).await;
                    } else if let Message::Binary(bin) = msg {
                        use tokio::io::AsyncWriteExt;
                        let _ = input.write_all(&bin).await;
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
