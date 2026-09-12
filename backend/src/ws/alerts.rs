use super::models::SystemStats;
use crate::system::alerts::{get_current_timestamp, push_alert_if_needed, SystemAlert};

pub fn evaluate_and_push_alerts(stats: &SystemStats) {
    if stats.cpu_usage > 90.0 {
        push_alert_if_needed(SystemAlert {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: get_current_timestamp(),
            level: "critical".to_string(),
            title: "Alto Consumo de CPU".to_string(),
            message: format!("O consumo de CPU do host atingiu {:.1}%.", stats.cpu_usage),
            source: "metrics".to_string(),
        });
    }

    let memory_percent = (stats.memory_used as f64 / stats.memory_total.max(1) as f64) * 100.0;
    if memory_percent > 90.0 {
        push_alert_if_needed(SystemAlert {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: get_current_timestamp(),
            level: "critical".to_string(),
            title: "Alto Consumo de RAM".to_string(),
            message: format!("O uso de memória RAM está em {:.1}%.", memory_percent),
            source: "metrics".to_string(),
        });
    }

    if stats.temperature > 80.0 {
        push_alert_if_needed(SystemAlert {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: get_current_timestamp(),
            level: "warning".to_string(),
            title: "Alta Temperatura".to_string(),
            message: format!("A temperatura do host atingiu {:.1}°C.", stats.temperature),
            source: "metrics".to_string(),
        });
    }

    for disk in &stats.disks {
        let disk_percent = (disk.used as f64 / disk.total.max(1) as f64) * 100.0;
        if disk_percent > 90.0 {
            push_alert_if_needed(SystemAlert {
                id: uuid::Uuid::new_v4().to_string(),
                timestamp: get_current_timestamp(),
                level: "warning".to_string(),
                title: "Disco Quase Cheio".to_string(),
                message: format!(
                    "O disco {} ({}) está com {:.1}% de uso.",
                    disk.name, disk.mount_point, disk_percent
                ),
                source: "metrics".to_string(),
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::system::alerts::{ALERTS_COOLDOWN, ALERTS_HISTORY, TEST_ALERT_LOCK};

    #[test]
    fn test_evaluate_and_push_alerts_critical_cpu() {
        let _guard = TEST_ALERT_LOCK.lock().unwrap();

        {
            let mut hist = ALERTS_HISTORY.write().unwrap();
            hist.clear();
        }
        {
            let mut cd = ALERTS_COOLDOWN.write().unwrap();
            cd.clear();
        }

        let mut stats = SystemStats {
            timestamp: 0,
            cpu_usage: 95.0, // Should trigger
            memory_used: 1000,
            memory_total: 2000,
            disks: vec![],
            network_tx: 0,
            network_rx: 0,
            network_interface: None,
            network_interface_type: None,
            temperature: 50.0,
            docker_cpu: 0.0,
            docker_memory: 0,
            docker_rx: 0,
            docker_tx: 0,
            orbit_cpu: 0.0,
            orbit_memory: 0,
        };

        evaluate_and_push_alerts(&stats);

        {
            let history = ALERTS_HISTORY.read().unwrap();
            assert_eq!(history.len(), 1);
            assert_eq!(history[0].title, "Alto Consumo de CPU");
            assert_eq!(history[0].level, "critical");
        }

        // Verify it doesn't trigger if below 90%
        {
            let mut hist = ALERTS_HISTORY.write().unwrap();
            hist.clear();
        }
        {
            let mut cd = ALERTS_COOLDOWN.write().unwrap();
            cd.clear();
        }
        stats.cpu_usage = 89.0;
        evaluate_and_push_alerts(&stats);
        {
            let history2 = ALERTS_HISTORY.read().unwrap();
            assert_eq!(history2.len(), 0);
        }
    }

    #[test]
    fn test_evaluate_and_push_alerts_ram_and_temp() {
        let _guard = TEST_ALERT_LOCK.lock().unwrap();

        {
            let mut hist = ALERTS_HISTORY.write().unwrap();
            hist.clear();
        }
        {
            let mut cd = ALERTS_COOLDOWN.write().unwrap();
            cd.clear();
        }

        let stats = SystemStats {
            timestamp: 0,
            cpu_usage: 50.0,
            memory_used: 9500, // 95%
            memory_total: 10000,
            disks: vec![],
            network_tx: 0,
            network_rx: 0,
            network_interface: None,
            network_interface_type: None,
            temperature: 85.0, // Should trigger
            docker_cpu: 0.0,
            docker_memory: 0,
            docker_rx: 0,
            docker_tx: 0,
            orbit_cpu: 0.0,
            orbit_memory: 0,
        };

        evaluate_and_push_alerts(&stats);

        {
            let history = ALERTS_HISTORY.read().unwrap();
            assert_eq!(history.len(), 2);
            let titles: Vec<String> = history.iter().map(|a| a.title.clone()).collect();
            assert!(titles.contains(&"Alto Consumo de RAM".to_string()));
            assert!(titles.contains(&"Alta Temperatura".to_string()));
        }
    }
}
