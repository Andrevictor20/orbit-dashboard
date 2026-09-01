use axum_test::TestServer;
use backend::app;
use jsonwebtoken::{encode, Header, EncodingKey};
use backend::auth::Claims;
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH, Duration};
use std::fs;
use std::path::Path;

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

fn setup_test_sandbox() -> std::path::PathBuf {
    let sandbox = std::env::temp_dir().join(format!("orbit_test_fs_{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&sandbox).unwrap();
    
    // Create some test structure
    fs::create_dir_all(sandbox.join("documents")).unwrap();
    fs::create_dir_all(sandbox.join("movies")).unwrap();
    fs::create_dir_all(sandbox.join("music")).unwrap();
    
    fs::write(sandbox.join("documents/hello.txt"), "Hello Orbit File Manager!").unwrap();
    fs::write(sandbox.join("documents/config.json"), r#"{"app":"orbit","version":"1.0"}"#).unwrap();
    fs::write(sandbox.join("documents/manual.pdf"), "%PDF-1.4 sample pdf content").unwrap();
    fs::write(sandbox.join("music/track.mp3"), "ID3fake audio binary data").unwrap();
    fs::write(sandbox.join("movies/clip.mp4"), "fake mp4 video data").unwrap();
    fs::write(sandbox.join("movies/film.mkv"), "fake mkv matroska container data").unwrap();
    fs::write(sandbox.join("movies/film.srt"), "1\n00:00:01,000 --> 00:00:04,000\nHello World Subtitle").unwrap();
    
    sandbox
}

// 1. Navigation & Listing
#[tokio::test]
async fn test_files_navigation_and_shortcuts() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let sandbox = setup_test_sandbox();
    let sandbox_str = sandbox.to_str().unwrap();
    
    let server = TestServer::new(app());
    let cookie = get_test_cookie();
    
    // Test listing root / directory
    let res = server.get(&format!("/api/files/list?path={}", sandbox_str))
        .add_cookie(cookie.clone())
        .await;
    res.assert_status_ok();
    
    let json: serde_json::Value = res.json();
    assert!(json["items"].is_array(), "Expected items array");
    let items = json["items"].as_array().unwrap();
    assert!(items.iter().any(|i| i["name"] == "documents" && i["is_dir"] == true));
    assert!(items.iter().any(|i| i["name"] == "movies" && i["is_dir"] == true));
    
    // Test listing non-existent path
    let non_existent = server.get(&format!("/api/files/list?path={}/non_existent_folder", sandbox_str))
        .add_cookie(cookie.clone())
        .await;
    non_existent.assert_status(axum::http::StatusCode::NOT_FOUND);
    
    // Test shortcuts endpoint
    let shortcuts_res = server.get("/api/files/shortcuts")
        .add_cookie(cookie.clone())
        .await;
    shortcuts_res.assert_status_ok();
    let shortcuts: serde_json::Value = shortcuts_res.json();
    assert!(shortcuts.get("home").is_some(), "Expected home shortcut");
    assert!(shortcuts.get("documents").is_some(), "Expected documents shortcut");
    assert!(shortcuts.get("downloads").is_some(), "Expected downloads shortcut");
    assert!(shortcuts.get("pictures").is_some(), "Expected pictures shortcut");
    assert!(shortcuts.get("music").is_some(), "Expected music shortcut");
    assert!(shortcuts.get("videos").is_some(), "Expected videos shortcut");
    assert!(shortcuts.get("root").is_some(), "Expected root shortcut");
    assert!(shortcuts["places"].is_array(), "Expected places array");

    let _ = fs::remove_dir_all(&sandbox);
}

// 2. Storage & Mounted HDs
#[tokio::test]
async fn test_files_storage_listing() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let server = TestServer::new(app());
    let cookie = get_test_cookie();
    
    let res = server.get("/api/files/storages")
        .add_cookie(cookie.clone())
        .await;
    res.assert_status_ok();
    
    let storages: serde_json::Value = res.json();
    assert!(storages["mounts"].is_array());
    let mounts = storages["mounts"].as_array().unwrap();
    assert!(!mounts.is_empty(), "Should return at least root mount");
    assert!(mounts[0].get("mount_point").is_some());
    assert!(mounts[0].get("total_bytes").is_some());
    assert!(mounts[0].get("available_bytes").is_some());
}

// 3. Cloud Storage Providers & Connect
#[tokio::test]
async fn test_files_cloud_providers_and_connect() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let server = TestServer::new(app());
    let cookie = get_test_cookie();
    
    // List providers
    let prov_res = server.get("/api/files/cloud/providers")
        .add_cookie(cookie.clone())
        .await;
    prov_res.assert_status_ok();
    let providers: serde_json::Value = prov_res.json();
    let list = providers["providers"].as_array().unwrap();
    assert!(list.iter().any(|p| p["id"] == "google_drive"));
    assert!(list.iter().any(|p| p["id"] == "onedrive"));
    assert!(list.iter().any(|p| p["id"] == "dropbox"));
    assert!(list.iter().any(|p| p["id"] == "smb"));
    
    // Connect a cloud drive
    let connect_res = server.post("/api/files/cloud/connect")
        .add_cookie(cookie.clone())
        .json(&json!({
            "provider": "google_drive",
            "name": "Meu Google Drive",
            "config": {
                "client_id": "test_client",
                "client_secret": "test_secret",
                "token": "fake_token"
            }
        }))
        .await;
    connect_res.assert_status_ok();
    let connect_json: serde_json::Value = connect_res.json();
    let account_id = connect_json["id"].as_str().unwrap();
    
    // List connected accounts
    let list_res = server.get("/api/files/cloud/accounts")
        .add_cookie(cookie.clone())
        .await;
    list_res.assert_status_ok();
    let accounts: serde_json::Value = list_res.json();
    assert!(accounts["accounts"].as_array().unwrap().iter().any(|a| a["id"] == account_id));
    
    // Disconnect account
    let del_res = server.delete(&format!("/api/files/cloud/accounts/{}", account_id))
        .add_cookie(cookie.clone())
        .await;
    del_res.assert_status_ok();
}

