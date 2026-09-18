use serde::{Deserialize, Serialize};

fn default_target_type() -> String {
    "single_app".to_string()
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct BackupItem {
    pub id: String,
    pub app_id: String,
    pub app_name: String,
    pub filename: String,
    pub size_bytes: u64,
    pub created_at: String,
    pub status: String,      // "completed", "failed", "in_progress"
    pub backup_type: String, // "manual", "scheduled"
    #[serde(default = "default_target_type")]
    pub target_type: String, // "system_full", "saturn_configs", "all_containers", "single_app"
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct BackupScheduleConfig {
    pub enabled: bool,
    pub frequency: String, // "daily", "weekly"
    pub hour: u32,
    pub minute: u32,
    pub retention_count: usize, // e.g. 5
    pub target_apps: Vec<String>, // list of app_ids, empty means all installed
    #[serde(default)]
    pub schedule_scope: Option<String>, // "all_apps", "full_system", "selected"
}

impl Default for BackupScheduleConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            frequency: "daily".to_string(),
            hour: 3,
            minute: 0,
            retention_count: 5,
            target_apps: Vec::new(),
            schedule_scope: Some("all_apps".to_string()),
        }
    }
}

#[derive(Deserialize, Debug)]
pub struct CreateBackupPayload {
    pub app_id: Option<String>,
    pub target_type: Option<String>, // "system_full" | "saturn_configs" | "all_containers" | "single_app"
    pub stop_container: Option<bool>,
    pub app_name: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct RestoreBackupPayload {
    pub id: Option<String>,
    pub filename: Option<String>,
    pub app_name: Option<String>,
}

#[derive(Serialize)]
pub struct BackupStats {
    pub total_backups: usize,
    pub total_bytes: u64,
    pub last_backup_date: Option<String>,
    pub schedule_enabled: bool,
}

