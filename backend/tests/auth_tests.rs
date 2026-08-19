use axum::{
    body::Body,
    http::{Request, StatusCode},
    routing::{get, post},
    Router,
};
use tower::ServiceExt;
use serde_json::json;
use http_body_util::BodyExt; // for collecting body bytes in test

// We will test 3 scenarios:
// 1. Invalid login
// 2. Valid login gives a token
// 3. Protected endpoint requires a valid token

#[tokio::test]
async fn test_invalid_login() {
    let app = backend::app(); // Assuming we export the router factory

    let body = serde_json::to_vec(&json!({
        "password": "wrong_password"
    })).unwrap();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/login")
                .header("content-type", "application/json")
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_protected_route_without_token() {
    let app = backend::app();

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/docker/containers") // A protected route we'll implement later
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
