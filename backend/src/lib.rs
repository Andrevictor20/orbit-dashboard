pub mod auth;
pub mod docker;
pub mod files;
pub mod homeassistant;
pub mod links;
pub mod logs;
pub mod ssh;
pub mod state;
pub mod store;
pub mod system;
pub mod ws;

pub use state::AppState;

use axum::{
    http::{header, HeaderName, HeaderValue, Method, StatusCode},
    routing::get,
    Json,
    Router,
};
use bollard::Docker;
use std::sync::Arc;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use tower_http::set_header::SetResponseHeaderLayer;

pub fn app() -> Router {
    let socket_path = std::env::var("DOCKER_HOST")
        .ok()
        .and_then(|h| h.strip_prefix("unix://").map(|s| s.to_string()))
        .unwrap_or_else(|| "/var/run/docker.sock".to_string());

    let docker = match Docker::connect_with_socket(&socket_path, 900, bollard::API_DEFAULT_VERSION) {
        Ok(d) => d,
        Err(e) => {
            tracing::warn!("Failed to connect with socket (timeout 900s): {}, trying socket defaults", e);
            Docker::connect_with_socket_defaults().unwrap_or_else(|e2| {
                tracing::warn!("Failed to connect with socket defaults: {}, trying local defaults", e2);
                Docker::connect_with_local_defaults().unwrap()
            })
        }
    };

    let state = AppState {
        docker: Arc::new(docker),
    };

    // Start background stats collector immediately so metrics history is populated continuously
    ws::ensure_stats_collector(state.docker.clone());

    let system_routes = Router::new()
        .route("/api/docker/links", get(links::get_links))
        .route("/api/docker/links/{id}", axum::routing::post(links::set_link))
        .route("/api/docker/stats", get(ws::stats_handler))
        .route("/api/docker/stats/history", get(ws::get_stats_history_handler))
        .route("/api/ssh", get(ssh::terminal_handler));

    let protected_routes = Router::new()
        .merge(docker::router())
        .merge(store::router())
        .merge(files::protected_router())
        .merge(system::router())
        .merge(homeassistant::router())
        .merge(system_routes)
        .layer(axum::middleware::from_fn(auth::require_auth))
        .with_state(state);

    Router::new()
        .route("/health", get(|| async { 
            (
                StatusCode::OK, 
                Json(serde_json::json!({
                    "status": "ok",
                    "version": system::get_app_version(),
                    "arch": std::env::consts::ARCH
                }))
            ) 
        }))
        .route("/api/logs", get(logs::get_logs))
        .route("/api/logs/clear", axum::routing::post(logs::clear_logs))
        .merge(auth::public_router())
        .merge(files::public_router())
        .merge(protected_routes)
        .layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::predicate(|_, _| true))
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::OPTIONS,
                    Method::PUT,
                    Method::DELETE,
                ])
                .allow_headers([header::AUTHORIZATION, header::ACCEPT, header::CONTENT_TYPE])
                .allow_credentials(true),
        )
        // Adicionando Security Headers (X-Frame-Options SAMEORIGIN e CSP com frame/object-src)
        .layer(SetResponseHeaderLayer::overriding(
            header::X_FRAME_OPTIONS,
            header::HeaderValue::from_static("SAMEORIGIN"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("content-security-policy"),
            HeaderValue::from_static(
                "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com data:; img-src 'self' data: https: blob:; media-src 'self' blob: data:; frame-src 'self' blob: data:; object-src 'self' blob: data:; frame-ancestors 'self'; connect-src 'self' ws: wss:;",
            ),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("strict-transport-security"),
            HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .fallback_service(
            ServeDir::new("public").not_found_service(ServeFile::new("public/index.html")),
        )
        // Cache-Control estrito: index.html e rotas SPA nunca em cache; assets imutáveis
        .layer(axum::middleware::from_fn(spa_cache_control_middleware))
}

async fn spa_cache_control_middleware(
    req: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let path = req.uri().path().to_string();
    let mut response = next.run(req).await;

    if path.starts_with("/assets/") {
        response.headers_mut().insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=31536000, immutable"),
        );
    } else if path == "/" || path.ends_with(".html") || !path.contains('.') {
        // Rotas SPA e index.html nunca devem ser retidos em cache de disco pelo navegador
        response.headers_mut().insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("no-cache, no-store, must-revalidate, max-age=0"),
        );
        response.headers_mut().insert(
            header::PRAGMA,
            HeaderValue::from_static("no-cache"),
        );
        response.headers_mut().insert(
            header::EXPIRES,
            HeaderValue::from_static("0"),
        );
    }

    response
}
