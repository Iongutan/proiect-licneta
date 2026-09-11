"""
OptiFleet B2B — Configurare Centralizată
========================================
Toate setările vin din variabile de mediu (.env).
Pattern: Singleton prin @lru_cache — o singură instanță per process.
Principiu: Single Source of Truth pentru configurare.
"""
from functools import lru_cache
from typing import Literal, List
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ─── Aplicație ──────────────────────────────────────────
    APP_NAME: str = "OptiFleet B2B"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    LOG_LEVEL: str = "INFO"
    APP_PORT: int = 8000
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # ─── Supabase ───────────────────────────────────────────
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # ─── AI: Claude (Conversational) — OPȚIONAL ─────────────────────
    ANTHROPIC_API_KEY: str = ""           # Gol = fallback la Qwen3
    CLAUDE_MODEL: str = "claude-3-5-sonnet-20241022"
    CLAUDE_MAX_TOKENS: int = 4096

    # ─── AI: Qwen3 (Tehnic, local) ──────────────────────────
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    QWEN3_MODEL: str = "qwen3:14b"
    QWEN3_MAX_TOKENS: int = 8192
    QWEN3_TIMEOUT_SEC: int = 60

    # ─── Routing (OSRM) ─────────────────────────────────────
    OSRM_BASE_URL: str = "http://localhost:5000"
    OSRM_TIMEOUT_SEC: int = 10
    OSRM_ROAD_FACTOR: float = 1.4   # Haversine fallback factor

    # ─── Cache (Redis) ───────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379"
    CACHE_TTL_SECONDS: int = 300    # 5 minute default

    # ─── Securitate ─────────────────────────────────────────
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ─── Clustering ─────────────────────────────────────────
    CLUSTERING_EPS_KM: float = 15.0         # Raza max cluster
    CLUSTERING_MIN_SAMPLES: int = 2         # Min comenzi per cluster
    CLUSTERING_WINDOW_HOURS: float = 24.0   # Fereastra temporala

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v: str | list) -> list:
        if isinstance(v, str):
            import json
            return json.loads(v)
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    model_config = {"env_file": ".env", "case_sensitive": True}


@lru_cache
def get_settings() -> Settings:
    """
    Singleton Settings — creat o singură dată per process.
    Folosește @lru_cache pentru a evita re-citirea .env la fiecare apel.
    """
    return Settings()
