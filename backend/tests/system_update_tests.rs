use axum_test::TestServer;
use backend::system::{get_system_update_info, SystemUpdateInfo};
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
        &EncodingKey::from_secret(b"super_secret"),
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
async fn test_system_platform_detection() {
    let info = get_system_update_info().await;
    let expected_platform = backend::docker::get_host_platform();
    assert_eq!(info.platform, expected_platform);
    assert_eq!(info.arch, std::env::consts::ARCH);
}

#[tokio::test]
async fn test_system_update_endpoint_exists() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let app = backend::app();
    let server = TestServer::new(app);
    let cookie = get_test_cookie();

    let res = server.post("/api/system/update")
        .add_cookie(cookie)
        .await;
    // Status can be success (if docker is available) or a handled response, but NOT 404 Not Found
    assert_ne!(res.status_code(), axum::http::StatusCode::NOT_FOUND);
}

