use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt; // for `oneshot` and `ready`
use backend::app;
use jsonwebtoken::{encode, EncodingKey, Header};

fn valid_auth_cookie() -> String {
    let claims = backend::auth::Claims {
        sub: "admin".to_owned(),
        exp: 10_000_000_000,
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(backend::auth::get_jwt_secret()),
    ).unwrap();
    format!("auth_token={token}")
}

#[tokio::test]
async fn test_container_start_unauthorized() {
    let app = app();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/docker/containers/123/start")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// Note: Testing actual docker mutations requires mocking the Docker client or running against a real Docker daemon.
// For this MVP, we verify that the route exists and requires auth.

#[tokio::test]
async fn test_update_env_unauthorized() {
    let app = app();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/docker/containers/123/env")
                .header("Content-Type", "application/json")
                .body(Body::from(r#"{"env": ["TEST=1"]}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_update_env_rejects_invalid_payload_before_docker_mutation() {
    let app = app();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/docker/containers/123/env")
                .header("Content-Type", "application/json")
                .header("Cookie", valid_auth_cookie())
                .body(Body::from(r#"{"env": ["NOT_VALID"]}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_delete_container_with_cascade_params() {
    let app = app();

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/api/docker/containers/123?v=true&image=true&network=true")
                .header("Cookie", valid_auth_cookie())
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Will probably return 500 or 404 because container 123 doesn't exist in real docker daemon
    // The important thing is it doesn't return 400 Bad Request (query parsing error)
    assert_ne!(response.status(), StatusCode::BAD_REQUEST);
    assert_ne!(response.status(), StatusCode::UNAUTHORIZED);
}