// 4. File CRUD operations: Mkdir, Create, Rename, Copy, Move, Delete
#[tokio::test]
async fn test_files_crud_operations() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let sandbox = setup_test_sandbox();
    let sandbox_str = sandbox.to_str().unwrap();
    
    let server = TestServer::new(app());
    let cookie = get_test_cookie();
    
    // Mkdir
    let new_folder = format!("{}/test_new_folder", sandbox_str);
    let mkdir_res = server.post("/api/files/mkdir")
        .add_cookie(cookie.clone())
        .json(&json!({ "path": new_folder }))
        .await;
    mkdir_res.assert_status_ok();
    assert!(Path::new(&new_folder).is_dir());
    
    // Create new empty file
    let new_file = format!("{}/test_new_folder/note.txt", sandbox_str);
    let create_res = server.post("/api/files/create")
        .add_cookie(cookie.clone())
        .json(&json!({ "path": new_file }))
        .await;
    create_res.assert_status_ok();
    assert!(Path::new(&new_file).is_file());
    
    // Rename file
    let renamed_file = format!("{}/test_new_folder/note_renamed.txt", sandbox_str);
    let rename_res = server.put("/api/files/rename")
        .add_cookie(cookie.clone())
        .json(&json!({ "old_path": new_file, "new_path": renamed_file }))
        .await;
    rename_res.assert_status_ok();
    assert!(!Path::new(&new_file).exists());
    assert!(Path::new(&renamed_file).is_file());
    
    // Copy file
    let copied_file = format!("{}/note_copied.txt", sandbox_str);
    let copy_res = server.post("/api/files/copy")
        .add_cookie(cookie.clone())
        .json(&json!({ "source": renamed_file, "destination": copied_file }))
        .await;
    copy_res.assert_status_ok();
    assert!(Path::new(&renamed_file).is_file());
    assert!(Path::new(&copied_file).is_file());
    
    // Move file
    let moved_file = format!("{}/movies/note_moved.txt", sandbox_str);
    let move_res = server.post("/api/files/move")
        .add_cookie(cookie.clone())
        .json(&json!({ "source": copied_file, "destination": moved_file }))
        .await;
    move_res.assert_status_ok();
    assert!(!Path::new(&copied_file).exists());
    assert!(Path::new(&moved_file).is_file());
    
    // Delete files
    let delete_res = server.post("/api/files/delete")
        .add_cookie(cookie.clone())
        .json(&json!({ "paths": [new_folder, moved_file] }))
        .await;
    delete_res.assert_status_ok();
    assert!(!Path::new(&new_folder).exists());
    assert!(!Path::new(&moved_file).exists());

    let _ = fs::remove_dir_all(&sandbox);
}

