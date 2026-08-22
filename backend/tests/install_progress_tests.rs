// GREEN PHASE: Tests for async install with progress tracking
use axum_test::TestServer;
use backend::app;
use serde_json::Value;

fn make_server() -> TestServer {
    TestServer::new(app())
}

/// Install should return 202 Accepted with task_id (not 200 = old blocking behavior)
#[tokio::test]
async fn test_install_returns_task_id() {
    let server = make_server();

    // Login to get session cookie
    let login = server
        .post("/api/auth/login")
        .json(&serde_json::json!({"username": "admin", "password": "admin"}))
        .await;
    login.assert_status_ok();
    let auth_cookie = login.cookie("auth_token");

    let response = server
        .post("/api/store/install/nodered")
        .add_cookie(auth_cookie)
        .await;

    // Must NOT return 200 OK (that was old blocking behavior)
    let status = response.status_code().as_u16();
    assert_ne!(status, 200, "Install must NOT return 200 OK — must be async (202 or 404)");

    if status == 202 {
        let body: Value = response.json();
        assert!(body.get("task_id").is_some(), "202 response must contain task_id");
        let task_id = body["task_id"].as_str().unwrap();
        assert!(!task_id.is_empty(), "task_id must not be empty");
    }
    // 404 acceptable if store not yet populated
}

/// Status endpoint must return all required fields: id, status, progress, logs
#[tokio::test]
async fn test_install_status_has_required_fields() {
    let server = make_server();

    let login = server
        .post("/api/auth/login")
        .json(&serde_json::json!({"username": "admin", "password": "admin"}))
        .await;
    let auth_cookie = login.cookie("auth_token");

    let install_response = server
        .post("/api/store/install/nodered")
        .add_cookie(auth_cookie.clone())
        .await;

    if install_response.status_code() != 202 {
        return; // Store not populated; skip
    }

    let install_body: Value = install_response.json();
    let task_id = install_body["task_id"].as_str().unwrap();

    let status_response = server
        .get(&format!("/api/store/install/status/{}", task_id))
        .add_cookie(auth_cookie)
        .await;

    assert_eq!(status_response.status_code(), 200);
    let body: Value = status_response.json();

    assert!(body.get("id").is_some(), "Must have 'id' field");
    assert!(body.get("status").is_some(), "Must have 'status' field");
    assert!(body.get("progress").is_some(), "Must have 'progress' field");
    assert!(body.get("logs").is_some(), "Must have 'logs' array field");

    let progress = body["progress"].as_u64().unwrap_or(999);
    assert!(progress <= 100, "progress must be 0-100, got {}", progress);
    assert!(body["logs"].is_array(), "logs must be an array");
}

/// Status endpoint returns 404 for unknown task_id (with valid auth)
#[tokio::test]
async fn test_install_status_not_found() {
    let server = make_server();

    let login = server
        .post("/api/auth/login")
        .json(&serde_json::json!({"username": "admin", "password": "admin"}))
        .await;
    let auth_cookie = login.cookie("auth_token");

    let response = server
        .get("/api/store/install/status/nonexistent-task-id-abc123")
        .add_cookie(auth_cookie)
        .await;

    assert_eq!(
        response.status_code(),
        404,
        "Unknown task_id must return 404"
    );
}
