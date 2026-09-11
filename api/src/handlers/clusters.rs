// OptiFleet B2B — Handlers: Clusters
use axum::{Router, routing::get, extract::{State, Path}, Json, middleware, Extension};
use uuid::Uuid;
use crate::{AppState, errors::ApiResult, middleware::auth::{Claims, require_auth}};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_clusters))
        .route("/:id", get(get_cluster))
        .route("/:id/optimize", axum::routing::post(optimize_cluster))
        .route_layer(middleware::from_fn(require_auth))
}

async fn list_clusters(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> ApiResult<Json<serde_json::Value>> {
    Ok(Json(serde_json::json!({"clusters": [], "message": "Cluster list from Supabase"})))
}

async fn get_cluster(
    State(_state): State<AppState>,
    Path(cluster_id): Path<Uuid>,
) -> ApiResult<Json<serde_json::Value>> {
    Ok(Json(serde_json::json!({"id": cluster_id})))
}

async fn optimize_cluster(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(cluster_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> ApiResult<Json<serde_json::Value>> {
    let result = state.ml_client.optimize_routes(&serde_json::json!({
        "cluster_id": cluster_id,
        "depot_lat": body.get("depot_lat").and_then(|v| v.as_f64()).unwrap_or(47.0105),
        "depot_lon": body.get("depot_lon").and_then(|v| v.as_f64()).unwrap_or(28.8638),
        "vehicle_ids": body.get("vehicle_ids").cloned().unwrap_or_default(),
        "time_limit_seconds": 30
    })).await?;
    Ok(Json(result))
}
