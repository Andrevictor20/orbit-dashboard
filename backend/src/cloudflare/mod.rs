pub mod client;
pub mod detector;
pub mod ingress;
pub mod matching;
pub mod models;
pub mod route_ops;
pub mod routes;
pub mod sync;

pub use client::{get_config, save_config, update_config, CloudflareClient};
pub use detector::detect_cloudflared;
pub use ingress::*;
pub use matching::*;
pub use models::*;
pub use routes::*;

use axum::{
    routing::{get, post},
    Router,
};

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/cloudflare/config",
            get(get_config_handler)
                .post(save_config_handler)
                .delete(delete_config_handler),
        )
        .route("/api/cloudflare/detect", get(detect_handler))
        .route("/api/cloudflare/tunnels", get(get_tunnels_handler))
        .route("/api/cloudflare/sync-links", post(sync_links_handler))
        .route("/api/cloudflare/test", post(test_connection_handler))
        .route(
            "/api/cloudflare/routes",
            post(create_route_handler).delete(delete_route_handler),
        )
}
