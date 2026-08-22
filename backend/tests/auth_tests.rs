use axum_test::TestServer;
use backend::app;
use serde_json::json;

// We will test 3 scenarios:
// 1. Invalid login
// 2. Valid login gives a token
// 3. Protected endpoint requires a valid token

#[tokio::test]
async fn test_invalid_login() {
    let server = TestServer::new(app());

    let response = server.post("/api/auth/login")
        .json(&json!({
            "username": "wrong_user",
            "password": "wrong_password"
        }))
        .await;

    response.assert_status_unauthorized();
}

#[tokio::test]
async fn test_protected_route_without_token() {
    let server = TestServer::new(app());

    let response = server.get("/api/docker/containers").await;

    response.assert_status_unauthorized();
}
