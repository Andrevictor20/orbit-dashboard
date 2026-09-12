use axum_test::TestServer;
use backend::app;
use backend::auth::{
    generate_recovery_codes, generate_totp_setup, hash_recovery_code,
    verify_and_consume_recovery_code, verify_totp_code,
};
use serde_json::json;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use totp_rs::{Algorithm, Builder, Secret};

#[test]
fn test_totp_generation_and_verification() {
    let setup = generate_totp_setup("admin").expect("Failed to generate TOTP setup");
    assert!(!setup.secret.is_empty());
    assert!(setup.otpauth_url.starts_with("otpauth://totp/"));
    assert!(setup.qr_data_url.starts_with("data:image/png;base64,"));
    assert_eq!(setup.recovery_codes.len(), 8);

    // Compute expected TOTP code for the current timestamp
    let secret = Secret::try_from_base32(&setup.secret).expect("Invalid secret generated");
    let totp = Builder::new()
        .with_algorithm(Algorithm::SHA1)
        .with_digits(6)
        .with_skew(1)
        .with_step_duration(30)
        .with_secret(secret)
        .with_account_name("admin".to_string())
        .with_issuer(Some("Orbit Dashboard".to_string()))
        .build()
        .expect("Failed to build TOTP instance");

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let current_code = totp.generate(now).to_string();
    let past_code = totp.generate(now.saturating_sub(30)).to_string();
    let future_code = totp.generate(now.saturating_add(30)).to_string();

    assert!(verify_totp_code(&setup.secret, "admin", &current_code));
    assert!(verify_totp_code(&setup.secret, "admin", &past_code));
    assert!(verify_totp_code(&setup.secret, "admin", &future_code));
    assert!(!verify_totp_code(&setup.secret, "admin", "000000"));
    assert!(!verify_totp_code(&setup.secret, "admin", "12345"));
}

#[test]
fn test_recovery_codes_single_use() {
    let codes = generate_recovery_codes(8);
    assert_eq!(codes.len(), 8);

    let mut hashes: Vec<String> = codes.iter().map(|c| hash_recovery_code(c)).collect();

    // Consume first code
    assert!(verify_and_consume_recovery_code(&mut hashes, &codes[0]));
    assert_eq!(hashes.len(), 7);

    // Attempting to consume first code AGAIN must fail (single-use guarantee)
    assert!(!verify_and_consume_recovery_code(&mut hashes, &codes[0]));
    assert_eq!(hashes.len(), 7);

    // Invalid code must fail
    assert!(!verify_and_consume_recovery_code(&mut hashes, "INVALID-CODE"));
    assert_eq!(hashes.len(), 7);
}

