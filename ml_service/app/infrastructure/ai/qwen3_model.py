"""
OptiFleet B2B — Infrastructure: Qwen3 Model (Ollama)
=====================================================
Adapter Qwen3 local via Ollama (endpoint OpenAI-compatible).
Rol EXCLUSIV: execuție tehnică, function calling, procesare date.
Date rămân pe server local — zero leak, zero cost per request.
"""
from __future__ import annotations
import json
from typing import List, Optional, AsyncIterator

from openai import AsyncOpenAI, APITimeoutError, APIError
from loguru import logger

from app.domain.interfaces.i_interfaces import IAIModel, Message, AIResponse, ToolCall
from app.core.config import get_settings
from app.core.exceptions import AIModelError, AIModelTimeoutError


class Qwen3Model(IAIModel):
    """
    Model tehnic local Qwen3.
    Capabilități: function calling precis, analiză structurată, zero latency cloud.
    Utilizat EXCLUSIV intern — utilizatorul nu interacționează direct cu el.
    """

    def __init__(self):
        settings = get_settings()
        # Ollama expune endpoint compatibil OpenAI pe /v1
        self._client = AsyncOpenAI(
            base_url=f"{settings.OLLAMA_BASE_URL}/v1",
            api_key="ollama",       # Dummy — Ollama nu cere cheie
            timeout=settings.QWEN3_TIMEOUT_SEC,
        )
        self._model = settings.QWEN3_MODEL
        self._max_tokens = settings.QWEN3_MAX_TOKENS

    async def complete(
        self,
        messages: List[Message],
        system_prompt: Optional[str] = None,
        tools: Optional[List[dict]] = None,
        max_tokens: int = 4096,
        temperature: float = 0.1,   # Temperatura mică = răspunsuri deterministe, precise
    ) -> AIResponse:
        """
        Completare cu suport complet pentru tool/function calling.
        Temperatura default 0.1 pentru execuție tehnică precisă.
        """
        all_messages = []
        if system_prompt:
            all_messages.append({"role": "system", "content": system_prompt})
        all_messages.extend({"role": m.role, "content": m.content} for m in messages)

        kwargs = {
            "model": self._model,
            "messages": all_messages,
            "max_tokens": min(max_tokens, self._max_tokens),
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        try:
            response = await self._client.chat.completions.create(**kwargs)
            choice = response.choices[0]

            tool_calls: List[ToolCall] = []
            if choice.message.tool_calls:
                for tc in choice.message.tool_calls:
                    try:
                        args = json.loads(tc.function.arguments)
                    except json.JSONDecodeError:
                        args = {}
                        logger.warning(f"Invalid JSON args for tool {tc.function.name}")
                    tool_calls.append(ToolCall(
                        name=tc.function.name,
                        arguments=args,
                        call_id=tc.id,
                    ))

            return AIResponse(
                content=choice.message.content or "",
                tool_calls=tool_calls,
                model_name=self._model,
            )

        except APITimeoutError as e:
            raise AIModelTimeoutError(f"Qwen3 timeout after {self._client.timeout}s: {e}")
        except APIError as e:
            raise AIModelError(f"Qwen3 API error: {e}")

    async def stream(
        self,
        messages: List[Message],
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
    ) -> AsyncIterator[str]:
        """Streaming output (Qwen3 suportă streaming via Ollama)."""
        all_messages = []
        if system_prompt:
            all_messages.append({"role": "system", "content": system_prompt})
        all_messages.extend({"role": m.role, "content": m.content} for m in messages)

        try:
            stream = await self._client.chat.completions.create(
                model=self._model,
                messages=all_messages,
                temperature=temperature,
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except APIError as e:
            raise AIModelError(f"Qwen3 stream error: {e}")

    def get_model_name(self) -> str:
        return f"Qwen3 Local ({self._model})"
