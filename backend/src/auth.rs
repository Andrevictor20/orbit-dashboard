use axum::{
    http::StatusCode,
    response::Response,
    Json,
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use serde::{Deserialize, Serialize};
use std::sync::{OnceLock, Mutex};
use std::collections::HashMap;
use std::time::{Instant, Duration, SystemTime, UNIX_EPOCH};
use subtle::ConstantTimeEq;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use std::fs;
use std::path::Path;

fn get_auth_file_path() -> String {
    std::env::var("ORBIT_AUTH_FILE").unwrap_or_else(|_| "data/orbit_auth.json".to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthData {
    pub username: String,
    pub hash: String,
}

fn get_auth_data() -> Option<AuthData> {
    if let Ok(content) = fs::read_to_string(get_auth_file_path()) {
        serde_json::from_str(&content).ok()
    } else {
        None
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

#[derive(Debug, Deserialize)]
pub struct LoginPayload {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordPayload {
    pub current_password: String,
    pub new_password: String,
}

pub fn get_jwt_secret() -> &'static [u8] {
    static SECRET: OnceLock<Vec<u8>> = OnceLock::new();
    SECRET.get_or_init(|| {
        // Fallback for tests or explicit override
        if let Ok(key) = std::env::var("JWT_SECRET") {
            return key.into_bytes();
        }

        let secret_path = std::path::Path::new("data/jwt.secret");
        if secret_path.exists() {
            match std::fs::read_to_string(secret_path) {
                Ok(key) if !key.trim().is_empty() => return key.trim().to_string().into_bytes(),
                _ => tracing::warn!("Failed to read existing data/jwt.secret, generating new one"),
            }
        }

        // Generate a new secure random secret using UUIDs
        let new_key = format!("{}{}", uuid::Uuid::new_v4(), uuid::Uuid::new_v4()).replace("-", "");
        
        let _ = std::fs::create_dir_all("data");
        if let Err(e) = std::fs::write(secret_path, &new_key) {
            tracing::error!("Failed to save JWT secret to {:?}: {}", secret_path, e);
        } else {
            tracing::info!("Generated new JWT secret and saved to {:?}", secret_path);
        }
        
        new_key.into_bytes()
    }).as_slice()
}

// Rate Limiter tracking: IP -> (Failed Attempts, Lock Expiration)
static RATE_LIMITS: OnceLock<Mutex<HashMap<String, (usize, Instant)>>> = OnceLock::new();

fn check_rate_limit(ip: &str) -> bool {
    let limits = RATE_LIMITS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut map = limits.lock().unwrap();
    if let Some(&(attempts, lock_until)) = map.get(ip) {
        if Instant::now() < lock_until {
            return false; // locked
        } else if attempts >= 5 {
            // lock expired, reset
            map.remove(ip);
        }
    }
    true
}

fn record_failed_attempt(ip: &str) {
    let limits = RATE_LIMITS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut map = limits.lock().unwrap();
    let entry = map.entry(ip.to_string()).or_insert((0, Instant::now()));
    entry.0 += 1;
    if entry.0 >= 5 {
        entry.1 = Instant::now() + Duration::from_secs(300); // Lock for 5 mins
    }
}

fn clear_attempts(ip: &str) {
    let limits = RATE_LIMITS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut map = limits.lock().unwrap();
    map.remove(ip);
}

pub async fn status() -> Result<Json<serde_json::Value>, StatusCode> {
    let needs_setup = !Path::new(&get_auth_file_path()).exists();
    Ok(Json(serde_json::json!({ "needs_setup": needs_setup })))
}

pub async fn setup(
    jar: CookieJar,
    Json(payload): Json<LoginPayload>,
) -> Result<(CookieJar, Json<serde_json::Value>), StatusCode> {
    let auth_file = get_auth_file_path();
    if Path::new(&auth_file).exists() {
        return Err(StatusCode::FORBIDDEN);
    }

    if payload.username.is_empty() || payload.password.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(payload.password.as_bytes(), &salt)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .to_string();

    let auth_data = AuthData {
        username: payload.username.clone(),
        hash,
    };

    if let Some(parent) = Path::new(&auth_file).parent() {
        let _ = fs::create_dir_all(parent);
    }

    let json = serde_json::to_string(&auth_data).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if let Err(_) = fs::write(&auth_file, json) {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let expiration = SystemTime::now()
        .checked_add(Duration::from_secs(2 * 3600))
        .unwrap()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize;

    let claims = Claims {
        sub: payload.username,
        exp: expiration,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(get_jwt_secret()),
    ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let cookie = Cookie::build(("auth_token", token))
        .path("/")
        .http_only(true)
        .same_site(SameSite::Strict)
        .max_age(time::Duration::hours(2))
        .build();

    Ok((
        jar.add(cookie),
        Json(serde_json::json!({ "message": "setup complete" })),
    ))
}

pub async fn login(
    jar: CookieJar,
    parts: axum::http::request::Parts,
    Json(payload): Json<LoginPayload>,
) -> Result<(CookieJar, Json<serde_json::Value>), StatusCode> {
    let client_ip = parts.extensions.get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|a| a.0.ip().to_string())
        .unwrap_or_else(|| "127.0.0.1".to_string());
    
    if !check_rate_limit(&client_ip) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    let auth_data = match get_auth_data() {
        Some(data) => data,
        None => {
            record_failed_attempt(&client_ip);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    let user_match = if payload.username.len() == auth_data.username.len() {
        payload.username.as_bytes().ct_eq(auth_data.username.as_bytes())
    } else {
        subtle::Choice::from(0)
    };

    if user_match.unwrap_u8() == 0 {
        record_failed_attempt(&client_ip);
        return Err(StatusCode::UNAUTHORIZED);
    }

    let parsed_hash = match PasswordHash::new(&auth_data.hash) {
        Ok(h) => h,
        Err(_) => {
            record_failed_attempt(&client_ip);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    if Argon2::default().verify_password(payload.password.as_bytes(), &parsed_hash).is_err() {
        record_failed_attempt(&client_ip);
        return Err(StatusCode::UNAUTHORIZED);
    }

    clear_attempts(&client_ip);

    let expiration = SystemTime::now()
        .checked_add(Duration::from_secs(2 * 3600))
        .unwrap()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize;

    let claims = Claims {
        sub: "admin".to_owned(),
        exp: expiration,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(get_jwt_secret()),
    ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let cookie = Cookie::build(("auth_token", token))
        .path("/")
        .http_only(true)
        .same_site(SameSite::Strict)
        .max_age(time::Duration::hours(2))
        .build();

    Ok((
        jar.add(cookie),
        Json(serde_json::json!({ "message": "success" })),
    ))
}

pub async fn change_password(
    jar: CookieJar,
    Json(payload): Json<ChangePasswordPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Requires auth first
    let token = jar
        .get("auth_token")
        .map(|cookie| cookie.value())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let _token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(get_jwt_secret()),
        &Validation::default(),
    ).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let mut auth_data = get_auth_data().ok_or(StatusCode::UNAUTHORIZED)?;

    // Verify current password
    let parsed_hash = PasswordHash::new(&auth_data.hash).map_err(|_| StatusCode::UNAUTHORIZED)?;
    if Argon2::default().verify_password(payload.current_password.as_bytes(), &parsed_hash).is_err() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Hash new password
    let salt = SaltString::generate(&mut OsRng);
    let new_hash = Argon2::default()
        .hash_password(payload.new_password.as_bytes(), &salt)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .to_string();

    auth_data.hash = new_hash;

    // Save
    let json = serde_json::to_string(&auth_data).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if let Err(_) = fs::write(get_auth_file_path(), json) {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    Ok(Json(serde_json::json!({ "message": "password updated" })))
}

pub async fn require_auth(
    jar: CookieJar,
    mut req: axum::extract::Request,
    next: axum::middleware::Next,
) -> Result<Response, StatusCode> {
    let token = jar
        .get("auth_token")
        .map(|cookie| cookie.value())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(get_jwt_secret()),
        &Validation::default(),
    ).map_err(|_| StatusCode::UNAUTHORIZED)?;

    // We could store token_data in request extensions if needed later
    req.extensions_mut().insert(token_data.claims);

    Ok(next.run(req).await)
}

pub async fn me(jar: CookieJar) -> Result<Json<serde_json::Value>, StatusCode> {
    let token = jar
        .get("auth_token")
        .map(|cookie| cookie.value())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    decode::<Claims>(
        token,
        &DecodingKey::from_secret(get_jwt_secret()),
        &Validation::default(),
    ).map(|_| Json(serde_json::json!({ "authenticated": true })))
     .map_err(|_| StatusCode::UNAUTHORIZED)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limiter() {
        let ip = "192.168.1.100";
        // Attempt 1 to 4 should pass
        for _ in 0..4 {
            assert!(check_rate_limit(ip));
            record_failed_attempt(ip);
        }
        // Attempt 5 should still pass
        assert!(check_rate_limit(ip));
        record_failed_attempt(ip);
        
        // Attempt 6 MUST fail (this kills the `<` vs `<=` mutant)
        assert_eq!(check_rate_limit(ip), false);
        
        // Clear attempts should restore access
        clear_attempts(ip);
        assert!(check_rate_limit(ip));
    }

    #[test]
    fn test_get_jwt_secret() {
        unsafe { std::env::set_var("JWT_SECRET", "test_secret_value"); }
        let secret = get_jwt_secret();
        assert!(secret.len() > 0, "Secret should not be empty");
        // This kills the vec![0] or Vec::new() mutants
        assert_eq!(secret, b"test_secret_value");
    }

    #[test]
    fn test_jwt_claims_struct() {
        let claims = Claims {
            sub: "admin".to_string(),
            exp: 10000,
        };
        assert_eq!(claims.sub, "admin");
        assert_eq!(claims.exp, 10000);
    }
}
