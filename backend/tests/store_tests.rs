use axum_test::TestServer;
use backend::app;
use serde_json::json;

#[tokio::test]
async fn test_store_endpoints_exist() {
    let server = TestServer::new(app());
    
    // Login to get the cookie
    let login_response = server.post("/api/auth/login")
        .json(&json!({"username": "admin", "password": "admin"}))
        .await;
    
    login_response.assert_status_ok();
    let auth_cookie = login_response.cookie("auth_token");
    
    // 1. GET /api/store/apps
    let response = server.get("/api/store/apps")
        .add_cookie(auth_cookie.clone())
        .await;
    
    response.assert_status_ok();
    
    // Parse the JSON response to get the first app's ID
    let apps: serde_json::Value = response.json();
    let first_app_id = apps.as_array()
        .expect("Expected JSON array")
        .get(0)
        .expect("Expected at least one app in the store")
        .get("id")
        .expect("Expected app to have an id")
        .as_str()
        .expect("Expected id to be a string");
    
    // 2. POST /api/store/install/:id
    let response = server.post(&format!("/api/store/install/{}", first_app_id))
        .add_cookie(auth_cookie.clone())
        .await;
        
    response.assert_status(axum::http::StatusCode::ACCEPTED);
    
    // 3. POST /api/store/uninstall/:id
    let response = server.post(&format!("/api/store/uninstall/{}", first_app_id))
        .add_cookie(auth_cookie.clone())
        .await;
        
    response.assert_status(axum::http::StatusCode::NOT_FOUND);
}
