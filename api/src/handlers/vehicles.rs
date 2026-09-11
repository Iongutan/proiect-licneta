// OptiFleet B2B — Handlers: Vehicles
use axum::{Router, routing::get, extract::{State, Path}, Json, middleware, Extension};
use uuid::Uuid;
use crate::{AppState, errors::ApiResult, middleware::auth::{Claims, require_auth}};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_vehicles))
        .route("/:id", get(get_vehicle))
        .route_layer(middleware::from_fn(require_auth))
}

async fn list_vehicles(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> ApiResult<Json<Vec<crate::db::supabase::VehicleRow>>> {
    let company_id = claims.company_uuid()?;
    let vehicles = state.supabase.get_vehicles_by_carrier(&company_id).await?;
    Ok(Json(vehicles))
}

async fn get_vehicle(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(vehicle_id): Path<Uuid>,
) -> ApiResult<Json<serde_json::Value>> {
    Ok(Json(serde_json::json!({"id": vehicle_id, "status": "placeholder"})))
}
