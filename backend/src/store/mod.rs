pub mod types;
pub mod parser;
pub mod catalog;
pub mod installer;

pub use types::*;
pub use parser::*;
pub use catalog::*;
pub use installer::*;

use axum::{
    routing::{get, post},
    Router,
};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/store/apps", get(list_apps))
        .route("/api/store/sync", post(sync_apps))
        .route("/api/store/install/{id}", post(install_app))
        .route("/api/store/install/custom/{id}", post(install_custom_app))
        .route("/api/store/install/status/{task_id}", get(install_status))
        .route("/api/store/uninstall/{id}", post(uninstall_app))
        .route("/api/store/update/{id}", post(update_app))
}
