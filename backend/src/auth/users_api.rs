use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use axum::{
    extract::{Extension, Path},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, put},
    Json, Router,
};
use serde::Deserialize;
use std::time::{SystemTime, UNIX_EPOCH};

use super::jwt::Claims;
use super::permissions::{User, UserPublicProfile, UserRole};
use super::{load_users, save_users};

#[derive(Debug, Deserialize)]
pub struct CreateUserPayload {
    pub username: String,
    pub display_name: Option<String>,
    pub password: String,
    #[serde(default)]
    pub role: UserRole,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserPayload {
    pub display_name: Option<String>,
    pub role: Option<UserRole>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ResetUserPasswordPayload {
    pub new_password: String,
}

pub fn router() -> Router<crate::state::AppState> {
    Router::new()
        .route("/api/users", get(list_users).post(create_user))
        .route("/api/users/{id}", put(update_user).delete(delete_user_handler))
        .route("/api/users/{id}/reset-password", post(reset_user_password))
}

pub async fn list_users(
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<UserPublicProfile>>, StatusCode> {
    if claims.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }
    let users = load_users();
    let profiles: Vec<UserPublicProfile> = users.iter().map(UserPublicProfile::from).collect();
    Ok(Json(profiles))
}

pub async fn create_user(
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateUserPayload>,
) -> Result<(StatusCode, Json<UserPublicProfile>), (StatusCode, Json<serde_json::Value>)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": "Apenas administradores podem criar usuários." }))));
    }

    let trimmed_username = payload.username.trim().to_lowercase();
    if trimmed_username.len() < 3 || payload.password.len() < 6 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Nome de usuário deve ter pelo menos 3 caracteres e senha pelo menos 6 caracteres." })),
        ));
    }

    let mut users = load_users();
    if users.iter().any(|u| u.username.to_lowercase() == trimmed_username) {
        return Err((
            StatusCode::CONFLICT,
            Json(serde_json::json!({ "error": "Este nome de usuário já está em uso." })),
        ));
    }

    let salt = SaltString::generate(&mut OsRng);
    let hash = match Argon2::default().hash_password(payload.password.as_bytes(), &salt) {
        Ok(h) => h.to_string(),
        Err(_) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Falha ao gerar hash de senha." })),
            ));
        }
    };

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let new_user = User {
        id: uuid::Uuid::new_v4().to_string(),
        username: trimmed_username,
        display_name: payload.display_name.filter(|d| !d.trim().is_empty()),
        hash,
        role: payload.role,
        allowed_modules: None,
        is_active: true,
        totp_secret: None,
        totp_enabled: false,
        recovery_codes: Vec::new(),
        created_at: now,
    };

    let profile = UserPublicProfile::from(&new_user);
    users.push(new_user);

    if save_users(&users).is_err() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Falha ao salvar usuário no banco de dados." })),
        ));
    }

    Ok((StatusCode::CREATED, Json(profile)))
}

pub async fn update_user(
    Extension(claims): Extension<Claims>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateUserPayload>,
) -> Result<Json<UserPublicProfile>, (StatusCode, Json<serde_json::Value>)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": "Acesso negado." }))));
    }

    let mut users = load_users();
    let index = match users.iter().position(|u| u.id == id) {
        Some(idx) => idx,
        None => return Err((StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Usuário não encontrado." })))),
    };

    // Segurança: Garantir que sempre reste ao menos 1 admin ativo no sistema
    let is_target_admin = users[index].role.is_admin();
    let total_active_admins = users.iter().filter(|u| u.role.is_admin() && u.is_active).count();

    if is_target_admin {
        if let Some(new_role) = payload.role {
            if !new_role.is_admin() && total_active_admins <= 1 {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "error": "Não é permitido remover o papel do único administrador ativo do sistema." })),
                ));
            }
        }
        if let Some(false) = payload.is_active {
            if total_active_admins <= 1 {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "error": "Não é permitido suspender o único administrador ativo do sistema." })),
                ));
            }
        }
    }

    if let Some(name) = payload.display_name {
        users[index].display_name = Some(name);
    }
    if let Some(new_role) = payload.role {
        users[index].role = new_role;
    }
    if let Some(active) = payload.is_active {
        users[index].is_active = active;
    }

    let profile = UserPublicProfile::from(&users[index]);

    if save_users(&users).is_err() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Falha ao persistir alterações do usuário." })),
        ));
    }

    Ok(Json(profile))
}

pub async fn reset_user_password(
    Extension(claims): Extension<Claims>,
    Path(id): Path<String>,
    Json(payload): Json<ResetUserPasswordPayload>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": "Acesso negado." }))));
    }

    if payload.new_password.len() < 6 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "A nova senha deve ter pelo menos 6 caracteres." })),
        ));
    }

    let mut users = load_users();
    let user = match users.iter_mut().find(|u| u.id == id) {
        Some(u) => u,
        None => return Err((StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Usuário não encontrado." })))),
    };

    let salt = SaltString::generate(&mut OsRng);
    let hash = match Argon2::default().hash_password(payload.new_password.as_bytes(), &salt) {
        Ok(h) => h.to_string(),
        Err(_) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Falha ao gerar hash da nova senha." })),
            ));
        }
    };

    user.hash = hash;

    if save_users(&users).is_err() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Falha ao persistir nova senha." })),
        ));
    }

    Ok((StatusCode::OK, Json(serde_json::json!({ "message": "Senha redefinida com sucesso." }))))
}

pub async fn delete_user_handler(
    Extension(claims): Extension<Claims>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": "Acesso negado." }))));
    }

    let mut users = load_users();
    let index = match users.iter().position(|u| u.id == id) {
        Some(idx) => idx,
        None => return Err((StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Usuário não encontrado." })))),
    };

    // Não permite que o admin delete a si próprio por engano
    if users[index].username == claims.sub {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Você não pode excluir sua própria conta enquanto estiver logado." })),
        ));
    }

    // Não permite deletar se for o único admin
    if users[index].role.is_admin() {
        let total_active_admins = users.iter().filter(|u| u.role.is_admin() && u.is_active).count();
        if total_active_admins <= 1 {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Não é permitido excluir o único administrador ativo do sistema." })),
            ));
        }
    }

    users.remove(index);

    if save_users(&users).is_err() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Falha ao salvar alterações no banco de dados." })),
        ));
    }

    Ok((StatusCode::OK, Json(serde_json::json!({ "message": "Usuário excluído com sucesso." }))))
}
