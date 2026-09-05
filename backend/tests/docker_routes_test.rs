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

#[test]
fn test_calculate_memory_used_legacy_cache() {
    use std::collections::HashMap;

    let mut stats_map = HashMap::new();
    stats_map.insert("cache".to_string(), 1024 * 1024 * 10);
    let stats = bollard::models::ContainerStatsResponse {
        memory_stats: Some(bollard::models::ContainerMemoryStats {
            usage: Some(1024 * 1024 * 50),
            stats: Some(stats_map),
            ..Default::default()
        }),
        ..Default::default()
    };
    let mem = backend::docker::calculate_memory_used(&stats);
    assert_eq!(mem, 1024 * 1024 * 40);
}

#[test]
fn test_calculate_memory_used_total_rss_fallback() {
    use std::collections::HashMap;

    let mut stats_map = HashMap::new();
    stats_map.insert("total_rss".to_string(), 1024 * 1024 * 30);
    stats_map.insert("total_active_file".to_string(), 1024 * 1024 * 10);
    let stats = bollard::models::ContainerStatsResponse {
        memory_stats: Some(bollard::models::ContainerMemoryStats {
            usage: Some(0),
            stats: Some(stats_map),
            ..Default::default()
        }),
        ..Default::default()
    };
    let mem = backend::docker::calculate_memory_used(&stats);
    assert_eq!(mem, 1024 * 1024 * 40);
}

#[tokio::test]
async fn test_resolve_container_memory_real_docker() {
    if let Ok(docker) = bollard::Docker::connect_with_socket_defaults() {
        // 1. Validar comportamento gracioso com ID de container inexistente (garante execução em runners de CI vazios)
        let empty_stats = bollard::models::ContainerStatsResponse {
            memory_stats: Some(bollard::models::ContainerMemoryStats {
                usage: Some(0),
                stats: None,
                limit: Some(0),
                ..Default::default()
            }),
            ..Default::default()
        };
        let (fallback_used, fallback_limit) = backend::docker::resolve_container_memory(&docker, "nonexistent-container-ci-test", &empty_stats).await;
        assert_eq!(fallback_used, 0, "Container inexistente deve retornar 0 de uso de memória com segurança");
        assert!(fallback_limit > 0, "Limite de memória deve adotar fallback do host meminfo > 0, obteve {}", fallback_limit);

        // 2. Caso haja qualquer container em execução no ambiente de teste, validar a resolução real e o fallback
        let mut list_opts = bollard::query_parameters::ListContainersOptions::default();
        list_opts.all = false;
        if let Ok(containers) = docker.list_containers(Some(list_opts)).await {
            if let Some(target) = containers.first() {
                if let Some(id) = &target.id {
                    let stats_options = bollard::query_parameters::StatsOptions {
                        stream: false,
                        ..Default::default()
                    };
                    use futures::StreamExt;
                    let mut stream = docker.stats(id, Some(stats_options));
                    if let Some(Ok(stats)) = stream.next().await {
                        let (mem_used, mem_limit) = backend::docker::resolve_container_memory(&docker, id, &stats).await;
                        assert!(mem_limit > 0, "Esperado memory_limit resolvido > 0, obteve {}", mem_limit);
                        let _ = mem_used;
                    }

                    // Testar o fallback de processos contra o container real ativo
                    let (live_fallback_used, live_fallback_limit) = backend::docker::resolve_container_memory(&docker, id, &empty_stats).await;
                    assert!(live_fallback_limit > 0, "Esperado memory_limit do host > 0, obteve {}", live_fallback_limit);
                    let _ = live_fallback_used;
                }
            }
        }
    }
}




