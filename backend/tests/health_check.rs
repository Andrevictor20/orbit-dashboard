use axum::http::StatusCode;
use axum::body::Body;
use axum::http::Request;
use tower::ServiceExt; // for `call`, `oneshot`, and `ready`

#[tokio::test]
async fn health_check_works() {
    let app = backend::app();

    let response = app
        .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}
