// OptiFleet B2B — Rust: Rate Limiting Middleware
// Token Bucket cu Redis sliding window
// Identificare: user_id pentru utilizatori autentificați, IP de încredere din Nginx pentru anonimi

use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use chrono::Utc;

use crate::{AppState, errors::ApiError, middleware::auth::{Claims, verify_token}};

/// Token Bucket Rate Limiter via Redis
pub async fn rate_limit(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    // PROMPT J3: Identificator preferat = user_id din JWT (imposibil de falsificat)
    // Fallback: IP client extras din proxy de încredere Nginx
    let identifier = get_identifier(&request, &state.settings.secret_key);
    let limit = state.settings.rate_limit_per_minute;
    let window_sec = 60u64;

    let key = format!("rate_limit:{}:{}", identifier,
        Utc::now().timestamp() / window_sec as i64);

    // Increment atomic în Redis cu TTL
    match state.redis.increment_with_ttl(&key, window_sec).await {
        Ok(count) if count > limit as i64 => {
            Err(ApiError::RateLimitExceeded)
        }
        Ok(_) => Ok(next.run(request).await),
        Err(_) => {
            // Evaluare fail-open vs fail-closed:
            // Permite cererile esențiale (/health, /auth) chiar dacă Redis e temporar indisponibil
            let path = request.uri().path();
            if path.starts_with("/api/v1/health") || path.starts_with("/api/v1/auth") {
                tracing::warn!("Rate limit Redis unavailable — allowing essential endpoint: {}", path);
                Ok(next.run(request).await)
            } else if state.settings.is_production() {
                // În producție la scară mare (1M utilizatori), fail-closed parțial pentru endpoint-uri grele
                tracing::error!("Rate limit Redis unavailable in production for non-essential path: {} — fail-closed protection", path);
                Err(ApiError::Internal("Service temporarily busy (rate-limiter cache unavailable)".into()))
            } else {
                tracing::warn!("Rate limit Redis unavailable in development — failing open for: {}", path);
                Ok(next.run(request).await)
            }
        }
    }
}

/// Extrage identificatorul unic:
/// 1. Prioritate maximă: user_id din JWT Claims (extensions sau header Authorization)
/// 2. Anonim: adresa IP reală garantată de Nginx
fn get_identifier(request: &Request, secret_key: &str) -> String {
    // 1. Verifică dacă Claims a fost deja injectat în extensions
    if let Some(claims) = request.extensions().get::<Claims>() {
        return format!("user:{}", claims.sub);
    }

    // 2. Verifică dacă există header Authorization Bearer și poate fi decodat
    if let Some(auth_val) = request.headers().get(axum::http::header::AUTHORIZATION) {
        if let Ok(auth_str) = auth_val.to_str() {
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                if let Ok(claims) = verify_token(token.trim(), secret_key) {
                    return format!("user:{}", claims.sub);
                }
            }
        }
    }

    // 3. Fallback la adresa IP:
    // ARHITECTURĂ DE SECURITATE (PROMPT J3):
    // get_identifier() are încredere în header-ul X-Forwarded-For DOAR pentru că Nginx
    // (vezi nginx.conf) este configurat explicit să SUPRASCRIE acest header cu $remote_addr
    // (adresa IP reală a conexiunii TCP):
    //     proxy_set_header X-Forwarded-For $remote_addr;
    // Dacă Nginx este vreodată eliminat sau înlocuit cu un proxy ce doar concatenează ($proxy_add_x_forwarded_for),
    // un atacator ar putea injecta orice IP fals pentru a ocoli limitarea.
    if let Some(forwarded) = request.headers().get("X-Forwarded-For") {
        if let Ok(ip) = forwarded.to_str() {
            let clean_ip = ip.split(',').next().unwrap_or("unknown").trim();
            if !clean_ip.is_empty() {
                return format!("ip:{}", clean_ip);
            }
        }
    }
    if let Some(real_ip) = request.headers().get("X-Real-IP") {
        if let Ok(ip) = real_ip.to_str() {
            let clean_ip = ip.trim();
            if !clean_ip.is_empty() {
                return format!("ip:{}", clean_ip);
            }
        }
    }

    "ip:unknown".to_string()
}