#[tokio::test]
async fn test_2fa_full_lifecycle_and_anti_bypass() {
    let test_auth_path = "data/orbit_auth_2fa_test.json";
    let _ = fs::remove_file(test_auth_path);

    unsafe {
        std::env::set_var("ORBIT_AUTH_FILE", test_auth_path);
        std::env::set_var("JWT_SECRET", "super_secret_jwt_key_for_testing");
    }

    let server = TestServer::new(app());

    // 1. Initial setup
    let setup_res = server
        .post("/api/auth/setup")
        .json(&json!({
            "username": "admin",
            "password": "initial_password"
        }))
        .await;
    setup_res.assert_status_success();
    let mut auth_cookie = setup_res.cookie("auth_token");

    // 2. Initial 2FA status must be disabled
    let status_res = server
        .get("/api/auth/2fa/status")
        .add_cookie(auth_cookie.clone())
        .await;
    status_res.assert_status_success();
    let status_json: serde_json::Value = status_res.json();
    assert_eq!(status_json["enabled"], false);
    assert_eq!(status_json["recovery_codes_count"], 0);

    // 3. Initiate 2FA Setup
    let setup_2fa_res = server
        .post("/api/auth/2fa/setup")
        .add_cookie(auth_cookie.clone())
        .await;
    setup_2fa_res.assert_status_success();
    let setup_2fa: serde_json::Value = setup_2fa_res.json();

    let secret_base32 = setup_2fa["secret"].as_str().unwrap();
    let recovery_codes = setup_2fa["recovery_codes"].as_array().unwrap();
    assert_eq!(recovery_codes.len(), 8);

    // 4. Try enabling 2FA with an invalid code (should fail with 400 Bad Request)
    let enable_fail = server
        .post("/api/auth/2fa/enable")
        .add_cookie(auth_cookie.clone())
        .json(&json!({
            "secret": secret_base32,
            "code": "000000",
            "recovery_codes": recovery_codes
        }))
        .await;
    enable_fail.assert_status_bad_request();

    // 5. Generate correct code and enable 2FA
    let secret = Secret::try_from_base32(secret_base32).unwrap();
    let totp = Builder::new()
        .with_algorithm(Algorithm::SHA1)
        .with_digits(6)
        .with_skew(1)
        .with_step_duration(30)
        .with_secret(secret)
        .with_account_name("admin".to_string())
        .with_issuer(Some("Orbit Dashboard".to_string()))
        .build()
        .unwrap();

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let valid_code = totp.generate(now).to_string();

    let enable_success = server
        .post("/api/auth/2fa/enable")
        .add_cookie(auth_cookie.clone())
        .json(&json!({
            "secret": secret_base32,
            "code": valid_code,
            "recovery_codes": recovery_codes
        }))
        .await;
    enable_success.assert_status_success();

    // 6. Verify 2FA status is now enabled
    let status_res2 = server
        .get("/api/auth/2fa/status")
        .add_cookie(auth_cookie.clone())
        .await;
    status_res2.assert_status_success();
    let status_json2: serde_json::Value = status_res2.json();
    assert_eq!(status_json2["enabled"], true);
    assert_eq!(status_json2["recovery_codes_count"], 8);

    // 7. Test Login with 2FA enabled
    let login_res = server
        .post("/api/auth/login")
        .json(&json!({
            "username": "admin",
            "password": "initial_password"
        }))
        .await;
    login_res.assert_status_success();
    let login_json: serde_json::Value = login_res.json();
    assert_eq!(login_json["requires_2fa"], true);
    let temp_token = login_json["temp_token"].as_str().unwrap();

    // 8. ANTI-BYPASS SECURITY CHECK:
    // Ensure temp_token CANNOT be used to access protected endpoints
    let bypass_attempt = server
        .get("/api/auth/me")
        .add_header(
            axum::http::header::AUTHORIZATION,
            format!("Bearer {}", temp_token),
        )
        .await;
    bypass_attempt.assert_status_unauthorized();

    // 9. 2FA Login with invalid code -> must fail 401
    let fail_2fa = server
        .post("/api/auth/2fa/login")
        .json(&json!({
            "temp_token": temp_token,
            "code": "000000"
        }))
        .await;
    fail_2fa.assert_status_unauthorized();

    // 10. 2FA Login using one of the single-use recovery codes -> must succeed
    let recovery_code = recovery_codes[0].as_str().unwrap();
    let success_2fa = server
        .post("/api/auth/2fa/login")
        .json(&json!({
            "temp_token": temp_token,
            "code": recovery_code
        }))
        .await;
    success_2fa.assert_status_success();
    let success_2fa_json: serde_json::Value = success_2fa.json();
    assert_eq!(success_2fa_json["used_recovery_code"], true);

    // The real session cookie was issued
    auth_cookie = success_2fa.cookie("auth_token");
    assert!(!auth_cookie.value().is_empty());

    // 11. Protected route works with the authenticated session cookie
    let me_check = server
        .get("/api/auth/me")
        .add_cookie(auth_cookie.clone())
        .await;
    me_check.assert_status_success();

    // 12. Verify recovery code count decreased to 7
    let status_res3 = server
        .get("/api/auth/2fa/status")
        .add_cookie(auth_cookie.clone())
        .await;
    status_res3.assert_status_success();
    let status_json3: serde_json::Value = status_res3.json();
    assert_eq!(status_json3["recovery_codes_count"], 7);

    // 13. Regenerate recovery codes
    let regen_res = server
        .post("/api/auth/2fa/recovery-codes/regenerate")
        .add_cookie(auth_cookie.clone())
        .json(&json!({
            "current_password": "initial_password"
        }))
        .await;
    regen_res.assert_status_success();
    let regen_json: serde_json::Value = regen_res.json();
    let new_codes = regen_json["recovery_codes"].as_array().unwrap();
    assert_eq!(new_codes.len(), 8);

    // 14. Disable 2FA with incorrect password -> fails
    let disable_fail = server
        .post("/api/auth/2fa/disable")
        .add_cookie(auth_cookie.clone())
        .json(&json!({
            "current_password": "wrong_password"
        }))
        .await;
    disable_fail.assert_status_unauthorized();

    // 15. Disable 2FA with correct password -> succeeds
    let disable_success = server
        .post("/api/auth/2fa/disable")
        .add_cookie(auth_cookie.clone())
        .json(&json!({
            "current_password": "initial_password"
        }))
        .await;
    disable_success.assert_status_success();

    // 16. Standard login now works directly again without 2FA
    let direct_login = server
        .post("/api/auth/login")
        .json(&json!({
            "username": "admin",
            "password": "initial_password"
        }))
        .await;
    direct_login.assert_status_success();
    let direct_json: serde_json::Value = direct_login.json();
    assert_eq!(direct_json["requires_2fa"], false);

    // Clean up test file
    let _ = fs::remove_file(test_auth_path);
}
