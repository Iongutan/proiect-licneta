// OptiFleet B2B — Rust: JWT Middleware
// Verifică Bearer token și injectează Claims în request extensions
// Execuție: microsecunde (zero I/O, pure CPU verification)

use axum::{
    extract::Request,
    http::header::AUTHORIZATION,
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::ApiError;

fn default_token_type() -> String {
    "access".to_string()
}

/// Claims din JWT token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,            // user_id
    #[serde(default)]
    pub company_id: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub roles: Vec<String>,
    pub exp: i64,
    #[serde(default = "default_token_type")]
    pub r#type: String,         // "access" | "refresh"
}

impl Claims {
    pub fn user_id(&self) -> Result<Uuid, ApiError> {
        Uuid::parse_str(&self.sub)
            .map_err(|_| ApiError::Unauthorized("Invalid user ID in token".into()))
    }

    pub fn company_uuid(&self) -> Result<Uuid, ApiError> {
        Uuid::parse_str(&self.company_id)
            .map_err(|_| ApiError::Unauthorized("Invalid company ID in token".into()))
    }

    pub fn has_role(&self, role: &str) -> bool {
        self.roles.iter().any(|r| r == role)
    }

    pub fn has_any_role(&self, roles: &[&str]) -> bool {
        roles.iter().any(|r| self.has_role(r))
    }

    pub fn is_carrier(&self) -> bool {
        self.has_any_role(&["CARRIER_ADMIN", "CARRIER_DRIVER", "CARRIER"])
    }

    pub fn is_sme(&self) -> bool {
        self.has_any_role(&["SME_ADMIN", "SME_USER", "MERCHANT"])
    }
}

/// Middleware: verifică JWT și injectează Claims în request
pub async fn require_auth(
    mut request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let token = extract_bearer_token(&request)?;
    let secret = std::env::var("SECRET_KEY")
        .or_else(|_| std::env::var("SUPABASE_JWT_SECRET"))
        .map_err(|_| ApiError::Internal("Server security configuration error: Missing SECRET_KEY".into()))?;

    if secret.trim().len() < 32 {
        return Err(ApiError::Internal("Server security configuration error: Insecure SECRET_KEY (min 32 chars required)".into()));
    }

    let claims = verify_token(&token, secret.trim())?;

    if !claims.r#type.is_empty() && claims.r#type != "access" && claims.r#type != "authenticated" {
        return Err(ApiError::Unauthorized("Invalid token type: expected access token".into()));
    }

    // Injectează claims în request pentru handlers
    request.extensions_mut().insert(claims);
    Ok(next.run(request).await)
}

/// Extrage Bearer token din header Authorization
pub fn extract_bearer_token(request: &Request) -> Result<String, ApiError> {
    let auth_header = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::Unauthorized("Missing Authorization header".into()))?;

    if !auth_header.starts_with("Bearer ") {
        return Err(ApiError::Unauthorized("Invalid Authorization format. Use: Bearer <token>".into()));
    }

    Ok(auth_header[7..].to_string())
}

/// Verifică semnătura și expiratia JWT
pub fn verify_token(token: &str, secret: &str) -> Result<Claims, ApiError> {
    if secret.trim().len() < 32 {
        return Err(ApiError::Internal("Verification key too short (min 32 chars required)".into()));
    }

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.trim().as_bytes()),
        &validation,
    )
    .map(|data| data.claims)
    .map_err(|e| match e.kind() {
        jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
            ApiError::Unauthorized("Token expired".into())
        }
        _ => ApiError::Unauthorized(format!("Invalid token: {}", e)),
    })
}

/// Creare token JWT semnat cu cheia secretă
pub fn create_token(claims: &Claims, secret: &str) -> Result<String, ApiError> {
    if secret.trim().len() < 32 {
        return Err(ApiError::Internal("Signing key too short (min 32 chars required)".into()));
    }

    jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        claims,
        &jsonwebtoken::EncodingKey::from_secret(secret.trim().as_bytes()),
    )
    .map_err(|e| ApiError::Internal(format!("Failed to create token: {}", e)))
}

