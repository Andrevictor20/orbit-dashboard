use backend::store::types::AddStoreRepositoryPayload;
use backend::store::config::{
    add_repository_to_path, get_repositories_from_path, remove_repository_from_path,
    toggle_repository_in_path, DEFAULT_OFFICIAL_URL,
};
use std::fs;
use std::path::Path;

#[test]
fn test_default_repositories_initialization() {
    let test_path = "data/test_stores_init.json";
    let _ = fs::remove_file(test_path);

    let repos = get_repositories_from_path(test_path);
    assert_eq!(repos.len(), 1);
    assert_eq!(repos[0].id, "official");
    assert_eq!(repos[0].url, DEFAULT_OFFICIAL_URL);
    assert!(repos[0].is_official);
    assert!(repos[0].enabled);

    // Verify it was persisted to disk
    assert!(Path::new(test_path).exists());

    let _ = fs::remove_file(test_path);
}

#[test]
fn test_add_and_remove_community_repository() {
    let test_path = "data/test_stores_crud.json";
    let _ = fs::remove_file(test_path);

    // 1. Initial repo
    let _ = get_repositories_from_path(test_path);

    // 2. Add valid community repository
    let payload = AddStoreRepositoryPayload {
        name: "Community Store".to_string(),
        url: "https://example.com/community/catalog.json".to_string(),
    };
    let added = add_repository_to_path(test_path, payload).expect("Failed to add repo");
    assert!(!added.is_official);
    assert_eq!(added.name, "Community Store");
    assert!(added.enabled);

    // 3. Verify both repos are returned
    let repos = get_repositories_from_path(test_path);
    assert_eq!(repos.len(), 2);

    // 4. Test cannot add duplicate URL
    let dup_payload = AddStoreRepositoryPayload {
        name: "Duplicate Store".to_string(),
        url: "https://example.com/community/catalog.json".to_string(),
    };
    assert!(add_repository_to_path(test_path, dup_payload).is_err());

    // 5. Test cannot delete official repository
    assert!(remove_repository_from_path(test_path, "official").is_err());

    // 6. Delete community repository
    assert!(remove_repository_from_path(test_path, &added.id).is_ok());

    let repos_after = get_repositories_from_path(test_path);
    assert_eq!(repos_after.len(), 1);
    assert_eq!(repos_after[0].id, "official");

    let _ = fs::remove_file(test_path);
}

#[test]
fn test_toggle_repository() {
    let test_path = "data/test_stores_toggle.json";
    let _ = fs::remove_file(test_path);

    let _ = get_repositories_from_path(test_path);

    // Toggle official repository
    let new_state = toggle_repository_in_path(test_path, "official").expect("Toggle failed");
    assert!(!new_state);

    let repos = get_repositories_from_path(test_path);
    assert!(!repos[0].enabled);

    let new_state2 = toggle_repository_in_path(test_path, "official").expect("Toggle 2 failed");
    assert!(new_state2);

    let _ = fs::remove_file(test_path);
}
