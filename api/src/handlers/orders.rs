// OptiFleet B2B — Rust Handlers: Orders
// CRUD complet pentru comenzi cu validare și RLS manual

use axum::{
    Router,
    routing::{get, post},
    extract::{State, Path, Query},
    http::StatusCode,
    Json,
    middleware,
    Extension,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;
use chrono::{DateTime, Utc};

use crate::{AppState, errors::{ApiError, ApiResult}, middleware::auth::{Claims, require_auth}};
use crate::db::supabase::OrderRow;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateOrderRequest {
    #[validate(range(min = 0.001, max = 100.0))]
    pub volume_m3: f64,
    #[validate(range(min = 0.001, max = 25000.0))]
    pub weight_kg: f64,
    pub width_cm: Option<f64>,
    pub height_cm: Option<f64>,
    pub depth_cm: Option<f64>,
    pub is_fragile: Option<bool>,
    pub requires_refrigeration: Option<bool>,
    #[validate(range(min = -90.0, max = 90.0))]
    pub pickup_lat: f64,
    #[validate(range(min = -180.0, max = 180.0))]
    pub pickup_lon: f64,
    #[validate(range(min = -90.0, max = 90.0))]
    pub dropoff_lat: f64,
    #[validate(range(min = -180.0, max = 180.0))]
    pub dropoff_lon: f64,
    pub pickup_address: Option<String>,
    pub dropoff_address: Option<String>,
    pub delivery_window_start: DateTime<Utc>,
    pub delivery_window_end: DateTime<Utc>,
    pub special_instructions: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OrderResponse {
    pub id: Option<Uuid>,
    pub status: String,
    pub volume_m3: f64,
    pub weight_kg: f64,
    pub pickup_address: Option<String>,
    pub dropoff_address: Option<String>,
    pub delivery_window_start: DateTime<Utc>,
    pub delivery_window_end: DateTime<Utc>,
    pub cluster_id: Option<Uuid>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    #[serde(default = "default_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
}
fn default_limit() -> u32 { 50 }

impl From<OrderRow> for OrderResponse {
    fn from(r: OrderRow) -> Self {
        Self {
            id: r.id,
            status: r.status,
            volume_m3: r.volume_m3,
            weight_kg: r.weight_kg,
            pickup_address: r.pickup_address,
            dropoff_address: r.dropoff_address,
            delivery_window_start: r.delivery_window_start,
            delivery_window_end: r.delivery_window_end,
            cluster_id: r.cluster_id,
            created_at: r.created_at,
        }
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create_order).get(list_orders))
        .route("/:id", get(get_order))
        .route("/:id/cancel", post(cancel_order))
        .route_layer(middleware::from_fn(require_auth))
}

/// POST /api/v1/orders
async fn create_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<CreateOrderRequest>,
) -> ApiResult<(StatusCode, Json<OrderResponse>)> {
    // Validare struct
    req.validate().map_err(|e| ApiError::Validation(e.to_string()))?;

    // Validare business
    if req.delivery_window_end <= req.delivery_window_start {
        return Err(ApiError::BadRequest(
            "delivery_window_end must be after delivery_window_start".into()
        ));
    }

    let company_id = claims.company_uuid()?;

    // Construiește row Supabase (pickup/dropoff ca WKT)
    let row = OrderRow {
        id: None,
        company_id,
        cluster_id: None,
        volume_m3: req.volume_m3,
        weight_kg: req.weight_kg,
        status: "PENDING".to_string(),
        pickup_location: Some(format!("POINT({} {})", req.pickup_lon, req.pickup_lat)),
        dropoff_location: Some(format!("POINT({} {})", req.dropoff_lon, req.dropoff_lat)),
        pickup_address: req.pickup_address,
        dropoff_address: req.dropoff_address,
        delivery_window_start: req.delivery_window_start,
        delivery_window_end: req.delivery_window_end,
        special_instructions: req.special_instructions,
        estimated_discount_pct: None,
        created_at: None,
    };

    let saved = state.supabase.insert_order(&row).await?;
    let order_id = saved.id.unwrap_or_default();

    // Trigger clustering async (fără să blocăm răspunsul)
    let ml = state.ml_client.clone();
    tokio::spawn(async move {
        if let Err(e) = ml.trigger_clustering(req.pickup_lat, req.pickup_lon, 15.0).await {
            tracing::warn!("Clustering trigger failed for order {}: {}", order_id, e);
        }
    });

    Ok((StatusCode::CREATED, Json(saved.into())))
}

/// GET /api/v1/orders
async fn list_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(pagination): Query<PaginationQuery>,
) -> ApiResult<Json<Vec<OrderResponse>>> {
    let company_id = claims.company_uuid()?;

    // Extrage JWT original din claims pentru a-l trimite la Supabase (RLS)
    let orders = state.supabase
        .get_orders_by_company(&company_id, "", pagination.limit, pagination.offset)
        .await?;

    Ok(Json(orders.into_iter().map(Into::into).collect()))
}

/// GET /api/v1/orders/:id
async fn get_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> ApiResult<Json<OrderResponse>> {
    let company_id = claims.company_uuid()?;

    let order = state.supabase
        .get_order(&order_id, &company_id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Order {order_id}")))?;

    Ok(Json(order.into()))
}

/// POST /api/v1/orders/:id/cancel
async fn cancel_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    let company_id = claims.company_uuid()?;

    // Verifică că comanda aparține companiei
    let order = state.supabase
        .get_order(&order_id, &company_id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Order {order_id}")))?;

    // Business rule: nu poți anula comenzi deja livrate sau în tranzit
    if matches!(order.status.as_str(), "IN_TRANSIT" | "DELIVERED") {
        return Err(ApiError::BadRequest(format!(
            "Cannot cancel order in status '{}'", order.status
        )));
    }

    state.supabase.update_order_status(&order_id, "CANCELLED").await?;

    Ok(StatusCode::NO_CONTENT)
}
