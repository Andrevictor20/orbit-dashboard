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

pub fn get_jwt_secret() -> &'static [u8] {
    static SECRET: OnceLock<Vec<u8>> = OnceLock::new();
    SECRET.get_or_init(|| {
        if let Ok(key) = std::env::var("JWT_SECRET") {
            key.into_bytes()
        } else {
            panic!("FATAL: JWT_SECRET not found in .env. Configure it before starting.");
        }
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

pub async fn login(
    jar: CookieJar,
    parts: axum::http::request::Parts,
    Json(payload): Json<LoginPayload>,
) -> Result<(CookieJar, Json<serde_json::Value>), StatusCode> {
    let expected_username = std::env::var("ORBIT_USERNAME").unwrap_or_else(|_| "admin".to_string());
    let expected_password = std::env::var("ORBIT_PASSWORD").unwrap_or_else(|_| "admin".to_string());

    let client_ip = parts.extensions.get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|a| a.0.ip().to_string())
        .unwrap_or_else(|| "127.0.0.1".to_string());
    
    if !check_rate_limit(&client_ip) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    // Constant Time Comparison to prevent timing attacks
    let user_match = if payload.username.len() == expected_username.len() {
        payload.username.as_bytes().ct_eq(expected_username.as_bytes())
    } else {
        subtle::Choice::from(0)
    };
    let pass_match = if payload.password.len() == expected_password.len() {
        payload.password.as_bytes().ct_eq(expected_password.as_bytes())
    } else {
        subtle::Choice::from(0)
    };

    let is_match: bool = (user_match & pass_match).into();
    if !is_match {
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
        // Attempt 5 should lock
        assert!(check_rate_limit(ip));
        record_failed_attempt(ip);
        // Attempt 6 should fail
        assert!(!check_rate_limit(ip));
        
        // Clear attempts should restore access
        clear_attempts(ip);
        assert!(check_rate_limit(ip));
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
