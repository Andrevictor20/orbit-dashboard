use std::fs;

fn create_test_temp_dir() -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("orbit_migrator_test_{}", uuid::Uuid::new_v4()));
    let _ = fs::create_dir_all(&dir);
    dir
}

#[test]
fn test_migrate_copies_all_config_files_when_auth_missing() {
    let base = create_test_temp_dir();
    let candidate = base.join("legacy_volume");
    let target = base.join("current_data");

    fs::create_dir_all(&candidate).unwrap();
    fs::create_dir_all(&target).unwrap();

    // Create legacy configuration files
    fs::write(candidate.join("orbit_auth.json"), r#"{"username":"admin","hash":"$argon2id$test"}"#).unwrap();
    fs::write(candidate.join("custom_links.json"), r#"{"c1":"http://192.168.1.50:8080"}"#).unwrap();
    fs::write(candidate.join("settings.json"), r#"{"server_name":"Homelab"}"#).unwrap();
    fs::write(candidate.join("pihole.json"), r#"{"url":"http://192.168.1.2","token":"secret"}"#).unwrap();
    fs::write(candidate.join("jwt.secret"), "test_secret_123").unwrap();

    let migrated = backend::system::data_migrator::scan_and_migrate_from_dir(&candidate, &target);
    assert!(migrated, "Migration should succeed when target has no orbit_auth.json");

    // Verify all files were copied to target
    assert_eq!(
        fs::read_to_string(target.join("orbit_auth.json")).unwrap(),
        r#"{"username":"admin","hash":"$argon2id$test"}"#
    );
    assert_eq!(
        fs::read_to_string(target.join("custom_links.json")).unwrap(),
        r#"{"c1":"http://192.168.1.50:8080"}"#
    );
    assert_eq!(
        fs::read_to_string(target.join("settings.json")).unwrap(),
        r#"{"server_name":"Homelab"}"#
    );
    assert_eq!(
        fs::read_to_string(target.join("pihole.json")).unwrap(),
        r#"{"url":"http://192.168.1.2","token":"secret"}"#
    );
    assert_eq!(
        fs::read_to_string(target.join("jwt.secret")).unwrap(),
        "test_secret_123"
    );

    let _ = fs::remove_dir_all(&base);
}

#[test]
fn test_migrate_does_not_overwrite_when_target_has_auth() {
    let base = create_test_temp_dir();
    let candidate = base.join("legacy_volume");
    let target = base.join("current_data");

    fs::create_dir_all(&candidate).unwrap();
    fs::create_dir_all(&target).unwrap();

    // Candidate has old data
    fs::write(candidate.join("orbit_auth.json"), r#"{"username":"old_admin","hash":"old_hash"}"#).unwrap();
    fs::write(candidate.join("custom_links.json"), r#"{"c1":"old_link"}"#).unwrap();

    // Target already has existing data
    fs::write(target.join("orbit_auth.json"), r#"{"username":"current_admin","hash":"current_hash"}"#).unwrap();
    fs::write(target.join("custom_links.json"), r#"{"c1":"current_link"}"#).unwrap();

    let migrated = backend::system::data_migrator::scan_and_migrate_from_dir(&candidate, &target);
    assert!(!migrated, "Migration must NOT run if target already contains orbit_auth.json");

    // Verify target was NOT modified
    assert_eq!(
        fs::read_to_string(target.join("orbit_auth.json")).unwrap(),
        r#"{"username":"current_admin","hash":"current_hash"}"#
    );
    assert_eq!(
        fs::read_to_string(target.join("custom_links.json")).unwrap(),
        r#"{"c1":"current_link"}"#
    );

    let _ = fs::remove_dir_all(&base);
}

#[test]
fn test_migrate_handles_subdirectories_like_samba() {
    let base = create_test_temp_dir();
    let candidate = base.join("legacy_volume");
    let target = base.join("current_data");

    fs::create_dir_all(candidate.join("config")).unwrap();
    fs::create_dir_all(&target).unwrap();

    fs::write(candidate.join("orbit_auth.json"), r#"{"username":"admin","hash":"hash"}"#).unwrap();
    fs::write(candidate.join("config").join("samba.json"), r#"{"shares":[]}"#).unwrap();

    let migrated = backend::system::data_migrator::scan_and_migrate_from_dir(&candidate, &target);
    assert!(migrated);

    assert!(target.join("config").join("samba.json").exists());
    assert_eq!(
        fs::read_to_string(target.join("config").join("samba.json")).unwrap(),
        r#"{"shares":[]}"#
    );

    let _ = fs::remove_dir_all(&base);
}

#[test]
fn test_candidate_detection_returns_list() {
    let candidates = backend::system::data_migrator::get_candidate_data_dirs();
    // Verify candidates query returns without panicking
    let _ = candidates.is_empty();
}
