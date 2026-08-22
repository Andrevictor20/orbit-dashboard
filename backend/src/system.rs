use axum::{Json, http::StatusCode};
use serde_json::Value;
use std::process::Command;
use std::env;

pub async fn update_orbit() -> Result<Json<Value>, StatusCode> {
    let host_path = env::var("HOST_PROJECT_PATH").unwrap_or_else(|_| "/home/andrevmp/Downloads/Orbit".to_string());
    
    // Fire and forget tokio spawn because the compose up will kill our own container!
    tokio::spawn(async move {
        tracing::info!("Starting Orbit system update via Docker...");
        
        let output = Command::new("docker")
            .arg("run")
            .arg("--rm")
            .arg("-v")
            .arg("/var/run/docker.sock:/var/run/docker.sock")
            .arg("-v")
            .arg(format!("{}:{}", host_path, host_path))
            .arg("-w")
            .arg(&host_path)
            .arg("docker:cli")
            .arg("sh")
            .arg("-c")
            // Update the source code via git pull, then rebuild and recreate
            .arg("git pull && docker compose up --build -d")
            .output();
            
        match output {
            Ok(out) => {
                tracing::info!("Update command stdout: {}", String::from_utf8_lossy(&out.stdout));
                tracing::info!("Update command stderr: {}", String::from_utf8_lossy(&out.stderr));
            }
            Err(e) => {
                tracing::error!("Failed to run update command: {}", e);
            }
        }
    });

    Ok(Json(serde_json::json!({
        "message": "Update initiated. System will restart shortly.",
        "version": "latest"
    })))
}
