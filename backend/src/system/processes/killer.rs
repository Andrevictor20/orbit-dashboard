use axum::{
    extract::Path,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use super::models::KillProcessPayload;

const PROTECTED_PROCESS_NAMES: &[&str] = &[
    "init",
    "systemd",
    "systemd-journald",
    "systemd-resolved",
    "systemd-logind",
    "systemd-udevd",
    "sshd",
    "dockerd",
    "containerd",
    "containerd-shim",
    "containerd-shim-runc-v2",
    "NetworkManager",
    "orbit-backend",
    "orbit",
];

pub fn validate_process_termination(pid: u32) -> Result<(), (StatusCode, &'static str, Option<String>)> {
    if pid <= 1 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Não é permitido finalizar processos do sistema raiz (PID <= 1).",
            None,
        ));
    }

    if pid == std::process::id() {
        return Err((
            StatusCode::FORBIDDEN,
            "Não é permitido finalizar o processo do próprio Orbit.",
            None,
        ));
    }

    let proc_comm = std::fs::read_to_string(format!("/proc/{}/comm", pid))
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    if !proc_comm.is_empty() && PROTECTED_PROCESS_NAMES.iter().any(|&p| p.eq_ignore_ascii_case(&proc_comm)) {
        return Err((
            StatusCode::FORBIDDEN,
            "Não é permitido finalizar o processo protegido do sistema: '{}' (PID {}).",
            Some(proc_comm),
        ));
    }

    Ok(())
}

pub async fn kill_process_handler(
    Path(pid): Path<u32>,
    Json(payload): Json<Option<KillProcessPayload>>,
) -> impl IntoResponse {
    let sig_str = payload
        .and_then(|p| p.signal)
        .unwrap_or_else(|| "SIGTERM".to_string())
        .to_uppercase();

    let signal_num = match sig_str.as_str() {
        "SIGKILL" | "9" => libc::SIGKILL,
        "SIGINT" | "2" => libc::SIGINT,
        "SIGHUP" | "1" => libc::SIGHUP,
        _ => libc::SIGTERM,
    };

    if let Err((status, msg, opt_comm)) = validate_process_termination(pid) {
        let err_msg = if let Some(comm) = opt_comm {
            format!("Não é permitido finalizar o processo protegido do sistema: '{}' (PID {}).", comm, pid)
        } else {
            msg.to_string()
        };
        return (status, Json(json!({ "error": err_msg }))).into_response();
    }

    let res = unsafe { libc::kill(pid as libc::pid_t, signal_num) };
    if res == 0 {
        (
            StatusCode::OK,
            Json(json!({
                "message": format!("Sinal {} enviado com sucesso ao processo {}", sig_str, pid),
                "pid": pid,
                "success": true
            })),
        )
            .into_response()
    } else {
        let err = std::io::Error::last_os_error();
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "error": format!("Falha ao enviar sinal {} ao processo {}: {}", sig_str, pid, err),
                "pid": pid,
                "success": false
            })),
        )
            .into_response()
    }
}
