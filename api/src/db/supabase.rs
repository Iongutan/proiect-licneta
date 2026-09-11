// OptiFleet B2B — Rust: Supabase HTTP Client
// Toate interacțiunile cu Supabase REST API
// Folosim reqwest async cu connection pool

use std::sync::Arc;
use reqwest::{Client, header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE}};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

use crate::config::settings::Settings;
use crate::errors::ApiError;

#[derive(Clone)]
pub struct SupabaseClient {
    http: Client,
    base_url: String,
    anon_key: String,
    service_key: String,
}

/// Struct-uri pentru serializare / deserializare Supabase

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrderRow {
    pub id: Option<Uuid>,
    pub company_id: Uuid,
    pub cluster_id: Option<Uuid>,
    pub volume_m3: f64,
    pub weight_kg: f64,
    pub status: String,
    pub pickup_address: Option<String>,
    pub dropoff_address: Option<String>,
    pub pickup_location: Option<String>,   // WKT din PostGIS
    pub dropoff_location: Option<String>,
    pub delivery_window_start: DateTime<Utc>,
    pub delivery_window_end: DateTime<Utc>,
    pub special_instructions: Option<String>,
    pub estimated_discount_pct: Option<f64>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VehicleRow {
    pub id: Option<Uuid>,
    pub carrier_id: Uuid,
    pub license_plate: String,
    pub capacity_m3: f64,
    pub max_weight_kg: f64,
    pub status: String,
    pub current_city: Option<String>,
    pub driver_name: Option<String>,
    pub driver_phone: Option<String>,
}

impl SupabaseClient {
    pub fn new(settings: Arc<Settings>) -> Self {
        // Construiește header-e comune pentru toate request-urile
        let mut headers = HeaderMap::new();
        headers.insert(
            "apikey",
            HeaderValue::from_str(&settings.supabase_anon_key).unwrap(),
        );
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(
            "Prefer",
            HeaderValue::from_static("return=representation"),
        );

        let http = Client::builder()
            .default_headers(headers)
            .pool_max_idle_per_host(50)     // Connection pool: 50 conexiuni per host
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to build HTTP client");

        Self {
            http,
            base_url: settings.supabase_url.clone(),
            anon_key: settings.supabase_anon_key.clone(),
            service_key: settings.supabase_service_role_key.clone(),
        }
    }

    /// Header cu Service Role Key (bypass RLS — pentru operații interne)
    fn service_auth_header(&self) -> HeaderValue {
        HeaderValue::from_str(&format!("Bearer {}", self.service_key)).unwrap()
    }

    /// Header cu JWT utilizator (RLS activ — pentru operații user)
    fn user_auth_header(&self, jwt: &str) -> HeaderValue {
        HeaderValue::from_str(&format!("Bearer {}", jwt)).unwrap()
    }

    // ─── ORDERS ─────────────────────────────────────────────

    /// Inserează comandă nouă în Supabase
    pub async fn insert_order(&self, order: &OrderRow) -> Result<OrderRow, ApiError> {
        let url = format!("{}/rest/v1/orders", self.base_url);

        let response = self.http
            .post(&url)
            .header(AUTHORIZATION, self.service_auth_header())
            .json(order)
            .send()
            .await
            .map_err(|e| ApiError::Database(format!("Insert order failed: {e}")))?;

        if !response.status().is_success() {
            let err = response.text().await.unwrap_or_default();
            return Err(ApiError::Database(format!("Supabase insert error: {err}")));
        }

        let mut rows: Vec<OrderRow> = response.json().await
            .map_err(|e| ApiError::Internal(e.to_string()))?;

        rows.pop().ok_or_else(|| ApiError::Internal("No row returned after insert".into()))
    }

    /// Listează comenzile companiei (folosind JWT utilizator → RLS activ)
    pub async fn get_orders_by_company(
        &self,
        company_id: &Uuid,
        user_jwt: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<OrderRow>, ApiError> {
        let url = format!(
            "{}/rest/v1/orders?company_id=eq.{}&order=created_at.desc&limit={}&offset={}",
            self.base_url, company_id, limit, offset
        );

        let auth_header = if user_jwt.is_empty() {
            self.service_auth_header()
        } else {
            self.user_auth_header(user_jwt)
        };

        let rows: Vec<OrderRow> = self.http
            .get(&url)
            .header(AUTHORIZATION, auth_header)
            .send()
            .await
            .map_err(|e| ApiError::Database(e.to_string()))?
            .json()
            .await
            .map_err(|e| ApiError::Internal(e.to_string()))?;

        Ok(rows)
    }

    /// Obține o comandă specifică (cu validare company_id pentru RLS manual)
    pub async fn get_order(
        &self,
        order_id: &Uuid,
        company_id: &Uuid,
    ) -> Result<Option<OrderRow>, ApiError> {
        let url = format!(
            "{}/rest/v1/orders?id=eq.{}&company_id=eq.{}",
            self.base_url, order_id, company_id
        );

        let mut rows: Vec<OrderRow> = self.http
            .get(&url)
            .header(AUTHORIZATION, self.service_auth_header())
            .send()
            .await
            .map_err(|e| ApiError::Database(e.to_string()))?
            .json()
            .await
            .map_err(|e| ApiError::Internal(e.to_string()))?;

        Ok(rows.pop())
    }

    /// Actualizează statusul comenzii
    pub async fn update_order_status(
        &self,
        order_id: &Uuid,
        status: &str,
    ) -> Result<(), ApiError> {
        let url = format!("{}/rest/v1/orders?id=eq.{}", self.base_url, order_id);

        let body = serde_json::json!({"status": status});

        let resp = self.http
            .patch(&url)
            .header(AUTHORIZATION, self.service_auth_header())
            .json(&body)
            .send()
            .await
            .map_err(|e| ApiError::Database(e.to_string()))?;

        if !resp.status().is_success() {
            return Err(ApiError::Database(format!(
                "Update order status failed: {}",
                resp.text().await.unwrap_or_default()
            )));
        }

        Ok(())
    }

    // ─── VEHICLES ───────────────────────────────────────────

    pub async fn get_vehicles_by_carrier(
        &self,
        carrier_id: &Uuid,
    ) -> Result<Vec<VehicleRow>, ApiError> {
        let url = format!(
            "{}/rest/v1/vehicles?carrier_id=eq.{}&order=created_at.desc",
            self.base_url, carrier_id
        );

        let rows: Vec<VehicleRow> = self.http
            .get(&url)
            .header(AUTHORIZATION, self.service_auth_header())
            .send()
            .await
            .map_err(|e| ApiError::Database(e.to_string()))?
            .json()
            .await
            .map_err(|e| ApiError::Internal(e.to_string()))?;

        Ok(rows)
    }

    /// Actualizează locația vehiculului (apelat frecvent din WebSocket GPS)
    pub async fn update_vehicle_location(
        &self,
        vehicle_id: &Uuid,
        lat: f64,
        lon: f64,
    ) -> Result<(), ApiError> {
        let url = format!("{}/rest/v1/vehicles?id=eq.{}", self.base_url, vehicle_id);

        // WKT format pentru PostGIS
        let wkt = format!("POINT({lon} {lat})");
        let body = serde_json::json!({
            "current_location": wkt,
            "last_location_update": Utc::now().to_rfc3339()
        });

        self.http
            .patch(&url)
            .header(AUTHORIZATION, self.service_auth_header())
            .json(&body)
            .send()
            .await
            .map_err(|e| ApiError::Database(e.to_string()))?;

        Ok(())
    }
}