// 5. Transfer: Download, Archive (Zip), and Upload
#[tokio::test]
async fn test_files_download_and_archive() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let sandbox = setup_test_sandbox();
    let sandbox_str = sandbox.to_str().unwrap();
    
    let server = TestServer::new(app());
    let cookie = get_test_cookie();
    
    // Download single file
    let download_res = server.get(&format!("/api/files/download?path={}/documents/hello.txt", sandbox_str))
        .add_cookie(cookie.clone())
        .await;
    download_res.assert_status_ok();
    assert_eq!(download_res.text(), "Hello Orbit File Manager!");
    
    // Archive folder as zip
    let archive_res = server.get(&format!("/api/files/archive?path={}/documents", sandbox_str))
        .add_cookie(cookie.clone())
        .await;
    archive_res.assert_status_ok();
    let bytes = archive_res.as_bytes();
    assert!(bytes.len() > 10, "Zip archive should contain data");
    
    let _ = fs::remove_dir_all(&sandbox);
}

// 6. Media Streaming (Audio, Video, MKV, Subtitles)
#[tokio::test]
async fn test_media_streaming_and_subtitles() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let sandbox = setup_test_sandbox();
    let sandbox_str = sandbox.to_str().unwrap();
    
    let server = TestServer::new(app());
    let cookie = get_test_cookie();
    
    // Stream audio with Range
    let audio_res = server.get(&format!("/api/files/stream?path={}/music/track.mp3", sandbox_str))
        .add_cookie(cookie.clone())
        .add_header(axum::http::header::RANGE, "bytes=0-3")
        .await;
    audio_res.assert_status(axum::http::StatusCode::PARTIAL_CONTENT);
    assert_eq!(audio_res.text(), "ID3f");
    
    // Stream MKV video with Range
    let mkv_res = server.get(&format!("/api/files/stream?path={}/movies/film.mkv", sandbox_str))
        .add_cookie(cookie.clone())
        .add_header(axum::http::header::RANGE, "bytes=0-3")
        .await;
    mkv_res.assert_status(axum::http::StatusCode::PARTIAL_CONTENT);
    assert_eq!(mkv_res.text(), "fake");
    
    // Subtitles discovery for film.mkv
    let subs_res = server.get(&format!("/api/files/subtitles?path={}/movies/film.mkv", sandbox_str))
        .add_cookie(cookie.clone())
        .await;
    subs_res.assert_status_ok();
    let subs_json: serde_json::Value = subs_res.json();
    let subs = subs_json["subtitles"].as_array().unwrap();
    assert!(subs.iter().any(|s| s["name"] == "film.srt"));

    let _ = fs::remove_dir_all(&sandbox);
}

// 7. Text Editor & PDF Raw View
#[tokio::test]
async fn test_text_editor_and_pdf() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let sandbox = setup_test_sandbox();
    let sandbox_str = sandbox.to_str().unwrap();
    
    let server = TestServer::new(app());
    let cookie = get_test_cookie();
    
    // Read text content
    let text_res = server.get(&format!("/api/files/content?path={}/documents/hello.txt", sandbox_str))
        .add_cookie(cookie.clone())
        .await;
    text_res.assert_status_ok();
    let text_json: serde_json::Value = text_res.json();
    assert_eq!(text_json["content"], "Hello Orbit File Manager!");
    
    // Write text content
    let update_res = server.put("/api/files/content")
        .add_cookie(cookie.clone())
        .json(&json!({
            "path": format!("{}/documents/hello.txt", sandbox_str),
            "content": "Updated content from Text Editor"
        }))
        .await;
    update_res.assert_status_ok();
    
    let updated_content = fs::read_to_string(sandbox.join("documents/hello.txt")).unwrap();
    assert_eq!(updated_content, "Updated content from Text Editor");
    
    // PDF raw view
    let pdf_res = server.get(&format!("/api/files/raw?path={}/documents/manual.pdf", sandbox_str))
        .add_cookie(cookie.clone())
        .await;
    pdf_res.assert_status_ok();
    assert_eq!(pdf_res.header("content-type"), "application/pdf");

    let _ = fs::remove_dir_all(&sandbox);
}

// 8. Security & Path Traversal Guard
#[tokio::test]
async fn test_files_security_and_auth() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let server = TestServer::new(app());
    
    // 1. Unauthenticated request must return 401
    let unauth_res = server.get("/api/files/list?path=/").await;
    unauth_res.assert_status_unauthorized();
    
    let cookie = get_test_cookie();
    
    // 2. Reject access to non-existent path safely
    let traversal_res = server.get("/api/files/list?path=/etc/orbit_non_existent_security_test")
        .add_cookie(cookie.clone())
        .await;
    traversal_res.assert_status(axum::http::StatusCode::NOT_FOUND);
}

