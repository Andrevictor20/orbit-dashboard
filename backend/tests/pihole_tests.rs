use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt;
use http_body_util::BodyExt;

fn get_valid_token() -> String {
    use jsonwebtoken::{encode, Header, EncodingKey};
    let claims = backend::auth::Claims {
        sub: "admin".to_owned(),
        exp: 10000000000,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(backend::auth::get_jwt_secret()),
    ).unwrap()
}

#[tokio::test]
async fn test_pihole_unauthenticated_rejected() {
    let app = backend::app();

    let endpoints = vec![
        ("GET", "/api/pihole/config"),
        ("GET", "/api/pihole/stats"),
        ("POST", "/api/pihole/blocking"),
        ("GET", "/api/pihole/domains"),
    ];

    for (method, uri) in endpoints {
        let response = app.clone()
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(uri)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            StatusCode::UNAUTHORIZED,
            "Expected 401 for unauthenticated request to {} {}",
            method,
            uri
        );
    }
}

#[tokio::test]
async fn test_pihole_config_endpoints() {
    let app = backend::app();
    let token = get_valid_token();

    // 1. Authenticated GET when not configured
    let response = app.clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/pihole/config")
                .header("Cookie", format!("auth_token={}", token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let val: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(val.get("configured").is_some());

    // 2. POST with invalid URL (e.g. ftp:// or bad format)
    let invalid_post = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/pihole/config")
                .header("Cookie", format!("auth_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::json!({
                    "url": "ftp://my-pihole.local",
                    "token": "some-token"
                }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(invalid_post.status(), StatusCode::BAD_REQUEST);

    // 3. DELETE configuration endpoint
    let delete_response = app.clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/api/pihole/config")
                .header("Cookie", format!("auth_token={}", token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(delete_response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_pihole_stats_and_blocking_when_unconfigured() {
    let app = backend::app();
    let token = get_valid_token();

    // Ensure deleted
    let _ = app.clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/api/pihole/config")
                .header("Cookie", format!("auth_token={}", token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // GET /api/pihole/stats when unconfigured should return 400 Bad Request
    let stats_res = app.clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/pihole/stats")
                .header("Cookie", format!("auth_token={}", token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(stats_res.status(), StatusCode::BAD_REQUEST);

    // POST /api/pihole/blocking when unconfigured should return 400 Bad Request
    let block_res = app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/pihole/blocking")
                .header("Cookie", format!("auth_token={}", token))
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::json!({
                    "enable": true
                }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(block_res.status(), StatusCode::BAD_REQUEST);

    // GET /api/pihole/domains when unconfigured should return 400 Bad Request
    let domains_res = app.clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/pihole/domains")
                .header("Cookie", format!("auth_token={}", token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(domains_res.status(), StatusCode::BAD_REQUEST);
}
