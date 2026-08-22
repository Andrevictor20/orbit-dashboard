use axum_test::TestServer;
use backend::app;
use serde_json::json;

#[tokio::test]
async fn test_custom_install_and_progress() {
    let server = TestServer::new(app());
    
    // Login to get the cookie
    let mut login_response = server.post("/api/auth/login")
        .json(&json!({"username": "admin", "password": "admin"}))
        .await;
    
    login_response.assert_status_ok();
    let auth_cookie = login_response.cookie("auth_token");
    
    // 1. GET /api/store/apps to find first app id
    let response = server.get("/api/store/apps")
        .add_cookie(auth_cookie.clone())
        .await;
    response.assert_status_ok();
    
    let apps: serde_json::Value = response.json();
    let first_app_id = apps.as_array()
        .expect("Expected JSON array")
        .get(0)
        .expect("Expected at least one app in the store")
        .get("id")
        .expect("Expected app to have an id")
        .as_str()
        .expect("Expected id to be a string");
        
    // 2. POST /api/store/install/custom/:id
    let custom_payload = json!({
        "env": {
            "TZ": "America/Sao_Paulo",
            "PUID": "1001"
        },
        "ports": [
            { "host": 8080, "container": 80, "protocol": "tcp" }
        ],
        "volumes": [
            { "host": "/DATA/AppData/test", "container": "/config" }
        ]
    });
    
    let install_response = server.post(&format!("/api/store/install/custom/{}", first_app_id))
        .add_cookie(auth_cookie.clone())
        .json(&custom_payload)
        .await;
        
    // Should be Accepted (202) for background processing
    install_response.assert_status(reqwest::StatusCode::ACCEPTED);
    
    let task_response: serde_json::Value = install_response.json();
    let task_id = task_response.get("task_id")
        .expect("Expected task_id in response")
        .as_str()
        .expect("Task id should be string");
        
    // 3. GET /api/store/install/status/:task_id
    let status_response = server.get(&format!("/api/store/install/status/{}", task_id))
        .add_cookie(auth_cookie.clone())
        .await;
        
    status_response.assert_status_ok();
    let status: serde_json::Value = status_response.json();
    
    assert!(status.get("status").is_some(), "Expected status field");
    assert!(status.get("progress").is_some(), "Expected progress field");
}
