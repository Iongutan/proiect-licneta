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
    pub refresh_token_expire_days: u64,

    // Rate limiting
    pub rate_limit_per_minute: u32,

    // CORS
    pub cors_allowed_origins: Vec<String>,
}

impl Settings {
    pub fn from_env() -> Result<Self, String> {
        dotenvy::dotenv().ok();
        Self::from_lookup(|k| env::var(k).map_err(|_| format!("Required env var '{k}' not set")))
    }

    pub fn from_lookup<F>(get: F) -> Result<Self, String>
    where
        F: Fn(&str) -> Result<String, String>,
    {
        // FAIL-FAST SECURE JWT KEY VALIDATION (PROMPT J1)
        // Nu permite pornirea serverului cu chei implicite sau fallback nesigur
        let secret_key = get("SECRET_KEY")
            .or_else(|_| get("SUPABASE_JWT_SECRET"))
            .map_err(|_| {
                "CRITICAL SECURITY ERROR: Missing SECRET_KEY or SUPABASE_JWT_SECRET environment variable. \
                 Server startup aborted to prevent forged tokens and unauthenticated access.".to_string()
            })?;

        let trimmed_key = secret_key.trim();
        if trimmed_key.len() < 32 {
            return Err(format!(
                "CRITICAL SECURITY ERROR: SECRET_KEY must be at least 32 characters long for cryptographic security. \
                 Found only {} characters. Server startup aborted.",
                trimmed_key.len()
            ));
        }

        // CORS Allowed Origins (PROMPT J2)
        let cors_raw = get("CORS_ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:3000,http://127.0.0.1:3000".to_string());
        let cors_allowed_origins: Vec<String> = cors_raw
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Ok(Self {
            app_port: get("APP_PORT").ok().and_then(|v| v.parse().ok()).unwrap_or(8000),
            environment: get("ENVIRONMENT").unwrap_or_else(|_| "development".to_string()),

            supabase_url: get("SUPABASE_URL")?,
            supabase_anon_key: get("SUPABASE_ANON_KEY")?,
            supabase_service_role_key: get("SUPABASE_SERVICE_ROLE_KEY")?,

            ml_service_url: get("ML_SERVICE_URL").unwrap_or_else(|_| "http://localhost:8001".to_string()),

            redis_url: get("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string()),

            secret_key: trimmed_key.to_string(),
            jwt_algorithm: get("JWT_ALGORITHM").unwrap_or_else(|_| "HS256".to_string()),
            access_token_expire_minutes: get("ACCESS_TOKEN_EXPIRE_MINUTES").ok().and_then(|v| v.parse().ok()).unwrap_or(15),
            refresh_token_expire_days: get("REFRESH_TOKEN_EXPIRE_DAYS").ok().and_then(|v| v.parse().ok()).unwrap_or(7),

            rate_limit_per_minute: get("RATE_LIMIT_PER_MINUTE").ok().and_then(|v| v.parse().ok()).unwrap_or(60),
            cors_allowed_origins,
        })
    }

    pub fn is_production(&self) -> bool {
        self.environment == "production"
    }

    pub fn is_development(&self) -> bool {
        self.environment == "development"
    }
}


