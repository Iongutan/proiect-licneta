// OptiFleet B2B — Rust API: Config
// Toate setările din variabile de mediu (.env)
// Pattern: struct cu From<env> + Default pentru valori opționale

use std::env;

#[derive(Clone, Debug)]
pub struct Settings {
    // App
    pub app_port: u16,
    pub environment: String,

    // Supabase
    pub supabase_url: String,
    pub supabase_anon_key: String,
    pub supabase_service_role_key: String,

    // ML Service (Python intern)
    pub ml_service_url: String,

    // Redis
    pub redis_url: String,

    // JWT
    pub secret_key: String,
    pub jwt_algorithm: String,
    pub access_token_expire_minutes: u64,

    // Rate limiting
    pub rate_limit_per_minute: u32,
}

impl Settings {
    pub fn from_env() -> Result<Self, String> {
        dotenvy::dotenv().ok();

        Ok(Self {
            app_port: env_u16("APP_PORT", 8000),
            environment: env_str("ENVIRONMENT", "development"),

            supabase_url: env_required("SUPABASE_URL")?,
            supabase_anon_key: env_required("SUPABASE_ANON_KEY")?,
            supabase_service_role_key: env_required("SUPABASE_SERVICE_ROLE_KEY")?,

            ml_service_url: env_str("ML_SERVICE_URL", "http://localhost:8001"),

            redis_url: env_str("REDIS_URL", "redis://localhost:6379"),

            secret_key: env_required("SECRET_KEY")?,
            jwt_algorithm: env_str("JWT_ALGORITHM", "HS256"),
            access_token_expire_minutes: env_u64("ACCESS_TOKEN_EXPIRE_MINUTES", 15),

            rate_limit_per_minute: env_u32("RATE_LIMIT_PER_MINUTE", 60),
        })
    }

    pub fn is_production(&self) -> bool {
        self.environment == "production"
    }

    pub fn is_development(&self) -> bool {
        self.environment == "development"
    }
}

// ─── Helper functions ────────────────────────────────────────

fn env_required(key: &str) -> Result<String, String> {
    env::var(key).map_err(|_| format!("Required env var '{key}' not set"))
}

fn env_str(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn env_u16(key: &str, default: u16) -> u16 {
    env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_u32(key: &str, default: u32) -> u32 {
    env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_u64(key: &str, default: u64) -> u64 {
    env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}
