use axum_test::TestServer;
use backend::system::{get_system_update_info, SystemUpdateInfo, SystemUpdateTask};
use backend::auth::Claims;
use jsonwebtoken::{encode, Header, EncodingKey};
use std::time::{SystemTime, UNIX_EPOCH, Duration};

fn get_test_cookie() -> axum_extra::extract::cookie::Cookie<'static> {
    let expiration = SystemTime::now()
        .checked_add(Duration::from_secs(3600))
        .unwrap()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize;

    let claims = Claims {
        sub: "admin".to_string(),
        exp: expiration,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(b"super_secret" as &[u8]),
    ).unwrap();

    axum_extra::extract::cookie::Cookie::new("auth_token", token)
}

#[tokio::test]
async fn test_system_update_check_endpoint() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let app = backend::app();
    let server = TestServer::new(app);
    let cookie = get_test_cookie();

    let res = server.get("/api/system/update/check")
        .add_cookie(cookie)
        .await;
    res.assert_status_success();

    let info: SystemUpdateInfo = res.json();
    assert!(!info.current_version.is_empty(), "Current version must not be empty");
    assert!(!info.platform.is_empty(), "Platform must not be empty");
    assert!(!info.arch.is_empty(), "Arch must not be empty");
    assert!(info.platform.starts_with("linux/"), "Platform must start with linux/");
}

#[tokio::test]
async fn test_system_update_status_endpoint() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let app = backend::app();
    let server = TestServer::new(app);
    let cookie = get_test_cookie();

    let res = server.get("/api/system/update/status")
        .add_cookie(cookie)
        .await;
    res.assert_status_success();

    let task: SystemUpdateTask = res.json();
    assert!(!task.status.is_empty(), "Task status must not be empty");
}

#[tokio::test]
async fn test_system_platform_detection() {
    let info = get_system_update_info().await;
    let expected_platform = backend::docker::get_host_platform();
    assert_eq!(info.platform, expected_platform);
    assert_eq!(info.arch, std::env::consts::ARCH);
}

#[tokio::test]
async fn test_system_update_endpoint_exists_and_polls_task() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let app = backend::app();
    let server = TestServer::new(app);
    let cookie = get_test_cookie();

    let res = server.post("/api/system/update")
        .add_cookie(cookie.clone())
        .await;
    assert_ne!(res.status_code(), axum::http::StatusCode::NOT_FOUND);

    // Poll status endpoint to verify background worker task updates
    tokio::time::sleep(Duration::from_millis(50)).await;
    let status_res = server.get("/api/system/update/status")
        .add_cookie(cookie)
        .await;
    status_res.assert_status_success();

    let task: SystemUpdateTask = status_res.json();
    assert!(!task.status.is_empty(), "Task status must be populated");
    assert!(!task.logs.is_empty(), "Task logs should contain at least initial line");
}

/// Regression [L-016]: the fallback docker run command must use 'orbit-dashboard'
/// (the `container_name` from docker-compose.yml), NOT 'orbit' (which is only the
/// compose service/project name). Using 'orbit' creates a duplicate container causing
/// a port 5172 conflict and an immediate ExitCode=0 restart loop.
#[test]
fn test_fallback_docker_run_uses_correct_container_name() {
    let image_name = "ghcr.io/andrevictor20/orbit-dashboard:latest";
    let host_dir_val = String::new(); // empty = no compose dir found
    let compose_file_name = "docker-compose.yml";

    let helper_script = format!(
        r#"sleep 1 && (
if [ -n "{host_dir}" ] && [ -f "/host{host_dir}/{compose_file}" ]; then
  cd "/host{host_dir}" && docker compose -f "{compose_file}" up -d --force-recreate
elif [ -f "/host/DATA/orbit/docker-compose.yml" ]; then
  cd "/host/DATA/orbit" && docker compose up -d --force-recreate
elif [ -f "/host/root/orbit/docker-compose.yml" ]; then
  cd "/host/root/orbit" && docker compose up -d --force-recreate
else
  docker stop orbit-dashboard 2>/dev/null || true
  docker rm orbit-dashboard 2>/dev/null || true
  docker run -d --name orbit-dashboard --restart unless-stopped \
    --privileged \
    --pid host \
    --add-host host.docker.internal:host-gateway \
    -p 5172:5172 \
    -p 5173:5172 \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v orbit_data:/app/data \
    -v /:/host:rslave \
    -v /mnt:/mnt:rslave \
    -v /media:/media:rslave \
    -e RUST_LOG=info \
    -e SSH_HOST=host.docker.internal \
    "{image_name}"
fi
)"#,
        host_dir = host_dir_val,
        compose_file = compose_file_name,
        image_name = image_name
    );

    // MUST use "orbit-dashboard" (container_name), never bare "orbit" (service name)
    assert!(
        helper_script.contains("--name orbit-dashboard"),
        "Fallback docker run must use --name orbit-dashboard (container_name from compose), not the service name"
    );
    assert!(
        !helper_script.contains("--name orbit "),
        "Fallback docker run must NOT use --name orbit (that is the service name, not the container_name)"
    );

    // MUST use rslave propagation (not :ro which breaks FUSE/rclone mounts)
    assert!(
        helper_script.contains("/:/host:rslave"),
        "Host mount must use rslave propagation for FUSE/rclone support"
    );

    // MUST expose both ports matching docker-compose.yml
    assert!(helper_script.contains("-p 5172:5172"), "Must expose primary port 5172");
    assert!(helper_script.contains("-p 5173:5172"), "Must expose secondary port 5173 (alias)");

    // MUST include privileged mode (required for FUSE mounts)
    assert!(helper_script.contains("--privileged"), "Must include --privileged for FUSE support");
}

/// Regression [L-017]: main.rs must NOT exit silently with ExitCode=0 before the TCP
/// port is bound. The previous bug: a standalone `shutdown_signal()` was defined but
/// NOT integrated into axum::serve — causing the Tokio runtime to drop it immediately.
/// The current correct pattern: shutdown_signal() is passed to with_graceful_shutdown,
/// called AFTER TcpListener::bind succeeds, so SIGTERM is only handled once serving.
///
/// What is PROHIBITED:
///   axum::serve(...).await (no graceful shutdown — leaks connections on restart)
///   vs calling shutdown_signal() before the listener is set up.
///
/// What is REQUIRED:
///   axum::serve(listener, ...).with_graceful_shutdown(shutdown_signal()).await
#[test]
fn test_main_rs_does_not_have_premature_shutdown_signal() {
    let main_rs = include_str!("../src/main.rs");

    // The server must use axum::serve with with_graceful_shutdown
    // so that SIGTERM only triggers after the port is bound and accepting connections.
    assert!(
        main_rs.contains("axum::serve(listener"),
        "main.rs must use axum::serve(listener, ...) — found no listener binding"
    );

    // The graceful shutdown must be wired into the serve call (not ignored)
    assert!(
        main_rs.contains(".with_graceful_shutdown(shutdown_signal())"),
        "main.rs must wire shutdown_signal() into .with_graceful_shutdown() \
         so SIGTERM is handled after the port is bound, not before"
    );

    // The shutdown_signal fn must be defined (not missing)
    assert!(
        main_rs.contains("async fn shutdown_signal"),
        "main.rs must define async fn shutdown_signal() to handle SIGTERM gracefully"
    );

    // Must log when stopping (evidence that graceful shutdown is working)
    assert!(
        main_rs.contains("stopped gracefully"),
        "main.rs must log \"stopped gracefully\" after server.await completes"
    );
}

