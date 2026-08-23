use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

pub fn get_jwt_secret() -> &'static [u8] {
    static SECRET: OnceLock<Vec<u8>> = OnceLock::new();
    SECRET.get_or_init(|| {
        // Fallback for tests or explicit override
        if let Ok(key) = std::env::var("JWT_SECRET") {
            return key.into_bytes();
        }

        let secret_path = std::path::Path::new("data/jwt.secret");
        if secret_path.exists() {
            match std::fs::read_to_string(secret_path) {
                Ok(key) if !key.trim().is_empty() => return key.trim().to_string().into_bytes(),
                _ => tracing::warn!("Failed to read existing data/jwt.secret, generating new one"),
            }
        }

        // Generate a new secure random secret using UUIDs
        let new_key = format!("{}{}", uuid::Uuid::new_v4(), uuid::Uuid::new_v4()).replace("-", "");
        
        let _ = std::fs::create_dir_all("data");
        if let Err(e) = std::fs::write(secret_path, &new_key) {
            tracing::error!("Failed to save JWT secret to {:?}: {}", secret_path, e);
        } else {
            tracing::info!("Generated new JWT secret and saved to {:?}", secret_path);
        }
        
        new_key.into_bytes()
    }).as_slice()
}
