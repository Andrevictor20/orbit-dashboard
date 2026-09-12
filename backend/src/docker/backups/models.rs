use serde::{Deserialize, Serialize};

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
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct BackupScheduleConfig {
    pub enabled: bool,
    pub frequency: String, // "daily", "weekly"
    pub hour: u32,
    pub minute: u32,
    pub retention_count: usize, // e.g. 5
    pub target_apps: Vec<String>, // list of app_ids, empty means all installed
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
        }
    }
}

#[derive(Deserialize)]
pub struct CreateBackupPayload {
    pub app_id: String,
    pub stop_container: Option<bool>,
}

#[derive(Serialize)]
pub struct BackupStats {
    pub total_backups: usize,
    pub total_bytes: u64,
    pub last_backup_date: Option<String>,
    pub schedule_enabled: bool,
}