// 9. Extraction & Compression
#[tokio::test]
async fn test_files_compression_and_extraction() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let sandbox = setup_test_sandbox();
    let sandbox_str = sandbox.to_str().unwrap();
    let server = TestServer::new(app());
    let cookie = get_test_cookie();

    let file_to_zip = format!("{}/documents/hello.txt", sandbox_str);

    // Compress
    let compress_res = server.post("/api/files/compress")
        .add_cookie(cookie.clone())
        .json(&json!({
            "paths": [file_to_zip],
            "destination_name": "bundle.zip",
            "destination_dir": sandbox_str
        }))
        .await;
    compress_res.assert_status_ok();
    let zip_path = sandbox.join("bundle.zip");
    assert!(zip_path.is_file());

    // Extract
    let extract_dir = sandbox.join("extracted");
    let extract_res = server.post("/api/files/extract")
        .add_cookie(cookie.clone())
        .json(&json!({
            "path": zip_path.to_str().unwrap(),
            "destination": extract_dir.to_str().unwrap()
        }))
        .await;
    extract_res.assert_status_ok();
    assert!(extract_dir.join("hello.txt").is_file());

    let _ = fs::remove_dir_all(&sandbox);
}

// 10. Disk Space Analysis
#[tokio::test]
async fn test_files_disk_analysis() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let sandbox = setup_test_sandbox();
    let sandbox_str = sandbox.to_str().unwrap();
    let server = TestServer::new(app());
    let cookie = get_test_cookie();

    let analyze_res = server.get(&format!("/api/files/analyze?path={}", sandbox_str))
        .add_cookie(cookie.clone())
        .await;
    analyze_res.assert_status_ok();
    let body = analyze_res.text();
    assert!(body.contains("event: complete"));
    assert!(body.contains("data: {"));
    
    // Parse the completed payload
    let data_line = body.lines().find(|l| l.starts_with("data: ")).expect("data line in SSE");
    let json: serde_json::Value = serde_json::from_str(&data_line[6..]).expect("valid json in SSE");
    assert!(json["total_size"].as_u64().unwrap() > 0);
    assert!(json["items"].as_array().unwrap().len() >= 2);

    let _ = fs::remove_dir_all(&sandbox);
}

// 11. Trash Bin Operations (Move, List, Restore, Empty)
#[tokio::test]
async fn test_files_trash_operations() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let sandbox = setup_test_sandbox();
    let sandbox_str = sandbox.to_str().unwrap();
    let server = TestServer::new(app());
    let cookie = get_test_cookie();

    let file_to_trash = format!("{}/documents/hello.txt", sandbox_str);

    // 1. Move to trash
    let trash_res = server.post("/api/files/trash")
        .add_cookie(cookie.clone())
        .json(&json!({ "paths": [file_to_trash] }))
        .await;
    trash_res.assert_status_ok();
    assert!(!Path::new(&file_to_trash).exists());

    // 2. List trash
    let list_res = server.get("/api/files/trash")
        .add_cookie(cookie.clone())
        .await;
    list_res.assert_status_ok();
    let list_json: serde_json::Value = list_res.json();
    let items = list_json["items"].as_array().unwrap();
    assert!(!items.is_empty());
    let item_id = items.last().unwrap()["id"].as_str().unwrap();

    // 3. Restore from trash
    let restore_res = server.post("/api/files/trash/restore")
        .add_cookie(cookie.clone())
        .json(&json!({ "ids": [item_id] }))
        .await;
    restore_res.assert_status_ok();
    assert!(Path::new(&file_to_trash).exists());

    // 4. Empty trash
    let empty_res = server.delete("/api/files/trash")
        .add_cookie(cookie.clone())
        .await;
    empty_res.assert_status_ok();

    let _ = fs::remove_dir_all(&sandbox);
}

