// OptiFleet B2B — Security & Scalability Tests (Prompts J1, J2, J3, J4)

#[cfg(test)]
mod security_tests {
    use std::collections::HashMap;
    use crate::config::settings::Settings;
    use crate::middleware::auth::{Claims, create_token, verify_token};

    const VALID_SECRET: &str = "super_secure_optifleet_secret_key_2026_production_safe_min_32_chars";
    const SHORT_SECRET: &str = "too_short_key_123";

    fn base_env() -> HashMap<&'static str, String> {
        let mut map = HashMap::new();
        map.insert("SUPABASE_URL", "https://example.supabase.co".to_string());
        map.insert("SUPABASE_ANON_KEY", "anon-key".to_string());
        map.insert("SUPABASE_SERVICE_ROLE_KEY", "service-key".to_string());
        map
    }

    #[test]
    fn test_secret_key_missing_fails_startup() {
        // PROMPT J1: Verifică că lipsa SECRET_KEY eșuează explicit la pornire
        let env = base_env();
        let result = Settings::from_lookup(|k| env.get(k).cloned().ok_or_else(|| format!("Missing {k}")));
        assert!(result.is_err(), "Serverul ar fi trebuit să refuze pornirea fără SECRET_KEY");
        let err_msg = result.unwrap_err();
        assert!(
            err_msg.contains("Missing SECRET_KEY"),
            "Mesajul de eroare trebuie să fie explicit: {}",
            err_msg
        );
    }

    #[test]
    fn test_secret_key_too_short_fails_startup() {
        // PROMPT J1: Verifică că o cheie < 32 caractere este respinsă la pornire
        let mut env = base_env();
        env.insert("SECRET_KEY", SHORT_SECRET.to_string());

        let result = Settings::from_lookup(|k| env.get(k).cloned().ok_or_else(|| format!("Missing {k}")));
        assert!(result.is_err(), "Serverul ar fi trebuit să refuze o cheie < 32 caractere");
        let err_msg = result.unwrap_err();
        assert!(
            err_msg.contains("at least 32 characters"),
            "Mesajul de eroare trebuie să specifice lungimea minimă: {}",
            err_msg
        );
    }

    #[test]
    fn test_valid_token_sign_and_verify() {
        // PROMPT J1: Verifică că token-urile valide cu cheie >= 32 caractere sunt verificate corect
        let claims = Claims {
            sub: "11111111-1111-1111-1111-111111111111".to_string(),
            company_id: "22222222-2222-2222-2222-222222222222".to_string(),
            email: "admin@optifleet.md".to_string(),
            roles: vec!["SUPER_ADMIN".to_string()],
            exp: chrono::Utc::now().timestamp() + 3600,
            r#type: "access".to_string(),
        };

        let token = create_token(&claims, VALID_SECRET).expect("Token creation should succeed");
        let verified = verify_token(&token, VALID_SECRET).expect("Verification should succeed");

        assert_eq!(verified.sub, "11111111-1111-1111-1111-111111111111");
        assert_eq!(verified.email, "admin@optifleet.md");
        assert!(verified.has_role("SUPER_ADMIN"));
    }

    #[test]
    fn test_rejects_insecure_fallback_secret() {
        // PROMPT J1: Token-urile semnate cu vechiul fallback "secret" trebuie respinse
        // când serverul folosește cheia securizată
        let forged_claims = Claims {
            sub: "00000000-0000-0000-0000-000000000000".to_string(),
            company_id: "00000000-0000-0000-0000-000000000000".to_string(),
            email: "attacker@hacked.com".to_string(),
            roles: vec!["SUPER_ADMIN".to_string()],
            exp: chrono::Utc::now().timestamp() + 3600,
            r#type: "access".to_string(),
        };

        // Atacatorul încearcă să semneze cu cheia nesigură "secret"
        let insecure_key = "secret_key_that_is_at_least_32_chars_long_for_test";
        let forged_token = create_token(&forged_claims, insecure_key).unwrap();

        // Serverul validează cu cheia reală VALID_SECRET
        let result = verify_token(&forged_token, VALID_SECRET);
        assert!(result.is_err(), "Serverul nu trebuie să accepte token-uri semnate cu altă cheie");
    }

    #[test]
    fn test_cors_allowed_origins_in_settings() {
        // PROMPT J2: Validare origini CORS
        let mut env = base_env();
        env.insert("SECRET_KEY", VALID_SECRET.to_string());
        env.insert("CORS_ALLOWED_ORIGINS", "https://optifleet.md,https://admin.optifleet.md".to_string());

        let settings = Settings::from_lookup(|k| env.get(k).cloned().ok_or_else(|| format!("Missing {k}")))
            .expect("Settings load should succeed");
        assert_eq!(settings.cors_allowed_origins.len(), 2);
        assert_eq!(settings.cors_allowed_origins[0], "https://optifleet.md");
        assert_eq!(settings.cors_allowed_origins[1], "https://admin.optifleet.md");
    }
}

