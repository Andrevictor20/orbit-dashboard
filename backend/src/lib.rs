pub mod auth;
pub mod docker;
pub mod ws;
pub mod ssh;
pub mod links;
pub mod store;
pub mod logs;

use axum::{
    routing::{get, post, delete, put},
    Router,
    http::Method,
};
use axum::http::StatusCode;
use std::sync::Arc;
use bollard::Docker;
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::cors::{CorsLayer, AllowOrigin};
use tower_http::services::{ServeDir, ServeFile};
use axum::http::{header, HeaderValue, HeaderName};

pub fn app() -> Router {
    let docker = match Docker::connect_with_local_defaults() {
        Ok(d) => d,
        Err(_) => Docker::connect_with_socket_defaults().unwrap(),
    };

    let state = docker::AppState {
        docker: Arc::new(docker),
    };

    let protected_routes = Router::new()
        .route("/api/docker/containers", get(docker::list_containers))
        .route("/api/docker/containers/{id}", get(docker::inspect_container).delete(docker::delete_container))
        .route("/api/docker/containers/{id}/logs", get(docker::container_logs))
        .route("/api/docker/containers/{id}/env", post(docker::update_container_env))
        .route("/api/docker/containers/{id}/volumes", post(docker::update_container_volumes))
        .route("/api/docker/containers/{id}/exec", get(docker::container_exec_ws))
        .route("/api/docker/containers/{id}/{action}", post(docker::container_action))
        .route("/api/docker/containers/stats/snapshot", get(docker::snapshot_stats))
        .route("/api/docker/images", get(docker::list_images))
        .route("/api/docker/images/{id}", delete(docker::delete_image))
        .route("/api/docker/images/prune", post(docker::prune_images))
        .route("/api/docker/networks", get(docker::list_networks))
        .route("/api/docker/networks/{id}", delete(docker::delete_network))
        .route("/api/docker/networks/prune", post(docker::prune_networks))
        .route("/api/docker/volumes", get(docker::list_volumes))
        .route("/api/docker/volumes/{name}", delete(docker::delete_volume))
        .route("/api/docker/volumes/prune", post(docker::prune_volumes))
        .route("/api/docker/links", get(links::get_links))
        .route("/api/docker/links/{id}", post(links::set_link))
        .route("/api/docker/stats", get(ws::stats_handler))
        .route("/api/ssh", get(ssh::terminal_handler))
        .route("/api/store/apps", get(store::list_apps))
        .route("/api/store/install/{id}", post(store::install_app))
        .route("/api/store/install/custom/{id}", post(store::install_custom_app))
        .route("/api/store/install/status/{task_id}", get(store::install_status))
        .route("/api/store/uninstall/{id}", post(store::uninstall_app))
        .route("/api/store/update/{id}", post(store::update_app))
        .layer(axum::middleware::from_fn(auth::require_auth))
        .with_state(state.clone());

    Router::new()
        .route("/health", get(|| async { StatusCode::OK }))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/status", get(auth::status))
        .route("/api/auth/setup", post(auth::setup))
        .route("/api/auth/password", put(auth::change_password))
        .route("/api/auth/me", get(auth::me))
        .route("/api/logs", get(logs::get_logs))
        .merge(protected_routes)
        .layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::predicate(|_, _| true))
                .allow_methods([Method::GET, Method::POST, Method::OPTIONS, Method::PUT, Method::DELETE])
                .allow_headers([header::AUTHORIZATION, header::ACCEPT, header::CONTENT_TYPE])
                .allow_credentials(true)
        )
        // Adicionando Security Headers (X-Frame-Options e X-Content-Type-Options)
        .layer(SetResponseHeaderLayer::overriding(
            header::X_FRAME_OPTIONS,
            header::HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("content-security-policy"),
            HeaderValue::from_static("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' wss:;"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("strict-transport-security"),
            HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .fallback_service(ServeDir::new("public").not_found_service(ServeFile::new("public/index.html")))
}
