use axum_test::TestServer;
use backend::app;
use jsonwebtoken::{encode, Header, EncodingKey};
use backend::auth::Claims;
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH, Duration};

fn get_test_cookie() -> axum_extra::extract::cookie::Cookie<'static> {
    let expiration = SystemTime::now()
        .checked_add(Duration::from_secs(3600))
        .unwrap()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize;

    let claims = Claims {
        sub: "admin".to_string(),
        exp: expiration,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(b"super_secret"),
    ).unwrap();

    axum_extra::extract::cookie::Cookie::new("auth_token", token)
}

#[tokio::test]
async fn test_backup_crud_and_schedule() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let server = TestServer::new(app());
    let auth_cookie = get_test_cookie();

    // 1. Setup dummy app directory
    let dummy_app_dir = PathBuf::from("data/apps/test-backup-app");
    let _ = fs::create_dir_all(&dummy_app_dir);
    let _ = fs::write(dummy_app_dir.join("docker-compose.yml"), "version: '3'\nservices:\n  app:\n    image: alpine\n");
    let _ = fs::write(dummy_app_dir.join("test_data.txt"), "hello backup world");

    // 2. Create backup
    let create_res = server
        .post("/api/backups/create")
        .add_cookie(auth_cookie.clone())
        .json(&json!({
            "app_id": "test-backup-app",
            "stop_container": false
        }))
        .await;

    create_res.assert_status_ok();
    let backup_item: serde_json::Value = create_res.json();
    let backup_id = backup_item.get("id").expect("id exists").as_str().unwrap().to_string();
    assert_eq!(backup_item.get("app_id").unwrap().as_str().unwrap(), "test-backup-app");

    // 3. List backups
    let list_res = server
        .get("/api/backups")
        .add_cookie(auth_cookie.clone())
        .await;
    list_res.assert_status_ok();
    let list: Vec<serde_json::Value> = list_res.json();
    assert!(list.iter().any(|b| b.get("id").unwrap().as_str().unwrap() == backup_id));

    // 4. Get backup stats
    let stats_res = server
        .get("/api/backups/stats")
        .add_cookie(auth_cookie.clone())
        .await;
    stats_res.assert_status_ok();
    let stats: serde_json::Value = stats_res.json();
    assert!(stats.get("total_backups").unwrap().as_u64().unwrap() >= 1);

    // 5. Download backup
    let dl_res = server
        .get(&format!("/api/backups/download/{}", backup_id))
        .add_cookie(auth_cookie.clone())
        .await;
    dl_res.assert_status_ok();

    // 6. Schedule config GET & POST
    let sched_res = server
        .post("/api/backups/schedule")
        .add_cookie(auth_cookie.clone())
        .json(&json!({
            "enabled": true,
            "frequency": "daily",
            "hour": 4,
            "minute": 30,
            "retention_count": 3,
            "target_apps": ["test-backup-app"]
        }))
        .await;
    sched_res.assert_status_ok();

    let get_sched = server
        .get("/api/backups/schedule")
        .add_cookie(auth_cookie.clone())
        .await;
    get_sched.assert_status_ok();
    let sched_data: serde_json::Value = get_sched.json();
    assert_eq!(sched_data.get("hour").unwrap().as_u64().unwrap(), 4);
    assert_eq!(sched_data.get("retention_count").unwrap().as_u64().unwrap(), 3);

    // 7. Delete backup
    let del_res = server
        .delete(&format!("/api/backups/{}", backup_id))
        .add_cookie(auth_cookie.clone())
        .await;
    del_res.assert_status_ok();

    // Clean up dummy dir
    let _ = fs::remove_dir_all(&dummy_app_dir);
}
