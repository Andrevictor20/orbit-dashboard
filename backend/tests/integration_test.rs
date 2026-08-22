use axum_test::TestServer;
use backend::app;
use serde_json::json;

#[tokio::test]
async fn test_health_check() {
    let server = TestServer::new(app());
    let response = server.get("/health").await;
    
    response.assert_status_ok();
}

#[tokio::test]
async fn test_protected_routes_require_auth() {
    let server = TestServer::new(app());
    
    // Trying to access protected route without cookie should yield 401
    let response = server.get("/api/docker/containers").await;
    response.assert_status_unauthorized();
}

#[tokio::test]
async fn test_delete_container_endpoint_mapping() {
    let server = TestServer::new(app());
    
    // First, login to get the cookie
    let login_response = server.post("/api/auth/login")
        .json(&json!({"username": "admin", "password": "admin"}))
        .await;
    
    login_response.assert_status_ok();
    let auth_cookie = login_response.cookie("auth_token");
    
    // With cookie, send DELETE to a dummy container ID
    // Note: since this is an integration test connecting to the real Docker socket,
    // if the container doesn't exist, it should return an error (probably 500 or 404 from Docker itself),
    // but the Axum router MUST route it to the right handler and NOT return 405 Method Not Allowed or 404 Not Found from Axum.
    let response = server.delete("/api/docker/containers/non_existent_container_id_for_test")
        .add_cookie(auth_cookie)
        .await;
    
    // Since we don't mock bollard, it will hit real docker and fail to find the container.
    // Docker returns 404 which bollard turns into an Err, and our handler returns 500 INTERNAL_SERVER_ERROR.
    // As long as it is NOT 401 Unauthorized and NOT 405 Method Not Allowed, the routing is correct.
    assert_eq!(response.status_code(), 500);
}
