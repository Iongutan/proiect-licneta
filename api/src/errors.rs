// OptiFleet B2B — Rust API: Error Types
// Ierarhie de erori cu conversie automată la răspuns HTTP JSON

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("ML service unavailable: {0}")]
    MLServiceError(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

/// Conversie automată ApiError → HTTP Response JSON
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            ApiError::NotFound(m)        => (StatusCode::NOT_FOUND, "NOT_FOUND", m.as_str()),
            ApiError::BadRequest(m)      => (StatusCode::BAD_REQUEST, "BAD_REQUEST", m.as_str()),
            ApiError::Validation(m)      => (StatusCode::UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", m.as_str()),
            ApiError::Unauthorized(m)    => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED", m.as_str()),
            ApiError::Forbidden(m)       => (StatusCode::FORBIDDEN, "FORBIDDEN", m.as_str()),
            ApiError::RateLimitExceeded  => (StatusCode::TOO_MANY_REQUESTS, "RATE_LIMIT", "Too many requests. Please slow down."),
            ApiError::MLServiceError(m)  => (StatusCode::SERVICE_UNAVAILABLE, "ML_SERVICE_ERROR", m.as_str()),
            ApiError::Database(m)        => (StatusCode::INTERNAL_SERVER_ERROR, "DATABASE_ERROR", m.as_str()),
            ApiError::Internal(m)        => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", m.as_str()),
        };

        (
            status,
            Json(json!({
                "error": {
                    "code": code,
                    "message": message,
                    "status": status.as_u16()
                }
            })),
        )
            .into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
