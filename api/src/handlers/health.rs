// OptiFleet B2B — Handler: Health check
use axum::{Router, routing::get, Json};
use serde_json::json;
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/", get(health_check))
}

async fn health_check() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "service": "optifleet-api",
        "runtime": "Rust/Axum",
        "version": env!("CARGO_PKG_VERSION")
    }))
}
