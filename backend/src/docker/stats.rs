use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use futures::StreamExt;
use crate::state::AppState;
use super::types::ContainerSnapshot;

pub fn calculate_cpu_percent(
    cpu_usage_total: f64,
    precpu_usage_total: f64,
    system_cpu_usage: f64,
    presystem_cpu_usage: f64,
    online_cpus: f64,
) -> f64 {
    let cpu_delta = cpu_usage_total - precpu_usage_total;
    let system_delta = system_cpu_usage - presystem_cpu_usage;
    
    if system_delta > 0.0 && cpu_delta > 0.0 {
        (cpu_delta / system_delta) * online_cpus * 100.0
    } else {
        0.0
    }
}

pub fn calculate_memory_used(stats: &bollard::models::ContainerStatsResponse) -> u64 {
    let Some(mem) = &stats.memory_stats else {
        return 0;
    };
    let usage = mem.usage.unwrap_or(0);

    let cache = if let Some(stats_map) = &mem.stats {
        if let Some(&val) = stats_map.get("total_inactive_file") {
            if val > 0 { val } else { *stats_map.get("cache").unwrap_or(&0) }
        } else if let Some(&val) = stats_map.get("inactive_file") {
            val
        } else if let Some(&val) = stats_map.get("cache") {
            val
        } else {
            0
        }
    } else {
        0
    };

    usage.saturating_sub(cache)
}

pub async fn snapshot_stats(
    State(state): State<AppState>,
) -> impl IntoResponse {
    // Get all running containers
    let mut options = bollard::query_parameters::ListContainersOptions::default();
    options.all = false; // Only running
    
    let containers = match state.docker.list_containers(Some(options)).await {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to list").into_response(),
    };

    let futures = containers.into_iter().filter_map(|c| {
        let id = c.id?;
        let docker = state.docker.clone();
        Some(async move {
            let stats_options = bollard::query_parameters::StatsOptions {
                stream: false,
                ..Default::default()
            };
            let mut stream = docker.stats(&id, Some(stats_options));
            
            // Timeout after 2 seconds per container to avoid blocking the whole pipeline
            let stat_result = tokio::time::timeout(std::time::Duration::from_millis(2000), stream.next()).await;
            if let Ok(Some(Ok(stats))) = stat_result {
                let mut cpu_percent = 0.0;
                
                if let (Some(cpu), Some(precpu)) = (&stats.cpu_stats, &stats.precpu_stats) {
                    let cpu_usage_total = cpu.cpu_usage.as_ref().and_then(|u| u.total_usage).unwrap_or(0) as f64;
                    let precpu_usage_total = precpu.cpu_usage.as_ref().and_then(|u| u.total_usage).unwrap_or(0) as f64;
                    let system_cpu_usage = cpu.system_cpu_usage.unwrap_or(0) as f64;
                    let presystem_cpu_usage = precpu.system_cpu_usage.unwrap_or(0) as f64;
                    
                    let online_cpus = cpu.online_cpus.unwrap_or(
                        cpu.cpu_usage.as_ref().and_then(|u| u.percpu_usage.as_ref()).map(|v| v.len()).unwrap_or(1) as u32
                    ) as f64;

                    cpu_percent = calculate_cpu_percent(
                        cpu_usage_total,
                        precpu_usage_total,
                        system_cpu_usage,
                        presystem_cpu_usage,
                        online_cpus,
                    );
                }

                let memory_used = calculate_memory_used(&stats);
                let memory_limit = stats.memory_stats.as_ref().and_then(|m| m.limit).unwrap_or(0);

                Some(ContainerSnapshot {
                    id: id.chars().take(12).collect(),
                    cpu_percent,
                    memory_used,
                    memory_limit,
                })
            } else {
                None
            }
        })
    });

    let results = futures::future::join_all(futures).await;
    let snapshots: Vec<ContainerSnapshot> = results.into_iter().flatten().collect();

    (StatusCode::OK, Json(snapshots)).into_response()
}
