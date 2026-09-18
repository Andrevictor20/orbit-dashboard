use axum_test::TestServer;
use backend::app;
use serde_json::json;
use std::fs;
use std::sync::Mutex;

static TEST_MUTEX: Mutex<()> = Mutex::new(());

fn setup_test_env(test_id: &str) -> std::sync::MutexGuard<'static, ()> {
    let guard = TEST_MUTEX.lock().unwrap();
    let users_path = format!("data/test_saturn_users_{}.json", test_id);
    let auth_path = format!("data/test_saturn_auth_{}.json", test_id);
    let vis_path = format!("data/test_container_visibility_{}.json", test_id);
    let allowed_storage = format!("data/test_storage_{}", test_id);

    let _ = fs::create_dir_all(&allowed_storage);
    let _ = fs::remove_file(&users_path);
    let _ = fs::remove_file(&auth_path);
    let _ = fs::remove_file(&vis_path);

    unsafe {
        std::env::set_var("JWT_SECRET", "super_secret_rbac_test");
        std::env::set_var("SATURN_USERS_FILE", &users_path);
        std::env::set_var("SATURN_AUTH_FILE", &auth_path);
        std::env::set_var("SATURN_CONTAINER_VISIBILITY_FILE", &vis_path);
        std::env::set_var("SATURN_ALLOWED_MEMBER_STORAGE", &allowed_storage);
    }
    guard
}

fn cleanup_test_env(test_id: &str) {
    let users_path = format!("data/test_saturn_users_{}.json", test_id);
    let auth_path = format!("data/test_saturn_auth_{}.json", test_id);
    let vis_path = format!("data/test_container_visibility_{}.json", test_id);
    let allowed_storage = format!("data/test_storage_{}", test_id);

    let _ = fs::remove_file(&users_path);
    let _ = fs::remove_file(&auth_path);
    let _ = fs::remove_file(&vis_path);
    let _ = fs::remove_dir_all(&allowed_storage);
}

