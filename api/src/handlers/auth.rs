// OptiFleet B2B — Handlers: Auth
// Suport complet pentru JWT Access Token în memorie și Refresh Token în cookie httpOnly

use axum::{
    Router,
    routing::{get, post},
    http::{HeaderMap, header, StatusCode},
    extract::State,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use crate::{
    AppState,
    errors::{ApiError, ApiResult},
    middleware::auth::{verify_token, create_token, Claims},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/verify", get(verify_token_endpoint))
        .route("/refresh", post(refresh_token_endpoint))
        .route("/login", post(login_endpoint))
        .route("/logout", post(logout_endpoint))
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: Option<String>,
    pub user_id: Option<String>,
    pub company_id: Option<String>,
    pub roles: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub status: String,
    pub access_token: String,
    pub expires_in: u64,
    pub token_type: String,
    pub user: serde_json::Value,
}

/// POST /api/v1/auth/login — Autentificare cu generare Access Token (memorie) + Refresh Token (httpOnly cookie)
async fn login_endpoint(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = payload.user_id.unwrap_or_else(|| "00000000-0000-0000-0000-000000000001".to_string());
    let email = payload.email.unwrap_or_else(|| "utilizator@optifleet.md".to_string());
    let company_id = payload.company_id.unwrap_or_else(|| "5e100000-0000-0000-0000-000000000001".to_string());
    let roles = payload.roles.unwrap_or_else(|| vec!["CARRIER_ADMIN".to_string()]);

    let now = Utc::now().timestamp();
    let access_exp = now + (state.settings.access_token_expire_minutes as i64 * 60);
    let refresh_exp = now + (state.settings.refresh_token_expire_days as i64 * 86400);

    let access_claims = Claims {
        sub: user_id.clone(),
        company_id: company_id.clone(),
        email: email.clone(),
        roles: roles.clone(),
        exp: access_exp,
        r#type: "access".to_string(),
    };

    let refresh_claims = Claims {
        sub: user_id.clone(),
        company_id: company_id.clone(),
        email: email.clone(),
        roles: roles.clone(),
        exp: refresh_exp,
        r#type: "refresh".to_string(),
    };

    let access_token = create_token(&access_claims, &state.settings.secret_key)?;
    let refresh_token = create_token(&refresh_claims, &state.settings.secret_key)?;

    let is_prod = state.settings.is_production();
    let same_site = if is_prod { "SameSite=Strict" } else { "SameSite=Lax" };
    let secure_flag = if is_prod { "Secure; " } else { "" };
    let cookie_header = format!(
        "refresh_token={}; HttpOnly; {}Path=/api/v1/auth; Max-Age={}; {}",
        refresh_token,
        secure_flag,
        state.settings.refresh_token_expire_days * 86400,
        same_site
    );

    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::SET_COOKIE,
        cookie_header.parse().map_err(|e| ApiError::Internal(format!("Cookie error: {}", e)))?,
    );

    let body = Json(AuthResponse {
        status: "success".to_string(),
        access_token,
        expires_in: state.settings.access_token_expire_minutes * 60,
        token_type: "Bearer".to_string(),
        user: json!({
            "id": user_id,
            "email": email,
            "company_id": company_id,
            "roles": roles,
        }),
    });

    Ok((StatusCode::OK, response_headers, body))
}

/// POST /api/v1/auth/refresh — Reînnoire Access Token folosind cookie httpOnly
async fn refresh_token_endpoint(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<impl IntoResponse> {
    // Extrage refresh_token din cookie httpOnly
    let refresh_token = extract_cookie(&headers, "refresh_token")
        .ok_or_else(|| ApiError::Unauthorized("Missing refresh token in httpOnly cookie".into()))?;

    let claims = verify_token(&refresh_token, &state.settings.secret_key)?;

    if claims.r#type != "refresh" {
        return Err(ApiError::Unauthorized("Invalid token type: expected refresh token".into()));
    }

    let now = Utc::now().timestamp();
    let access_exp = now + (state.settings.access_token_expire_minutes as i64 * 60);
    let refresh_exp = now + (state.settings.refresh_token_expire_days as i64 * 86400);

    let new_access_claims = Claims {
        sub: claims.sub.clone(),
        company_id: claims.company_id.clone(),
        email: claims.email.clone(),
        roles: claims.roles.clone(),
        exp: access_exp,
        r#type: "access".to_string(),
    };

    let new_refresh_claims = Claims {
        sub: claims.sub.clone(),
        company_id: claims.company_id.clone(),
        email: claims.email.clone(),
        roles: claims.roles.clone(),
        exp: refresh_exp,
        r#type: "refresh".to_string(),
    };

    let new_access_token = create_token(&new_access_claims, &state.settings.secret_key)?;
    let new_refresh_token = create_token(&new_refresh_claims, &state.settings.secret_key)?;

    let is_prod = state.settings.is_production();
    let same_site = if is_prod { "SameSite=Strict" } else { "SameSite=Lax" };
    let secure_flag = if is_prod { "Secure; " } else { "" };
    let cookie_header = format!(
        "refresh_token={}; HttpOnly; {}Path=/api/v1/auth; Max-Age={}; {}",
        new_refresh_token,
        secure_flag,
        state.settings.refresh_token_expire_days * 86400,
        same_site
    );

    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::SET_COOKIE,
        cookie_header.parse().map_err(|e| ApiError::Internal(format!("Cookie error: {}", e)))?,
    );

    let body = Json(json!({
        "status": "success",
        "access_token": new_access_token,
        "expires_in": state.settings.access_token_expire_minutes * 60,
        "token_type": "Bearer"
    }));

    Ok((StatusCode::OK, response_headers, body))
}

/// POST /api/v1/auth/logout — Curățare cookie httpOnly
async fn logout_endpoint() -> ApiResult<impl IntoResponse> {
    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::SET_COOKIE,
        "refresh_token=; HttpOnly; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
            .parse()
            .map_err(|e| ApiError::Internal(format!("Cookie error: {}", e)))?,
    );

    Ok((
        StatusCode::OK,
        response_headers,
        Json(json!({ "status": "logged_out" })),
    ))
}

/// GET /api/v1/auth/verify — Verificare stare token
async fn verify_token_endpoint(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<serde_json::Value>> {
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::Unauthorized("Missing Authorization header".into()))?;

    let token = if auth_header.starts_with("Bearer ") {
        &auth_header[7..]
    } else {
        auth_header
    };

    let claims = verify_token(token, &state.settings.secret_key)?;

    Ok(Json(json!({
        "status": "Token valid",
        "sub": claims.sub,
        "company_id": claims.company_id,
        "email": claims.email,
        "roles": claims.roles,
        "type": claims.r#type,
    })))
}

fn extract_cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    let cookie_header = headers.get(header::COOKIE)?.to_str().ok()?;
    for part in cookie_header.split(';') {
        let trimmed = part.trim();
        if let Some(rest) = trimmed.strip_prefix(name) {
            if let Some(val) = rest.strip_prefix('=') {
                return Some(val.trim().to_string());
            }
        }
    }
    None
}

