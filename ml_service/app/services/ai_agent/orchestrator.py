"""
OptiFleet B2B — Agent Orchestrator: Claude ↔ Qwen3
====================================================
Inima sistemului AI dual.

Flux complet:
  1. Utilizatorul scrie → Claude primește mesajul
  2. Qwen3 analizează dacă sunt necesare date tehnice
  3. Dacă DA → Qwen3 execută tool calls (OSRM, DB, calcule)
  4. Datele reale sunt injectate ca context pentru Claude
  5. Claude generează răspunsul final empatic cu streaming

Avantaj arhitectural:
  - Utilizatorul vede ÎNTOTDEAUNA Claude (UX premium)
  - Datele sunt ÎNTOTDEAUNA reale (Qwen3 tehnic)
  - Fiecare model face ce e mai bun la
"""
from __future__ import annotations
import json
from typing import List, AsyncIterator

from loguru import logger

from app.domain.interfaces.i_interfaces import Message, AIResponse
from app.infrastructure.ai.ai_factory import AIModelFactory, AIModelType
from app.services.ai_agent.tool_registry import ToolRegistry

# Import automat al tuturor tool-urilor (self-registering)
import app.services.ai_agent.tools.all_tools  # noqa: F401


# ─── System Prompts ──────────────────────────────────────────

CLAUDE_SYSTEM = """
Ești OptiFleet Assistant, copilotul expert în logistică B2B pentru IMM-uri din Moldova.

Personalitate: profesionist, empatic, direct și practic.
Misiune: ajuți transportatorii și comercianții să economisească bani prin livrări grupate.

Reguli:
1. Răspunde ÎNTOTDEAUNA în română.
2. Folosește date reale din context — nu inventa cifre.
3. Când prezinți economii, fii specific (MDL, km, procente).
4. Dacă nu ai date suficiente, spune clar ce informații lipsesc.
5. Fii concis — maxim 3-4 paragrafe per răspuns.
""".strip()

QWEN3_SYSTEM = """
Ești motorul tehnic de execuție pentru OptiFleet B2B.
Rolul tău EXCLUSIV: apelează tool-urile disponibile pentru a obține date reale.
Nu explica, nu comenta — EXECUTĂ tool calls și returnează date structurate.
Dacă nu e nevoie de niciun tool, nu apela niciunul.
""".strip()


class AgentOrchestrator:
    """
    Orchestrează colaborarea Claude ↔ Qwen3.
    
    Single Responsibility: coordonează fluxul, nu execută business logic.
    Dependency Injection: primește rolurile utilizatorului pentru RBAC.
    """

    def __init__(self, user_roles: List[str]):
        self._claude = AIModelFactory.get(AIModelType.CONVERSATIONAL)
        self._qwen3  = AIModelFactory.get(AIModelType.TECHNICAL)
        self._user_roles = user_roles
        # Tool schemas filtrate per roluri (RBAC)
        self._tools = ToolRegistry.get_openai_schemas(user_roles)

    async def chat_stream(
        self,
        conversation: List[Message],
    ) -> AsyncIterator[str]:
        """
        Endpoint principal de chat cu streaming SSE.
        Returnează text incrementally pe măsură ce Claude generează.
        """
        # Pasul 1: Qwen3 execută tool calls dacă e necesar
        technical_data = await self._execute_with_qwen3(conversation)

        # Pasul 2: Construiește contextul îmbogățit pentru Claude
        enriched_messages = list(conversation)
        if technical_data:
            context_msg = Message(
                role="user",
                content=(
                    "[CONTEXT TEHNIC — Date reale obținute din sistem]\n"
                    f"{json.dumps(technical_data, ensure_ascii=False, indent=2)}\n"
                    "[Folosește aceste date reale în răspunsul tău]"
                ),
            )
            enriched_messages.insert(-1, context_msg)

        # Pasul 3: Claude generează răspunsul final cu streaming
        async for chunk in self._claude.stream(
            messages=enriched_messages,
            system_prompt=CLAUDE_SYSTEM,
            temperature=0.7,
        ):
            yield chunk

    async def chat_complete(
        self,
        conversation: List[Message],
    ) -> str:
        """Versiune non-streaming (pentru batch processing)."""
        technical_data = await self._execute_with_qwen3(conversation)

        enriched_messages = list(conversation)
        if technical_data:
            enriched_messages.insert(-1, Message(
                role="user",
                content=f"[DATE TEHNICE]\n{json.dumps(technical_data, ensure_ascii=False)}",
            ))

        response = await self._claude.complete(
            messages=enriched_messages,
            system_prompt=CLAUDE_SYSTEM,
        )
        return response.content

    async def _execute_with_qwen3(self, conversation: List[Message]) -> dict:
        """
        Qwen3 analizează conversația și execută tool calls dacă e necesar.
        Returnează dict cu rezultatele tool-urilor (sau {} dacă nu e nevoie).
        """
        if not self._tools:
            return {}

        try:
            response: AIResponse = await self._qwen3.complete(
                messages=conversation,
                system_prompt=QWEN3_SYSTEM,
                tools=self._tools,
                temperature=0.1,  # Determinism maxim pentru tool calling
            )
        except Exception as e:
            logger.warning(f"Qwen3 technical analysis failed: {e}")
            return {}

        if not response.has_tool_calls:
            return {}

        results = {}
        for tool_call in response.tool_calls:
            # Verificare RBAC per tool call
            if not ToolRegistry.is_allowed(tool_call.name, self._user_roles):
                logger.warning(
                    f"Blocked unauthorized tool call: {tool_call.name} "
                    f"(roles: {self._user_roles})"
                )
                continue

            try:
                tool = ToolRegistry.get(tool_call.name)
                result = await tool.handler(**tool_call.arguments)
                results[tool_call.name] = result
                logger.info(f"Tool '{tool_call.name}' executed OK")
            except KeyError:
                logger.error(f"Tool '{tool_call.name}' not found in registry")
            except TypeError as e:
                logger.error(f"Tool '{tool_call.name}' invalid args: {e}")
            except Exception as e:
                logger.error(f"Tool '{tool_call.name}' execution error: {e}")
                results[tool_call.name] = {"error": str(e)}

        return results
