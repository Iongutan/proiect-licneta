// OptiFleet B2B — Rust: ML Service HTTP Client
// Proxy toate request-urile care necesită ML/AI la Python service
// Streaming SSE: forwarding direct fără buffering

use reqwest::{Client, Response};
use serde_json::Value;
use crate::errors::ApiError;

#[derive(Clone)]
pub struct MLServiceClient {
    http: Client,
    base_url: String,
}

impl MLServiceClient {
    pub fn new(base_url: &str) -> Self {
        let http = Client::builder()
            .pool_max_idle_per_host(20)
            .timeout(std::time::Duration::from_secs(120))  // AI poate dura mai mult
            .build()
            .expect("Failed to build ML client");

        Self {
            http,
            base_url: base_url.to_string(),
        }
    }

    /// Declanșează clustering pentru o zonă (fire-and-forget safe)
    pub async fn trigger_clustering(
        &self,
        center_lat: f64,
        center_lon: f64,
        radius_km: f64,
    ) -> Result<Value, ApiError> {
        let url = format!("{}/internal/v1/clustering/trigger", self.base_url);
        let body = serde_json::json!({
            "center_lat": center_lat,
            "center_lon": center_lon,
            "radius_km": radius_km,
            "window_hours": 24.0
        });

        let resp = self.http
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| ApiError::MLServiceError(format!("Clustering trigger failed: {e}")))?;

        if !resp.status().is_success() {
            let err = resp.text().await.unwrap_or_default();
            return Err(ApiError::MLServiceError(format!("ML clustering error: {err}")));
        }

        let data: Value = resp.json().await
            .map_err(|e| ApiError::Internal(e.to_string()))?;

        Ok(data)
    }

    /// Inițiază chat cu AI (returnează Response pentru streaming SSE)
    pub async fn chat_stream(
        &self,
        messages: &Value,
        user_roles: &[String],
    ) -> Result<Response, ApiError> {
        let url = format!("{}/internal/v1/chat/stream", self.base_url);
        let body = serde_json::json!({
            "messages": messages,
            "user_roles": user_roles,
            "stream": true
        });

        let resp = self.http
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| ApiError::MLServiceError(format!("Chat stream failed: {e}")))?;

        if !resp.status().is_success() {
            let err = resp.text().await.unwrap_or_default();
            return Err(ApiError::MLServiceError(format!("ML chat error: {err}")));
        }

        Ok(resp)
    }

    /// Optimizare rute pentru un cluster
    pub async fn optimize_routes(&self, payload: &Value) -> Result<Value, ApiError> {
        let url = format!("{}/internal/v1/optimization/route", self.base_url);

        let resp = self.http
            .post(&url)
            .json(payload)
            .send()
            .await
            .map_err(|e| ApiError::MLServiceError(format!("Optimization failed: {e}")))?;

        if !resp.status().is_success() {
            return Err(ApiError::MLServiceError(
                resp.text().await.unwrap_or_default()
            ));
        }

        let data: Value = resp.json().await
            .map_err(|e| ApiError::Internal(e.to_string()))?;

        Ok(data)
    }
}
