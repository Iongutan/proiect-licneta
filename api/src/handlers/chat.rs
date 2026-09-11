// OptiFleet B2B — Rust Handlers: Chat (SSE Streaming Proxy)
// Primește mesaj de la frontend → trimite la Python ML Service → streameaza înapoi

use axum::{
    Router,
    routing::post,
    extract::State,
    response::IntoResponse,
    http::{HeaderMap, StatusCode},
    Json,
    Extension,
    middleware,
};
use serde::Deserialize;
use serde_json::Value;

use crate::{AppState, middleware::auth::{Claims, require_auth}};

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub messages: Vec<Value>,        // [{role: "user", content: "..."}]
    pub stream: Option<bool>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/message", post(chat_message))
        .route_layer(middleware::from_fn(require_auth))
}

/// POST /api/v1/chat/message
/// Primește conversația, o trimite la Python ML Service,
/// și returnează SSE stream cu răspunsul Claude.
async fn chat_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<ChatRequest>,
) -> impl IntoResponse {
    let messages = serde_json::to_value(&req.messages)
        .unwrap_or(Value::Array(vec![]));

    let user_roles = claims.roles.clone();

    // Obține stream de la Python ML Service
    match state.ml_client.chat_stream(&messages, &user_roles).await {
        Ok(ml_response) => {
            // Forward stream direct la client (zero buffering)
            let byte_stream = ml_response.bytes_stream();

            let headers = {
                let mut h = HeaderMap::new();
                h.insert("Content-Type", "text/event-stream".parse().unwrap());
                h.insert("Cache-Control", "no-cache".parse().unwrap());
                h.insert("X-Accel-Buffering", "no".parse().unwrap());
                h.insert("Connection", "keep-alive".parse().unwrap());
                h
            };

            (StatusCode::OK, headers, axum::body::Body::from_stream(byte_stream))
                .into_response()
        }
        Err(e) => {
            tracing::error!("Chat stream error: {}", e);
            (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({
                "error": "AI service temporarily unavailable",
                "code": "ML_SERVICE_ERROR"
            }))).into_response()
        }
    }
}
