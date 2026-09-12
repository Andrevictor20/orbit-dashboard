use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParsedPort {
    pub host_port: Option<u16>,
    pub container_port: u16,
    pub protocol: String,
    pub host_ip: Option<String>,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParsedVolume {
    pub host_path: String,
    pub container_path: String,
    pub mode: Option<String>,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParsedService {
    pub name: String,
    pub image: String,
    pub restart: Option<String>,
    pub ports: Vec<ParsedPort>,
    pub volumes: Vec<ParsedVolume>,
    pub environment: HashMap<String, String>,
    pub command: Option<Vec<String>>,
    pub network: Option<String>,
    pub privileged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedDockerInput {
    pub input_type: String, // "docker_run" | "docker_compose"
    pub app_name: String,
    pub image: String,
    pub services: Vec<ParsedService>,
    pub compose_yaml: String,
}
