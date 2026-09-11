"""
OptiFleet B2B — Interfaces: AI Models
=======================================
Contract abstract pentru orice model AI.
Pattern Strategy: Claude și Qwen3 implementează același port.
Permite schimbarea modelului fără modificarea orchestratorului.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional, AsyncIterator


@dataclass
class Message:
    role: str   # "user" | "assistant" | "system"
    content: str


@dataclass
class ToolCall:
    name: str
    arguments: dict
    call_id: str = ""


@dataclass
class AIResponse:
    content: str
    tool_calls: List[ToolCall] = field(default_factory=list)
    model_name: str = ""
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def has_tool_calls(self) -> bool:
        return len(self.tool_calls) > 0

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens


class IAIModel(ABC):
    """
    Port: contract pentru orice model AI.
    Implementări: ClaudeModel (conversational), Qwen3Model (tehnic)
    """

    @abstractmethod
    async def complete(
        self,
        messages: List[Message],
        system_prompt: Optional[str] = None,
        tools: Optional[List[dict]] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AIResponse:
        """Generare completă — răspunde cu tot textul odată."""
        ...

    @abstractmethod
    async def stream(
        self,
        messages: List[Message],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        """Streaming — trimite text în bucăți pe măsură ce e generat."""
        ...

    @abstractmethod
    def get_model_name(self) -> str:
        ...


class IClusteringStrategy(ABC):
    """
    Port: contract pentru algoritmi de clustering.
    Implementări: DBSCANStrategy, HDBSCANStrategy
    """
    from app.domain.entities.order import Order

    @abstractmethod
    def cluster(
        self,
        orders: List,
        eps_km: float = 15.0,
        min_samples: int = 2,
    ) -> dict:
        """
        Grupează comenzile în clustere.
        Returns: Dict[cluster_label, List[Order]]
                 -1 = outlieri (comenzi neincadrate în niciun cluster)
        """
        ...

    @abstractmethod
    def get_algorithm_name(self) -> str:
        ...


class IRoutingEngine(ABC):
    """
    Port: contract pentru motorul de rutare.
    Implementări: OSRMEngine (producție), HaversineEngine (fallback)
    """
    from app.domain.value_objects.location import Location

    @dataclass
    class RouteMatrix:
        durations_sec: List[List[float]]
        distances_m: List[List[float]]

    @abstractmethod
    async def get_route(self, waypoints: List) -> Optional[dict]:
        """Calculează ruta optimă cu geometrie GeoJSON."""
        ...

    @abstractmethod
    async def get_distance_matrix(self, locations: List) -> "IRoutingEngine.RouteMatrix":
        """Matricea N×N de distanțe reale pe drum."""
        ...
