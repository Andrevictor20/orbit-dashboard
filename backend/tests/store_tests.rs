use axum_test::TestServer;
use backend::app;
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
async fn test_store_endpoints_exist() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let server = TestServer::new(app());
    
    let auth_cookie = get_test_cookie();
    
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
    assert!(response.status_code() == axum::http::StatusCode::NOT_FOUND || response.status_code() == axum::http::StatusCode::OK);

    // 4. POST /api/store/sync
    let response = server.post("/api/store/sync")
        .add_cookie(auth_cookie.clone())
        .await;
        
    response.assert_status_ok();
}
