// OptiFleet B2B — Rust API main.rs (FULL — cu module + server)
use axum::{Router, middleware as axum_middleware};
use tower_http::{
    cors::{Any, CorsLayer},
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

    let cors = CorsLayer::new()
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_origin(Any);

    let app = Router::new()
        .nest("/api/v1/auth",     handlers::auth::router())
        .nest("/api/v1/health",   handlers::health::router())
        .nest("/api/v1/orders",   handlers::orders::router())
        .nest("/api/v1/vehicles", handlers::vehicles::router())
        .nest("/api/v1/clusters", handlers::clusters::router())
        .nest("/api/v1/chat",     handlers::chat::router())
        .nest("/ws",              handlers::websocket::router())
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
