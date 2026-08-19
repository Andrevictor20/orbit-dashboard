use axum::{
    routing::get,
    Router,
};
use axum::http::StatusCode;
use axum::body::Body;
use axum::http::Request;
use tower::ServiceExt; // for `call`, `oneshot`, and `ready`

// A trivial health check handler to prove the harness works
async fn health_check() -> StatusCode {
    StatusCode::OK
}

fn app() -> Router {
    Router::new().route("/health", get(health_check))
}

#[tokio::test]
async fn health_check_works() {
    let app = app();

    let response = app
        .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}
