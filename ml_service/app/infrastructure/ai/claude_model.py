"""
OptiFleet B2B — Infrastructure: Claude Model
=============================================
Adapter Claude (Anthropic) — model conversational.
Rol: înțelegere limbaj natural, răspunsuri empatice, UX premium.
NU execută tool calls tehnice — delega la Qwen3.
"""
from __future__ import annotations
import anthropic
from typing import List, Optional, AsyncIterator

from loguru import logger

from app.domain.interfaces.i_interfaces import IAIModel, Message, AIResponse
from app.core.config import get_settings
from app.core.exceptions import AIModelError, AIModelTimeoutError


class ClaudeModel(IAIModel):
    """
    Model conversational Claude.
    Utilizat pentru: chat utilizator, explicații, rapoarte narative.
    Streaming SSE pentru răspunsuri în timp real.
    """

    def __init__(self):
        settings = get_settings()
        self._client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self._model = settings.CLAUDE_MODEL
        self._max_tokens = settings.CLAUDE_MAX_TOKENS

    def _to_anthropic_messages(self, messages: List[Message]) -> List[dict]:
        """Filtrează și convertește mesajele (Claude nu acceptă 'system' în messages)."""
        return [
            {"role": m.role, "content": m.content}
            for m in messages
            if m.role in ("user", "assistant")
        ]

    async def complete(
        self,
        messages: List[Message],
        system_prompt: Optional[str] = None,
        tools: Optional[List[dict]] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AIResponse:
        try:
            kwargs = {
                "model": self._model,
                "max_tokens": min(max_tokens, self._max_tokens),
                "messages": self._to_anthropic_messages(messages),
                "temperature": temperature,
            }
            if system_prompt:
                kwargs["system"] = system_prompt

            response = await self._client.messages.create(**kwargs)
            content = response.content[0].text if response.content else ""

            return AIResponse(
                content=content,
                model_name=self._model,
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
            )
        except anthropic.APITimeoutError as e:
            raise AIModelTimeoutError(f"Claude timeout: {e}")
        except anthropic.APIError as e:
            raise AIModelError(f"Claude API error: {e}")

    async def stream(
        self,
        messages: List[Message],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        try:
            async with self._client.messages.stream(
                model=self._model,
                max_tokens=self._max_tokens,
                messages=self._to_anthropic_messages(messages),
                system=system_prompt or "",
                temperature=temperature,
            ) as stream:
                async for text in stream.text_stream:
                    yield text
        except anthropic.APIError as e:
            raise AIModelError(f"Claude stream error: {e}")

    def get_model_name(self) -> str:
        return f"Claude ({self._model})"
