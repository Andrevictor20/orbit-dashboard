use std::sync::Arc;
use bollard::Docker;

#[derive(Clone)]
pub struct AppState {
    pub docker: Arc<Docker>,
}
