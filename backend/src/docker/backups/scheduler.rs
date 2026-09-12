use std::fs;
use tracing::info;
use super::ops::{create_backup_internal, load_schedule_config};

pub fn start_backup_scheduler() {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
        let mut last_executed_day = None;

        loop {
            interval.tick().await;

            let config = load_schedule_config();
            if !config.enabled {
                continue;
            }

            let now = time::OffsetDateTime::now_utc();
            let current_day = now.date();
            let hour = now.hour() as u32;
            let minute = now.minute() as u32;

            if hour == config.hour && minute == config.minute {
                if last_executed_day == Some(current_day) {
                    continue; // Already ran today
                }

                info!(
                    "Disparando rotina de backup agendado ({} apps)",
                    config.target_apps.len()
                );
                last_executed_day = Some(current_day);

                // Determine target apps (either explicit or scan data/apps)
                let apps_to_backup: Vec<String> = if !config.target_apps.is_empty() {
                    config.target_apps.clone()
                } else {
                    let mut detected = Vec::new();
                    if let Ok(entries) = fs::read_dir("data/apps") {
                        for entry in entries.flatten() {
                            if entry.path().is_dir() {
                                detected.push(entry.file_name().to_string_lossy().to_string());
                            }
                        }
                    }
                    detected
                };

                for app in apps_to_backup {
                    let _ = create_backup_internal(&app, true, "scheduled").await;
                }
            }
        }
    });
}
