"""
OptiFleet B2B — AI Factory
============================
Factory Pattern + Singleton per tip de model.

Fallback automat:
  - Dacă ANTHROPIC_API_KEY este gol → Qwen3 preia AMBELE roluri
  - Dacă Claude e disponibil → flux dual normal (Claude UX + Qwen3 tehnic)

Extensibil: adaugă GeminiModel, GPT4Model fără a schimba consumatorii.
"""
from __future__ import annotations
from enum import Enum

from loguru import logger

from app.domain.interfaces.i_interfaces import IAIModel


class AIModelType(str, Enum):
    CONVERSATIONAL = "conversational"   # Claude (sau Qwen3 fallback)
    TECHNICAL      = "technical"        # Qwen3 — tool calls, date tehnice


def _claude_available() -> bool:
    """Verifică dacă ANTHROPIC_API_KEY este configurat."""
    from app.core.config import get_settings
    key = get_settings().ANTHROPIC_API_KEY
    return bool(key and key.strip() and not key.startswith("PUNE_"))


class AIModelFactory:
    """
    Factory cu cache per tip (Singleton per model).
    Detectează automat dacă Claude e disponibil și face fallback la Qwen3.
    """
    _instances: dict[AIModelType, IAIModel] = {}

    @classmethod
    def get(cls, model_type: AIModelType) -> IAIModel:
        if model_type not in cls._instances:
            match model_type:
                case AIModelType.CONVERSATIONAL:
                    if _claude_available():
                        from app.infrastructure.ai.claude_model import ClaudeModel
                        logger.info("AI Conversational: Claude ✅")
                        cls._instances[model_type] = ClaudeModel()
                    else:
                        # Fallback: Qwen3 face și chat-ul conversational
                        from app.infrastructure.ai.qwen3_model import Qwen3Model
                        logger.warning(
                            "ANTHROPIC_API_KEY lipsă — Qwen3 preia rolul conversational"
                        )
                        cls._instances[model_type] = Qwen3Model()

                case AIModelType.TECHNICAL:
                    from app.infrastructure.ai.qwen3_model import Qwen3Model
                    logger.info("AI Technical: Qwen3 (Ollama) ✅")
                    cls._instances[model_type] = Qwen3Model()

                case _:
                    raise ValueError(f"Unknown AI model type: {model_type}")

        return cls._instances[model_type]

    @classmethod
    def reset(cls) -> None:
        """Resetează toate instanțele (util pentru testing)."""
        cls._instances.clear()

    @classmethod
    def status(cls) -> dict:
        """Returnează statusul curent al modelelor (pentru /health endpoint)."""
        return {
            "claude_available": _claude_available(),
            "qwen3_model": "qwen3:14b",
            "conversational": "claude" if _claude_available() else "qwen3 (fallback)",
            "technical": "qwen3",
        }
