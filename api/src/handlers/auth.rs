// OptiFleet B2B — Handlers: Auth (stubs), Health, Vehicles, Clusters
// Fișiere auxiliare pentru completarea modulului handlers

// ── auth.rs ──────────────────────────────────────────────────────────────────
// Notă: Supabase Auth gestionează login/register direct din frontend.
// Rust API validează DOAR JWT-ul emis de Supabase.
// Dacă e nevoie de endpoint custom de auth, se adaugă aici.

use axum::{
    Router,
    routing::get,
    http::HeaderMap,
    Json,
};
use serde_json::json;
use crate::{AppState, errors::{ApiError, ApiResult}, middleware::auth::verify_token};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/verify", get(verify_token_endpoint))
}

async fn verify_token_endpoint(headers: HeaderMap) -> ApiResult<Json<serde_json::Value>> {
    let auth_header = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::Unauthorized("Missing Authorization header".into()))?;

    let token = if auth_header.starts_with("Bearer ") {
        &auth_header[7..]
    } else {
        auth_header
    };

    let secret = std::env::var("SECRET_KEY")
        .or_else(|_| std::env::var("SUPABASE_JWT_SECRET"))
        .unwrap_or_else(|_| "secret".into());

    let claims = verify_token(token, &secret)?;

    Ok(Json(json!({
        "status": "Token valid",
        "sub": claims.sub,
        "company_id": claims.company_id,
        "email": claims.email,
        "roles": claims.roles,
    })))
}
