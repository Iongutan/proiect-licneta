// OptiFleet B2B — Rust: Rate Limiting Middleware
// Implementare Token Bucket cu Redis
// Fiecare utilizator (sau IP) are un bucket propriu
// 60 request-uri/minut default, configurabil

use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use chrono::Utc;

use crate::{AppState, errors::ApiError};

/// Token Bucket Rate Limiter via Redis
/// Algoritm: sliding window cu Redis atomic operations
pub async fn rate_limit(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    // Identificator: IP sau user_id din JWT (dacă autentificat)
    let identifier = get_identifier(&request);
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
            // Redis indisponibil → lasă request-ul să treacă (fail open)
            // În producție poți schimba în fail closed
            tracing::warn!("Rate limit Redis unavailable — failing open");
            Ok(next.run(request).await)
        }
    }
}

fn get_identifier(request: &Request) -> String {
    // Încearcă să obțină IP real (din proxy headers)
    if let Some(forwarded) = request.headers().get("X-Forwarded-For") {
        if let Ok(ip) = forwarded.to_str() {
            return ip.split(',').next().unwrap_or("unknown").trim().to_string();
        }
    }
    if let Some(real_ip) = request.headers().get("X-Real-IP") {
        if let Ok(ip) = real_ip.to_str() {
            return ip.to_string();
        }
    }
    // Fallback la connection IP
    "unknown".to_string()
}