// 12. Temporary Share Links & Public Download
#[tokio::test]
async fn test_files_sharing_and_public_download() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let sandbox = setup_test_sandbox();
    let sandbox_str = sandbox.to_str().unwrap();
    let server = TestServer::new(app());
    let cookie = get_test_cookie();

    let share_target = format!("{}/documents/hello.txt", sandbox_str);

    // 1. Create temporary share link
    let share_res = server.post("/api/files/share")
        .add_cookie(cookie.clone())
        .json(&json!({
            "path": share_target,
            "expires_in_seconds": 3600
        }))
        .await;
    share_res.assert_status_ok();
    let share_json: serde_json::Value = share_res.json();
    let token = share_json["token"].as_str().unwrap();
    assert!(!token.is_empty());

    // 2. List active shares
    let list_res = server.get("/api/files/shares")
        .add_cookie(cookie.clone())
        .await;
    list_res.assert_status_ok();
    let shares: serde_json::Value = list_res.json();
    assert!(shares["shares"].as_array().unwrap().iter().any(|s| s["token"] == token));

    // 3. Access public download WITHOUT auth
    let public_res = server.get(&format!("/api/public/share/{}", token)).await;
    public_res.assert_status_ok();
    assert_eq!(public_res.text(), "Hello Orbit File Manager!");

    // 4. Delete share
    let del_res = server.delete(&format!("/api/files/share/{}", token))
        .add_cookie(cookie.clone())
        .await;
    del_res.assert_status_ok();

    // 5. Accessing deleted share should now return 404
    let public_del_res = server.get(&format!("/api/public/share/{}", token)).await;
    public_del_res.assert_status_not_found();

    let _ = fs::remove_dir_all(&sandbox);
}

// 13. Cloud OAuth 2.0 Flow (Google Drive, OneDrive, Dropbox)
#[tokio::test]
async fn test_files_cloud_oauth_flow() {
    unsafe {
        std::env::set_var("JWT_SECRET", "super_secret");
        std::env::set_var("GOOGLE_CLIENT_ID", "test_google_client_id");
        std::env::set_var("GOOGLE_CLIENT_SECRET", "test_google_client_secret");
    }
    let server = TestServer::new(app());
    let cookie = get_test_cookie();

    // 1. Get Google Drive Auth URL
    let gdrive_res = server.get("/api/files/cloud/oauth/auth-url?provider=google_drive")
        .add_cookie(cookie.clone())
        .await;
    gdrive_res.assert_status_ok();
    let gdrive_json: serde_json::Value = gdrive_res.json();
    let gdrive_url = gdrive_json["auth_url"].as_str().unwrap();
    assert!(gdrive_url.contains("accounts.google.com") || gdrive_url.contains("google"));
    assert!(!gdrive_json["state"].as_str().unwrap().is_empty());

    // 2. Get OneDrive Auth URL
    let onedrive_res = server.get("/api/files/cloud/oauth/auth-url?provider=onedrive")
        .add_cookie(cookie.clone())
        .await;
    onedrive_res.assert_status_ok();
    let onedrive_json: serde_json::Value = onedrive_res.json();
    let onedrive_url = onedrive_json["auth_url"].as_str().unwrap();
    assert!(onedrive_url.contains("login.microsoftonline.com") || onedrive_url.contains("microsoft"));

    // 3. Get Dropbox Auth URL
    let dropbox_res = server.get("/api/files/cloud/oauth/auth-url?provider=dropbox")
        .add_cookie(cookie.clone())
        .await;
    dropbox_res.assert_status_ok();
    let dropbox_json: serde_json::Value = dropbox_res.json();
    let dropbox_url = dropbox_json["auth_url"].as_str().unwrap();
    assert!(dropbox_url.contains("dropbox.com"));

    // 4. Handle OAuth Callback / Direct Connect
    let callback_res = server.post("/api/files/cloud/oauth/callback")
        .add_cookie(cookie.clone())
        .json(&json!({
            "provider": "google_drive",
            "name": "Meu Google Drive Pessoal",
            "code": "test_auth_code_123",
            "state": gdrive_json["state"].as_str().unwrap(),
            "mock_access_token": "mock_gdrive_token_xyz"
        }))
        .await;
    callback_res.assert_status_ok();
    let callback_json: serde_json::Value = callback_res.json();
    let account_id = callback_json["account"]["id"].as_str().unwrap();
    assert!(!account_id.is_empty());

    // 5. List files for the connected cloud account
    let cloud_files_res = server.get(&format!("/api/files/cloud/account/{}/files", account_id))
        .add_cookie(cookie.clone())
        .await;
    cloud_files_res.assert_status_ok();
    let cloud_files_json: serde_json::Value = cloud_files_res.json();
    assert!(cloud_files_json["files"].is_array());

    // Cleanup: disconnect account
    let disc_res = server.delete(&format!("/api/files/cloud/disconnect/{}", account_id))
        .add_cookie(cookie.clone())
        .await;
    disc_res.assert_status_ok();
}
