use std::fs;
use std::path::{Path, PathBuf};

/// Files that contain persistent configuration and must be preserved across updates
pub const CONFIG_FILES: &[&str] = &[
    "orbit_auth.json",
    "custom_links.json",
    "settings.json",
    "pihole.json",
    "cloudflare.json",
    "jwt.secret",
    "config/samba.json",
];

/// Returns the primary active data directory for Orbit
pub fn get_active_data_dir() -> PathBuf {
    if let Ok(custom) = std::env::var("ORBIT_DATA_DIR") {
        if !custom.trim().is_empty() {
            return PathBuf::from(custom);
        }
    }
    PathBuf::from("data")
}

/// Scans candidate legacy or detached directories and auto-migrates config files
/// if the active target directory does not yet contain `orbit_auth.json`.
pub fn auto_heal_persistent_data() -> bool {
    let target_dir = get_active_data_dir();
    let auth_file = target_dir.join("orbit_auth.json");

    // If active data directory already has authentication data, no healing is needed
    if auth_file.exists() {
        return false;
    }

    let candidates = get_candidate_data_dirs();
    for candidate in candidates {
        if candidate == target_dir {
            continue;
        }

        if scan_and_migrate_from_dir(&candidate, &target_dir) {
            tracing::info!(
                "✅ [DataMigrator] Auto-healing complete! Successfully recovered persistent data from {:?} to {:?}",
                candidate,
                target_dir
            );
            return true;
        }
    }

    false
}

/// Migrates configuration files from a specific candidate directory to the target directory.
/// Returns true if at least one critical configuration file (`orbit_auth.json` or `custom_links.json`) was restored.
pub fn scan_and_migrate_from_dir(candidate_dir: &Path, target_dir: &Path) -> bool {
    let candidate_auth = candidate_dir.join("orbit_auth.json");
    let candidate_links = candidate_dir.join("custom_links.json");

    // Must have at least one critical credential/link file to qualify as a valid backup
    if !candidate_auth.exists() && !candidate_links.exists() {
        return false;
    }

    // Safety guard: never overwrite existing credentials in the target directory
    if target_dir.join("orbit_auth.json").exists() {
        return false;
    }

    let _ = fs::create_dir_all(target_dir);
    let mut restored_count = 0usize;

    for rel_path in CONFIG_FILES {
        let src_file = candidate_dir.join(rel_path);
        let dst_file = target_dir.join(rel_path);

        if src_file.exists() && !dst_file.exists() {
            if let Some(parent) = dst_file.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if fs::copy(&src_file, &dst_file).is_ok() {
                restored_count += 1;
                tracing::info!(
                    "📁 [DataMigrator] Restored persistent file: {:?} -> {:?}",
                    src_file,
                    dst_file
                );
            }
        }
    }

    restored_count > 0
}

/// Returns a prioritized list of host and Docker volume locations where previous
/// installations or compose runs may have stored Orbit data.
pub fn get_candidate_data_dirs() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    // 1. Docker volume mount points accessible via /host
    let volume_candidates = [
        "/host/var/lib/docker/volumes/orbit_orbit_data/_data",
        "/host/var/lib/docker/volumes/orbit-dashboard_orbit_data/_data",
        "/host/var/lib/docker/volumes/orbit_data/_data",
        "/host/var/lib/docker/volumes/orbit-data/_data",
    ];
    for v in volume_candidates {
        let p = PathBuf::from(v);
        if p.exists() {
            candidates.push(p);
        }
    }

    // 2. Discover any other custom named volume matching *orbit*
    if let Ok(entries) = fs::read_dir("/host/var/lib/docker/volumes") {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(fname) = path.file_name() {
                let name = fname.to_string_lossy();
                if name.contains("orbit") {
                    let data_path = path.join("_data");
                    if data_path.exists() && !candidates.contains(&data_path) {
                        candidates.push(data_path);
                    }
                }
            }
        }
    }

    // 3. Known host directories
    let host_paths = [
        "/host/DATA/orbit/data",
        "/host/data/orbit/data",
        "/host/root/orbit/data",
        "/host/opt/orbit/data",
        "/host/srv/orbit/data",
    ];
    for h in host_paths {
        let p = PathBuf::from(h);
        if p.exists() && !candidates.contains(&p) {
            candidates.push(p);
        }
    }

    // 4. Scan /host/home/*/orbit/data
    if let Ok(entries) = fs::read_dir("/host/home") {
        for entry in entries.flatten() {
            let p = entry.path().join("orbit").join("data");
            if p.exists() && !candidates.contains(&p) {
                candidates.push(p);
            }
        }
    }

    candidates
}
