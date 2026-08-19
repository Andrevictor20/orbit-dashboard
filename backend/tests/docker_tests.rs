use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt;
use http_body_util::BodyExt; // For testing response bodies
use axum_extra::extract::cookie::Cookie;

// We need a helper to get a valid token to bypass auth.
fn get_valid_token() -> String {
    use jsonwebtoken::{encode, Header, EncodingKey};
    let claims = backend::auth::Claims {
        sub: "admin".to_owned(),
        exp: 10000000000,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(b"super_secret_key_change_me_in_prod"),
    ).unwrap()
}

#[tokio::test]
async fn test_docker_containers_endpoint() {
    let app = backend::app();
    let token = get_valid_token();

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/docker/containers")
                .header("Cookie", format!("auth_token={}", token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    
    // Check if body is valid JSON array (or at least valid JSON)
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let value: serde_json::Value = serde_json::from_slice(&body).unwrap();
    
    // It should be an array of containers
    assert!(value.is_array(), "Response should be a JSON array of containers");
}
