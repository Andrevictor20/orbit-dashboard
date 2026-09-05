use backend::docker::ContainerSnapshot;

#[test]
fn test_container_snapshot_serialization() {
    let snapshot = ContainerSnapshot {
        id: "123456789012".to_string(),
        cpu_percent: 50.5,
        memory_used: 1024,
        memory_limit: 2048,
        size_rw: Some(512),
        size_root_fs: Some(10240),
    };
    let json = serde_json::to_string(&snapshot).unwrap();
    assert!(json.contains("123456789012"));
    assert!(json.contains("50.5"));
    assert!(json.contains("512"));
    assert!(json.contains("10240"));
}

#[test]
fn test_calculate_memory_used_real_json() {
    let raw = r#"{
        "memory_stats": {
            "usage": 64851968,
            "stats": {
                "active_anon": 53374976,
                "inactive_file": 8028160
            },
            "limit": 18712801280
        }
    }"#;
    let stats: bollard::models::ContainerStatsResponse = serde_json::from_str(raw).unwrap();
    let mem = backend::docker::calculate_memory_used(&stats);
    assert_eq!(mem, 64851968 - 8028160);
}

#[test]
fn test_calculate_memory_used_fallback_when_inactive_exceeds_usage() {
    use std::collections::HashMap;

    // When inactive_file >= usage, should return usage rather than zeroing out
    let mut stats_map = HashMap::new();
    stats_map.insert("inactive_file".to_string(), 1024 * 1024 * 100);
    let stats = bollard::models::ContainerStatsResponse {
        memory_stats: Some(bollard::models::ContainerMemoryStats {
            usage: Some(1024 * 1024 * 80),
            stats: Some(stats_map),
            ..Default::default()
        }),
        ..Default::default()
    };
    let mem = backend::docker::calculate_memory_used(&stats);
    assert_eq!(mem, 1024 * 1024 * 80);
}

#[test]
fn test_calculate_memory_used_fallback_when_usage_is_zero() {
    use std::collections::HashMap;

    // When usage is 0 (e.g. cgroups memory disabled), check anon + active_file
    let mut stats_map = HashMap::new();
    stats_map.insert("anon".to_string(), 1024 * 1024 * 45);
    stats_map.insert("active_file".to_string(), 1024 * 1024 * 5);
    let stats = bollard::models::ContainerStatsResponse {
        memory_stats: Some(bollard::models::ContainerMemoryStats {
            usage: Some(0),
            stats: Some(stats_map),
            ..Default::default()
        }),
        ..Default::default()
    };
    let mem = backend::docker::calculate_memory_used(&stats);
    assert_eq!(mem, 1024 * 1024 * 50);
}

