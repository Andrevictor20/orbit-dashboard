pub mod types;
pub mod stats;
pub mod containers;
pub mod images;
pub mod networks;
pub mod volumes;
pub mod exec;

pub use types::*;
pub use stats::*;
pub use containers::*;
pub use images::*;
pub use networks::*;
pub use volumes::*;
pub use exec::*;
pub use crate::state::AppState;

use axum::{
    routing::{delete, get, post},
    Router,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/docker/containers", get(list_containers))
        .route("/api/docker/containers/{id}", get(inspect_container).delete(delete_container))
        .route("/api/docker/containers/{id}/logs", get(container_logs))
        .route("/api/docker/containers/{id}/env", post(update_container_env))
        .route("/api/docker/containers/{id}/volumes", post(update_container_volumes))
        .route("/api/docker/containers/{id}/update", post(update_container))
        .route("/api/docker/containers/{id}/check-update", get(check_single_container_update))
        .route("/api/docker/containers/check-updates", get(check_container_updates))
        .route("/api/docker/containers/{id}/exec", get(container_exec_ws))
        .route("/api/docker/containers/{id}/{action}", post(container_action))
        .route("/api/docker/containers/stats/snapshot", get(snapshot_stats))
        .route("/api/docker/images", get(list_images))
        .route("/api/docker/images/{id}", delete(delete_image))
        .route("/api/docker/images/prune", post(prune_images))
        .route("/api/docker/builder/prune", post(prune_builder))
        .route("/api/docker/networks", get(list_networks))
        .route("/api/docker/networks/{id}", delete(delete_network))
        .route("/api/docker/networks/prune", post(prune_networks))
        .route("/api/docker/volumes", get(list_volumes))
        .route("/api/docker/volumes/{name}", delete(delete_volume))
        .route("/api/docker/volumes/prune", post(prune_volumes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_env_entry() {
        // Valid cases
        assert!(valid_env_entry("KEY=value"));
        assert!(valid_env_entry("KEY=")); // Empty value is allowed
        assert!(valid_env_entry("MY_VAR_123=something"));
        assert!(valid_env_entry("_HIDDEN=123")); // Underscore prefix is allowed
        assert!(valid_env_entry("A=b=c")); // Multiple equals is allowed, split is on first

        // Invalid cases
        assert!(!valid_env_entry("=value")); // Empty key
        assert!(!valid_env_entry("123KEY=value")); // Starts with digit
        assert!(!valid_env_entry("KEY-1=value")); // Invalid char in key
        assert!(!valid_env_entry("NO_EQUALS")); // Missing =
    }

    #[test]
    fn test_calculate_cpu_percent() {
        // Normal case
        let pct = calculate_cpu_percent(200.0, 100.0, 1000.0, 500.0, 2.0);
        assert_eq!(pct, 40.0);

        // Negative CPU delta
        assert_eq!(calculate_cpu_percent(100.0, 200.0, 1000.0, 500.0, 2.0), 0.0);

        // Zero CPU delta
        assert_eq!(calculate_cpu_percent(100.0, 100.0, 1000.0, 500.0, 2.0), 0.0);
    }

    #[test]
    fn test_calculate_memory_used() {
        use std::collections::HashMap;

        // None memory_stats
        let empty_stats = bollard::models::ContainerStatsResponse {
            memory_stats: None,
            ..Default::default()
        };
        assert_eq!(calculate_memory_used(&empty_stats), 0);

        // Usage without cache
        let raw_stats = bollard::models::ContainerStatsResponse {
            memory_stats: Some(bollard::models::ContainerMemoryStats {
                usage: Some(1024 * 1024 * 100),
                stats: None,
                ..Default::default()
            }),
            ..Default::default()
        };
        assert_eq!(calculate_memory_used(&raw_stats), 1024 * 1024 * 100);

        // cgroup v1 with total_inactive_file
        let mut map_v1 = HashMap::new();
        map_v1.insert("total_inactive_file".to_string(), 1024 * 1024 * 30);
        map_v1.insert("cache".to_string(), 1024 * 1024 * 30);
        let v1_stats = bollard::models::ContainerStatsResponse {
            memory_stats: Some(bollard::models::ContainerMemoryStats {
                usage: Some(1024 * 1024 * 100),
                stats: Some(map_v1),
                ..Default::default()
            }),
            ..Default::default()
        };
        assert_eq!(calculate_memory_used(&v1_stats), 1024 * 1024 * 70);

        // cgroup v2 with inactive_file
        let mut map_v2 = HashMap::new();
        map_v2.insert("inactive_file".to_string(), 1024 * 1024 * 40);
        let v2_stats = bollard::models::ContainerStatsResponse {
            memory_stats: Some(bollard::models::ContainerMemoryStats {
                usage: Some(1024 * 1024 * 100),
                stats: Some(map_v2),
                ..Default::default()
            }),
            ..Default::default()
        };
        assert_eq!(calculate_memory_used(&v2_stats), 1024 * 1024 * 60);
    }

    #[test]
    fn test_parse_image_ref() {
        let (reg, repo, tag) = parse_image_ref("nginx:alpine");
        assert_eq!(reg, "registry-1.docker.io");
        assert_eq!(repo, "library/nginx");
        assert_eq!(tag, "alpine");

        let (reg, repo, tag) = parse_image_ref("linuxserver/qbittorrent:latest");
        assert_eq!(reg, "registry-1.docker.io");
        assert_eq!(repo, "linuxserver/qbittorrent");
        assert_eq!(tag, "latest");

        let (reg, repo, tag) = parse_image_ref("ghcr.io/andrevmp/orbit:latest");
        assert_eq!(reg, "ghcr.io");
        assert_eq!(repo, "andrevmp/orbit");
        assert_eq!(tag, "latest");

        let (reg, repo, tag) = parse_image_ref("redis");
        assert_eq!(reg, "registry-1.docker.io");
        assert_eq!(repo, "library/redis");
        assert_eq!(tag, "latest");
    }

    #[test]
    fn test_get_host_platform() {
        let platform = get_host_platform();
        assert!(platform.starts_with("linux/"));
    }
}
