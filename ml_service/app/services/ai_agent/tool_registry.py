"""
OptiFleet B2B — Service: Tool Registry (Qwen3 Tools)
=====================================================
Registry Pattern — înregistrare centralizată a tool-urilor Qwen3.
Fiecare tool e un fișier independent. Adaugi tool = adaugi fișier + register().
Open/Closed Principle: extensibil fără a modifica orchestratorul.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Any, Awaitable
from loguru import logger


@dataclass
class Tool:
    """Definiția unui tool disponibil pentru agentul Qwen3."""
    name: str
    description: str
    parameters_schema: dict
    handler: Callable[..., Awaitable[dict]]
    roles_allowed: List[str]   # RBAC: ce roluri pot apela tool-ul


class ToolRegistry:
    """
    Registry global al tool-urilor Qwen3.
    Implementare: Singleton via variabilă de clasă.
    """
    _tools: Dict[str, Tool] = {}

    @classmethod
    def register(cls, tool: Tool) -> None:
        """Înregistrează un tool în registry."""
        if tool.name in cls._tools:
            logger.warning(f"Tool '{tool.name}' already registered — overwriting")
        cls._tools[tool.name] = tool
        logger.debug(f"Tool registered: {tool.name}")

    @classmethod
    def get(cls, name: str) -> Tool:
        """Returnează tool-ul după nume. KeyError dacă nu există."""
        if name not in cls._tools:
            raise KeyError(f"Tool '{name}' not found in registry")
        return cls._tools[name]

    @classmethod
    def get_openai_schemas(cls, user_roles: List[str]) -> List[dict]:
        """
        Returnează schema OpenAI (tool_choice format) pentru tool-urile
        permise rolurilor date. Filtru RBAC la nivel de registry.
        """
        return [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters_schema,
                },
            }
            for t in cls._tools.values()
            if any(role in t.roles_allowed for role in user_roles)
        ]

    @classmethod
    def is_allowed(cls, tool_name: str, user_roles: List[str]) -> bool:
        """Verifică dacă rolurile date pot apela tool-ul."""
        tool = cls._tools.get(tool_name)
        if not tool:
            return False
        return any(role in tool.roles_allowed for role in user_roles)

    @classmethod
    def all_names(cls) -> List[str]:
        return list(cls._tools.keys())
