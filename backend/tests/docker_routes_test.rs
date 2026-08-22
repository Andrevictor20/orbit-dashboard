use backend::docker::ContainerSnapshot;

#[test]
fn test_container_snapshot_serialization() {
    let snapshot = ContainerSnapshot {
        id: "123456789012".to_string(),
        cpu_percent: 50.5,
        memory_used: 1024,
        memory_limit: 2048,
    };
    let json = serde_json::to_string(&snapshot).unwrap();
    assert!(json.contains("123456789012"));
    assert!(json.contains("50.5"));
}
