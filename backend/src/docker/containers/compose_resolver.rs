pub fn valid_env_entry(entry: &str) -> bool {
    let Some((key, _)) = entry.split_once('=') else {
        return false;
    };

    !key.is_empty()
        && !key.as_bytes()[0].is_ascii_digit()
        && key.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
}

/// Helper to resolve the real location of a docker-compose manifest on disk.
/// Handles paths inside container (/app/data/apps/...), host paths (/host/...),
/// and relative working directories. Returns (compose_file_path, project_directory).
pub fn resolve_compose_file(
    working_dir: Option<&str>,
    config_files_label: &str,
) -> Option<(std::path::PathBuf, std::path::PathBuf)> {
    let clean_label = config_files_label
        .split(',')
        .next()
        .unwrap_or("docker-compose.yml")
        .trim();
    if clean_label.is_empty() {
        return None;
    }

    let mut candidate_paths = Vec::new();

    // 1. Direct label path
    candidate_paths.push(std::path::PathBuf::from(clean_label));

    // 2. Host-prefixed label path if label starts with '/'
    if clean_label.starts_with('/') {
        candidate_paths.push(std::path::PathBuf::from(format!("/host{}", clean_label)));
    }

    // 3. Relative to working_dir if provided
    if let Some(wd) = working_dir {
        let wd_path = std::path::Path::new(wd);
        candidate_paths.push(wd_path.join(clean_label));

        let file_name = std::path::Path::new(clean_label)
            .file_name()
            .unwrap_or_default();
        candidate_paths.push(wd_path.join(file_name));

        // Also check with /host prefix on working_dir
        let host_wd = format!("/host{}", wd);
        let host_wd_path = std::path::Path::new(&host_wd);
        candidate_paths.push(host_wd_path.join(clean_label));
        candidate_paths.push(host_wd_path.join(file_name));
    }

    // Find the first candidate that actually exists as a file
    for candidate in candidate_paths {
        if candidate.is_file() {
            let project_dir = if let Some(wd) = working_dir {
                if std::path::Path::new(wd).is_dir() {
                    std::path::PathBuf::from(wd)
                } else if std::path::Path::new(&format!("/host{}", wd)).is_dir() {
                    std::path::PathBuf::from(format!("/host{}", wd))
                } else {
                    candidate
                        .parent()
                        .unwrap_or_else(|| std::path::Path::new("."))
                        .to_path_buf()
                }
            } else {
                candidate
                    .parent()
                    .unwrap_or_else(|| std::path::Path::new("."))
                    .to_path_buf()
            };

            return Some((candidate, project_dir));
        }
    }

    None
}
