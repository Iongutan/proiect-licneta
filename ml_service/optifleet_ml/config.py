"""Configurare din variabile de mediu. Pornirea eșuează dacă lipsește tokenul intern."""
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "production"] = "development"

    # Secret partajat doar cu serverul Next.js. Minim 32 de caractere.
    internal_api_token: str = Field(min_length=32)

    osrm_base_url: str = "http://osrm:5000"
    osrm_timeout_s: float = 8.0

    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "qwen3:14b"
    ollama_timeout_s: float = 20.0

    # Limite de intrare — protejează CPU-ul de cereri abuzive.
    max_shipments: int = 2000
    max_route_stops: int = 120
    max_vehicles: int = 50


@lru_cache
def get_settings() -> Settings:
    return Settings()
