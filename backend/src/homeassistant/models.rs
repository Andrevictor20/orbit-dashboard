use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct HomeAssistantConfig {
    pub url: String,
    pub token: String,
    pub enabled: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ConfigResponse {
    pub configured: bool,
    pub connected: bool,
    pub url: String,
    pub version: Option<String>,
    pub location_name: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SaveConfigRequest {
    pub url: String,
    pub token: String,
}

// Cache 1: Entidades enriquecidas prontas para envio (TTL curto: 4s)
pub struct CachedEntities {
    pub data: serde_json::Value,
    pub timestamp: Instant,
}

// Cache 2: Mapeamento de metadados de áreas e dispositivos resolvidos (TTL longo: 180s / 3 minutos)
pub struct CachedMeta {
    pub mapping: HashMap<String, (String, String)>,
    pub timestamp: Instant,
}