#[tokio::test]
async fn test_rbac_full_lifecycle() {
    let test_id = "lifecycle";
    let _guard = setup_test_env(test_id);

    let server = TestServer::new(app());

    // 1. Initial setup creates the primary Admin
    let setup_res = server
        .post("/api/auth/setup")
        .json(&json!({
            "username": "admin_root",
            "password": "admin_password123"
        }))
        .await;
    setup_res.assert_status_success();
    let admin_cookie = setup_res.cookie("auth_token");

    // 2. Admin verifies identity via /api/auth/me
    let me_admin = server
        .get("/api/auth/me")
        .add_cookie(admin_cookie.clone())
        .await;
    me_admin.assert_status_success();
    let me_admin_json: serde_json::Value = me_admin.json();
    assert_eq!(me_admin_json["username"], "admin_root");
    assert_eq!(me_admin_json["role"], "admin");
    assert_eq!(me_admin_json["is_admin"], true);

    // 3. Admin creates a new Member
    let create_member_res = server
        .post("/api/users")
        .add_cookie(admin_cookie.clone())
        .json(&json!({
            "username": "family_member",
            "display_name": "Family Member",
            "password": "member_password123",
            "role": "member"
        }))
        .await;
    create_member_res.assert_status_success();
    let member_info: serde_json::Value = create_member_res.json();
    let member_id = member_info["id"].as_str().unwrap().to_string();
    assert_eq!(member_info["username"], "family_member");
    assert_eq!(member_info["role"], "member");

    // 4. Login as the new Member
    let member_login = server
        .post("/api/auth/login")
        .json(&json!({
            "username": "family_member",
            "password": "member_password123"
        }))
        .await;
    member_login.assert_status_success();
    let member_cookie = member_login.cookie("auth_token");

    let me_member = server
        .get("/api/auth/me")
        .add_cookie(member_cookie.clone())
        .await;
    me_member.assert_status_success();
    let me_member_json: serde_json::Value = me_member.json();
    assert_eq!(me_member_json["username"], "family_member");
    assert_eq!(me_member_json["role"], "member");
    assert_eq!(me_member_json["is_admin"], false);

    // 5. Member is BLOCKED from /api/users management endpoints (403 Forbidden)
    let member_list_users = server
        .get("/api/users")
        .add_cookie(member_cookie.clone())
        .await;
    member_list_users.assert_status_forbidden();

    let member_create_user = server
        .post("/api/users")
        .add_cookie(member_cookie.clone())
        .json(&json!({
            "username": "intruder",
            "password": "password123",
            "role": "admin"
        }))
        .await;
    member_create_user.assert_status_forbidden();

    let member_delete_user = server
        .delete(&format!("/api/users/{}", member_id))
        .add_cookie(member_cookie.clone())
        .await;
    member_delete_user.assert_status_forbidden();

    // 6. Member is BLOCKED from administrative system routes (403 Forbidden)
    let member_system_update = server
        .post("/api/system/update")
        .add_cookie(member_cookie.clone())
        .json(&json!({}))
        .await;
    member_system_update.assert_status_forbidden();

    let member_system_settings = server
        .post("/api/system/settings")
        .add_cookie(member_cookie.clone())
        .json(&json!({}))
        .await;
    member_system_settings.assert_status_forbidden();

    // 7. Member is BLOCKED from destructive file operations (403 Forbidden)
    let member_file_delete = server
        .post("/api/files/delete")
        .add_cookie(member_cookie.clone())
        .json(&json!({
            "paths": ["/data/some_file.txt"]
        }))
        .await;
    member_file_delete.assert_status_forbidden();

    let member_file_move = server
        .post("/api/files/move")
        .add_cookie(member_cookie.clone())
        .json(&json!({
            "source": "/data/some_file.txt",
            "destination": "/data/other_file.txt"
        }))
        .await;
    member_file_move.assert_status_forbidden();

    let member_file_rename = server
        .put("/api/files/rename")
        .add_cookie(member_cookie.clone())
        .json(&json!({
            "old_path": "/data/some_file.txt",
            "new_path": "/data/other_file.txt"
        }))
        .await;
    member_file_rename.assert_status_forbidden();

    let member_trash_move = server
        .post("/api/files/trash")
        .add_cookie(member_cookie.clone())
        .json(&json!({
            "paths": ["/data/some_file.txt"]
        }))
        .await;
    member_trash_move.assert_status_forbidden();

    let member_trash_empty = server
        .delete("/api/files/trash")
        .add_cookie(member_cookie.clone())
        .await;
    member_trash_empty.assert_status_forbidden();

    // 8. Member is BLOCKED from navigating restricted OS host paths (403 Forbidden)
    let member_root_ls = server
        .get("/api/files/list?path=/etc")
        .add_cookie(member_cookie.clone())
        .await;
    member_root_ls.assert_status_forbidden();

    // 9. Member is ALLOWED to list safe allowed storage (e.g. configured test storage)
    let safe_storage = format!("data/test_storage_{}", test_id);
    let member_allowed_ls = server
        .get(&format!("/api/files/list?path={}", safe_storage))
        .add_cookie(member_cookie.clone())
        .await;
    member_allowed_ls.assert_status_success();

    // 10. Container Visibility & Control
    // Admin toggles visibility for a test container
    let toggle_res = server
        .post("/api/docker/visibility/toggle")
        .add_cookie(admin_cookie.clone())
        .json(&json!({
            "container_id": "test_vault_container"
        }))
        .await;
    toggle_res.assert_status_success();
    let toggle_json: serde_json::Value = toggle_res.json();
    assert_eq!(toggle_json["hidden"], true);

    // Member attempting to toggle visibility is forbidden
    let member_toggle = server
        .post("/api/docker/visibility/toggle")
        .add_cookie(member_cookie.clone())
        .json(&json!({
            "container_id": "test_vault_container"
        }))
        .await;
    member_toggle.assert_status_forbidden();

    // Member attempting to delete a container is forbidden
    let member_delete_container = server
        .delete("/api/docker/containers/test_vault_container")
        .add_cookie(member_cookie.clone())
        .await;
    member_delete_container.assert_status_forbidden();

    // 11. Security Lock: Cannot delete or demote the last active admin
    let users_list = server
        .get("/api/users")
        .add_cookie(admin_cookie.clone())
        .await;
    users_list.assert_status_success();
    let users_json: Vec<serde_json::Value> = users_list.json();
    let admin_user = users_json.iter().find(|u| u["username"] == "admin_root").unwrap();
    let admin_id = admin_user["id"].as_str().unwrap();

    // Attempting to demote the sole active admin to member fails
    let demote_admin = server
        .put(&format!("/api/users/{}", admin_id))
        .add_cookie(admin_cookie.clone())
        .json(&json!({
            "role": "member"
        }))
        .await;
    demote_admin.assert_status_bad_request();

    // Attempting to suspend the sole active admin fails
    let suspend_admin = server
        .put(&format!("/api/users/{}", admin_id))
        .add_cookie(admin_cookie.clone())
        .json(&json!({
            "is_active": false
        }))
        .await;
    suspend_admin.assert_status_bad_request();

    cleanup_test_env(test_id);
}

#[tokio::test]
async fn test_legacy_auth_migration() {
    let test_id = "migration";
    let _guard = setup_test_env(test_id);

    let auth_path = format!("data/test_saturn_auth_{}.json", test_id);
    let legacy_auth = json!({
        "username": "legacy_admin",
        "hash": "$argon2id$v=19$m=19456,t=2,p=1$1Yj2tF7k7Kq9uL8x$test_hash",
        "totp_enabled": false,
        "recovery_codes": []
    });
    fs::write(&auth_path, serde_json::to_string(&legacy_auth).unwrap()).unwrap();

    // Loading users must auto-migrate legacy_admin to Admin role in saturn_users.json
    let users = backend::auth::load_users();
    assert_eq!(users.len(), 1);
    assert_eq!(users[0].username, "legacy_admin");
    assert_eq!(users[0].role, backend::auth::UserRole::Admin);
    assert_eq!(users[0].is_active, true);

    cleanup_test_env(test_id);
}
