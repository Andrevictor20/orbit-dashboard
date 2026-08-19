use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

#[derive(Debug, Deserialize)]
pub struct LoginPayload {
    pub password: String,
}

// In a real scenario, this is an Argon2id hash loaded from DB or env.
// For this MVP, we'll use a hardcoded password "admin" for demonstration,
// but the architecture is ready for DB integration.
const ADMIN_PASSWORD: &str = "admin";
const JWT_SECRET: &[u8] = b"super_secret_key_change_me_in_prod";

pub async fn login(
    jar: CookieJar,
    Json(payload): Json<LoginPayload>,
) -> Result<(CookieJar, Json<serde_json::Value>), StatusCode> {
    if payload.password != ADMIN_PASSWORD {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let claims = Claims {
        sub: "admin".to_owned(),
        exp: 10000000000, // Future expiration
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET),
    ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let cookie = Cookie::build(("auth_token", token))
        .path("/")
        .http_only(true)
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
        &DecodingKey::from_secret(JWT_SECRET),
        &Validation::default(),
    ).map_err(|_| StatusCode::UNAUTHORIZED)?;

    // We could store token_data in request extensions if needed later
    req.extensions_mut().insert(token_data.claims);

    Ok(next.run(req).await)
}
