pub mod auth;
pub mod docker;

use axum::{
    routing::{get, post},
    Router,
};
use axum::http::StatusCode;
use std::sync::Arc;
use bollard::Docker;

pub fn app() -> Router {
    let docker = match Docker::connect_with_local_defaults() {
        Ok(d) => d,
        Err(_) => {
            // For testing environments without docker, we just instantiate a dummy HTTP docker.
            // A real app might fail to start here.
            Docker::connect_with_http_defaults().unwrap()
        }
    };

    let state = docker::AppState {
        docker: Arc::new(docker),
    };

    let protected_routes = Router::new()
        .route("/api/docker/containers", get(docker::list_containers))
        .layer(axum::middleware::from_fn(auth::require_auth))
        .with_state(state.clone());

    Router::new()
        .route("/health", get(|| async { StatusCode::OK }))
        .route("/api/login", post(auth::login))
        .merge(protected_routes)
}

