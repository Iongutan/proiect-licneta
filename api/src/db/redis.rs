// OptiFleet B2B — Rust: Redis Client
// Wrapper peste `fred` pentru operații comune:
// - Rate limiting (increment cu TTL)
// - Pub/Sub GPS tracking
// - Cache matrice OSRM

use fred::prelude::*;
use fred::interfaces::{KeysInterface, PubsubInterface, EventInterface};
use crate::errors::ApiError;

#[derive(Clone)]
pub struct RedisClient {
    pool: RedisPool,
}

impl RedisClient {
    pub async fn new(redis_url: &str) -> Result<Self, String> {
        let config = RedisConfig::from_url(redis_url)
            .map_err(|e| format!("Invalid Redis URL: {e}"))?;

        let pool = RedisPool::new(
            config,
            None,
            None,
            None,
            8,  // Pool size: 8 conexiuni
        ).map_err(|e| format!("Redis pool error: {e}"))?;

        pool.connect();
        pool.wait_for_connect().await
            .map_err(|e| format!("Redis connect failed: {e}"))?;

        tracing::info!("✅ Redis connected at {}", redis_url);
        Ok(Self { pool })
    }

    /// Receiver pentru mesaje Pub/Sub (GPS broadcast la scară)
    pub fn message_rx(&self) -> tokio::sync::broadcast::Receiver<fred::types::Message> {
        self.pool.next().message_rx()
    }

    /// Increment atomic cu TTL — pentru rate limiting sliding window
    pub async fn increment_with_ttl(&self, key: &str, ttl_sec: u64) -> Result<i64, ApiError> {
        // Pipeline: INCR + EXPIRE atomic
        let count: i64 = self.pool.incr(key).await
            .map_err(|e| ApiError::Internal(format!("Redis INCR: {e}")))?;

        if count == 1 {
            // Prima incrementare — setează TTL
            let _: () = self.pool.expire(key, ttl_sec as i64).await
                .map_err(|e| ApiError::Internal(format!("Redis EXPIRE: {e}")))?;
        }

        Ok(count)
    }

    /// Publică mesaj în canal (GPS broadcast)
    pub async fn publish(&self, channel: &str, message: &str) -> Result<(), ApiError> {
        let _: i64 = self.pool.next().publish(channel, message).await
            .map_err(|e| ApiError::Internal(format!("Redis PUBLISH: {e}")))?;
        Ok(())
    }

    /// Subscribe la canal
    pub async fn subscribe(&self, channel: &str) -> Result<(), ApiError> {
        let _: () = self.pool.next().subscribe(channel).await
            .map_err(|e| ApiError::Internal(format!("Redis SUBSCRIBE: {e}")))?;
        Ok(())
    }

    /// Unsubscribe de la canal
    pub async fn unsubscribe(&self, channel: &str) -> Result<(), ApiError> {
        let _: () = self.pool.next().unsubscribe(channel).await
            .map_err(|e| ApiError::Internal(format!("Redis UNSUBSCRIBE: {e}")))?;
        Ok(())
    }

    /// Get string value
    pub async fn get(&self, key: &str) -> Result<Option<String>, ApiError> {
        let val: Option<String> = self.pool.get(key).await
            .map_err(|e| ApiError::Internal(format!("Redis GET: {e}")))?;
        Ok(val)
    }

    /// Set cu TTL opțional
    pub async fn set(&self, key: &str, value: &str, ttl_sec: Option<u64>) -> Result<(), ApiError> {
        let expiry = ttl_sec.map(|t| Expiration::EX(t as i64));
        let _: () = self.pool.set(key, value, expiry, None, false).await
            .map_err(|e| ApiError::Internal(format!("Redis SET: {e}")))?;
        Ok(())
    }

    /// Delete
    pub async fn del(&self, key: &str) -> Result<(), ApiError> {
        let _: i64 = self.pool.del(key).await
            .map_err(|e| ApiError::Internal(format!("Redis DEL: {e}")))?;
        Ok(())
    }
}
