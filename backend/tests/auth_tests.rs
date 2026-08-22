use axum_test::TestServer;
use backend::app;
use serde_json::json;
use std::fs;

#[tokio::test]
async fn test_auth_flow() {
    // 0. Clean up any existing file before test to ensure clean state
    let _ = fs::remove_file("data/orbit_auth.json");

    unsafe {
        std::env::set_var("JWT_SECRET", "super_secret");
    }
    
    let server = TestServer::new(app());

    // 1. Check status (should need setup)
    let status_res = server.get("/api/auth/status").await;
    status_res.assert_status_success();
    let status_json: serde_json::Value = status_res.json();
    assert_eq!(status_json["needs_setup"], true);

    // 2. Setup the user
    let setup_res = server.post("/api/auth/setup")
        .json(&json!({
            "username": "admin",
            "password": "admin_password"
        }))
        .await;
    setup_res.assert_status_success();
    let setup_cookie = setup_res.cookie("auth_token");
    assert!(setup_cookie.value().len() > 10, "Should generate a valid JWT token");

    // 3. Status should now be needs_setup: false
    let status_res2 = server.get("/api/auth/status").await;
    let status_json2: serde_json::Value = status_res2.json();
    assert_eq!(status_json2["needs_setup"], false);

    // 4. Test login with correct password
    let login_res = server.post("/api/auth/login")
        .json(&json!({
            "username": "admin",
            "password": "admin_password"
        }))
        .await;
    login_res.assert_status_success();

    // 5. Test invalid login
    let invalid_login = server.post("/api/auth/login")
        .json(&json!({
            "username": "admin",
            "password": "wrong_password"
        }))
        .await;
    invalid_login.assert_status_unauthorized();

    // 6. Test protected route without token
    let protected = server.get("/api/docker/containers").await;
    protected.assert_status_unauthorized();

    // 7. Test protected route with token (me)
    let me_res = server.get("/api/auth/me")
        .add_cookie(login_res.cookie("auth_token").clone())
        .await;
    me_res.assert_status_success();
    
    // 8. Test change password with WRONG current password
    let change_fail = server.put("/api/auth/password")
        .add_cookie(login_res.cookie("auth_token").clone())
        .json(&json!({
            "current_password": "wrong_password",
            "new_password": "new_admin_password"
        }))
        .await;
    change_fail.assert_status_unauthorized();

    // 9. Test change password with CORRECT current password
    let change_success = server.put("/api/auth/password")
        .add_cookie(login_res.cookie("auth_token").clone())
        .json(&json!({
            "current_password": "admin_password",
            "new_password": "new_admin_password"
        }))
        .await;
    change_success.assert_status_success();

    // 10. Login with NEW password should work
    let login_new = server.post("/api/auth/login")
        .json(&json!({
            "username": "admin",
            "password": "new_admin_password"
        }))
        .await;
    login_new.assert_status_success();

    // Clean up
    let _ = fs::remove_file("data/orbit_auth.json");
}
