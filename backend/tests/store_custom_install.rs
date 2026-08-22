use axum_test::TestServer;
use backend::app;
use serde_json::{json, Value};
use jsonwebtoken::{encode, Header, EncodingKey};
use backend::auth::Claims;
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
        &EncodingKey::from_secret(b"super_secret"),
    ).unwrap();
    
    axum_extra::extract::cookie::Cookie::new("auth_token", token)
}

#[tokio::test]
async fn test_custom_install_and_progress() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let server = TestServer::new(app());

    let auth_cookie = get_test_cookie();
    
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
