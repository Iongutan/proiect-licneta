// OptiFleet B2B — Rust Handlers: WebSocket GPS Real-Time
// Gestionează tracking live pentru vehicule
// O conexiune WebSocket = ~2KB RAM (Tokio async task)
// La 1M vehicule = ~2GB RAM (vs 50GB cu Python threads)

use axum::{
    Router,
    routing::get,
    extract::{
        WebSocketUpgrade, State, Path,
        ws::{WebSocket, Message},
    },
    response::IntoResponse,
};
use futures::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::Utc;

use crate::AppState;

#[derive(Debug, Deserialize)]
struct LocationUpdate {
    lat: f64,
    lon: f64,
    speed_kmh: Option<f64>,
    heading: Option<f64>,
}

#[derive(Debug, Serialize)]
struct LocationBroadcast {
    vehicle_id: Uuid,
    lat: f64,
    lon: f64,
    speed_kmh: Option<f64>,
    heading: Option<f64>,
    timestamp: i64,
}

pub fn router() -> Router<AppState> {
    Router::new()
        // Șoferul trimite locația lui
        .route("/vehicle/:vehicle_id", get(vehicle_ws))
        // Dashboard-ul urmărește un vehicul
        .route("/track/:vehicle_id", get(track_vehicle_ws))
}

/// WS /ws/vehicle/:vehicle_id — Șofer trimite GPS
async fn vehicle_ws(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Path(vehicle_id): Path<Uuid>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_driver_ws(socket, state, vehicle_id))
}

/// WS /ws/track/:vehicle_id — Dashboard urmărește vehicul
async fn track_vehicle_ws(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Path(vehicle_id): Path<Uuid>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_tracker_ws(socket, state, vehicle_id))
}

/// Handler șofer: primește GPS → publică în Redis → actualizează Supabase
async fn handle_driver_ws(socket: WebSocket, state: AppState, vehicle_id: Uuid) {
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let redis_channel = format!("vehicle:location:{}", vehicle_id);

    tracing::info!("Driver WS connected: vehicle {}", vehicle_id);

    while let Some(Ok(msg)) = ws_receiver.next().await {
        match msg {
            Message::Text(text) => {
                // Parsează update GPS
                match serde_json::from_str::<LocationUpdate>(&text) {
                    Ok(update) => {
                        let broadcast = LocationBroadcast {
                            vehicle_id,
                            lat: update.lat,
                            lon: update.lon,
                            speed_kmh: update.speed_kmh,
                            heading: update.heading,
                            timestamp: Utc::now().timestamp(),
                        };

                        let broadcast_str = serde_json::to_string(&broadcast)
                            .unwrap_or_default();

                        // Publică în Redis (toți trackerii primesc instantaneu)
                        if let Err(e) = state.redis.publish(&redis_channel, &broadcast_str).await {
                            tracing::warn!("Redis publish failed: {}", e);
                        }

                        // Actualizează locația în Supabase (batch logic opțional)
                        let db = state.supabase.clone();
                        let lat = update.lat;
                        let lon = update.lon;
                        tokio::spawn(async move {
                            if let Err(e) = db.update_vehicle_location(&vehicle_id, lat, lon).await {
                                tracing::warn!("DB location update failed: {}", e);
                            }
                        });
                    }
                    Err(e) => {
                        tracing::debug!("Invalid location update from vehicle {}: {}", vehicle_id, e);
                    }
                }
            }
            Message::Ping(data) => {
                let _ = ws_sender.send(Message::Pong(data)).await;
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    tracing::info!("Driver WS disconnected: vehicle {}", vehicle_id);
}

/// Handler tracker (dashboard): subscribe la Redis Pub/Sub → trimite updates la browser
/// PROMPT J10: Fan-out orizontal prin Redis Pub/Sub (permite scalarea API-ului cu --scale api=N)
async fn handle_tracker_ws(socket: WebSocket, state: AppState, vehicle_id: Uuid) {
    let (mut ws_sender, ws_receiver) = socket.split();
    let redis_channel = format!("vehicle:location:{}", vehicle_id);

    tracing::info!("Tracker WS connected for vehicle {}", vehicle_id);

    // Abonare la canalul specific al vehiculului în Redis
    if let Err(e) = state.redis.subscribe(&redis_channel).await {
        tracing::error!("Failed to subscribe to Redis channel {}: {}", redis_channel, e);
    }

    let mut message_rx = state.redis.message_rx();
    let mut tracker_recv = ws_receiver.fuse();
    let mut ping_interval = tokio::time::interval(tokio::time::Duration::from_secs(15));

    loop {
        tokio::select! {
            // Eveniment primit prin Redis Pub/Sub din orice instanță API
            Ok(msg) = message_rx.recv() => {
                if &*msg.channel == redis_channel {
                    if let Some(text) = msg.value.as_str() {
                        if ws_sender.send(Message::Text(text.to_string())).await.is_err() {
                            break;
                        }
                    }
                }
            }
            // Keep-alive ping periodic
            _ = ping_interval.tick() => {
                if ws_sender.send(Message::Ping(vec![])).await.is_err() {
                    break;
                }
            }
            // Clientul a închis conexiunea
            msg = tracker_recv.next() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(data))) => {
                        let _ = ws_sender.send(Message::Pong(data)).await;
                    }
                    _ => {}
                }
            }
        }
    }

    // Dezabonare canal la deconectarea clientului
    let _ = state.redis.unsubscribe(&redis_channel).await;
    tracing::info!("Tracker WS disconnected for vehicle {}", vehicle_id);
}
