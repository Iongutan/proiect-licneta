// OptiFleet B2B — Rust API main.rs (FULL — cu module + server)
use axum::{
    Router,
    middleware as axum_middleware,
    http::{Method, header, HeaderValue},
    routing::get,
    response::IntoResponse,
};
use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
    compression::CompressionLayer,
    limit::RequestBodyLimitLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use std::net::SocketAddr;
use std::sync::Arc;

mod config;
mod errors;
mod handlers;
mod middleware;
mod db;
mod services;

#[cfg(test)]
mod tests;

use config::settings::Settings;
use db::{supabase::SupabaseClient, redis::RedisClient};
use services::ml_client::MLServiceClient;

#[derive(Clone)]
pub struct AppState {
    pub settings: Arc<Settings>,
    pub supabase: SupabaseClient,
    pub redis: RedisClient,
    pub ml_client: MLServiceClient,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "optifleet_api=info,tower_http=warn".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let settings = Settings::from_env().expect("Failed to load settings");
    let port = settings.app_port;
    let settings = Arc::new(settings);

    let supabase = SupabaseClient::new(Arc::clone(&settings));
    let redis = RedisClient::new(&settings.redis_url).await
        .expect("Failed to connect to Redis");
    let ml_client = MLServiceClient::new(&settings.ml_service_url);

    let state = AppState { settings: Arc::clone(&settings), supabase, redis, ml_client };

    // PROMPT J2: Restricționare strictă CORS pe baza mediului
    // Elimină complet allow_origin(Any) și permite doar origini autorizate
    let allowed_methods = vec![
        Method::GET,
        Method::POST,
        Method::PUT,
        Method::DELETE,
        Method::OPTIONS,
        Method::PATCH,
    ];

    let allowed_headers = vec![
        header::AUTHORIZATION,
        header::CONTENT_TYPE,
        header::ACCEPT,
        header::COOKIE,
        header::HeaderName::from_static("x-requested-with"),
    ];

    let mut cors = CorsLayer::new()
        .allow_methods(allowed_methods)
        .allow_headers(allowed_headers)
        .allow_credentials(true);

    if state.settings.is_development() {
        let dev_origins = [
            "http://localhost:3000".parse::<HeaderValue>().unwrap(),
            "http://127.0.0.1:3000".parse::<HeaderValue>().unwrap(),
        ];
        cors = cors.allow_origin(dev_origins);
    } else {
        let prod_origins: Vec<HeaderValue> = state
            .settings
            .cors_allowed_origins
            .iter()
            .filter_map(|o| o.parse::<HeaderValue>().ok())
            .collect();
        cors = cors.allow_origin(prod_origins);
    }

    let app = Router::new()
        .nest("/api/v1/auth",     handlers::auth::router())
        .nest("/api/v1/health",   handlers::health::router())
        .nest("/api/v1/orders",   handlers::orders::router())
        .nest("/api/v1/vehicles", handlers::vehicles::router())
        .nest("/api/v1/clusters", handlers::clusters::router())
        .nest("/api/v1/chat",     handlers::chat::router())
        .nest("/ws",              handlers::websocket::router())
        // PROMPT J9: Observabilitate — Prometheus Metrics Endpoint
        .route("/metrics",        get(metrics_endpoint))
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            middleware::rate_limit::rate_limit,
        ))
        .layer(RequestBodyLimitLayer::new(10 * 1024 * 1024))
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("🦀 OptiFleet Rust API → http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

/// Endpoint Prometheus metrics pentru observabilitate (PROMPT J9)
async fn metrics_endpoint(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> impl IntoResponse {
    let body = format!(
        "# HELP optifleet_app_info Informații despre versiune și mediu de execuție\n\
         # TYPE optifleet_app_info gauge\n\
         optifleet_app_info{{version=\"1.0.0\",environment=\"{}\"}} 1\n\
         # HELP optifleet_rate_limit_per_minute Valoarea de rate limiting activă\n\
         # TYPE optifleet_rate_limit_per_minute gauge\n\
         optifleet_rate_limit_per_minute {}\n",
        state.settings.environment,
        state.settings.rate_limit_per_minute,
    );

    (
        [(header::CONTENT_TYPE, "text/plain; version=0.0.4; charset=utf-8")],
        body,
    )
}

