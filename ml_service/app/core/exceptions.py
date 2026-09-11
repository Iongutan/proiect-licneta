"""
OptiFleet B2B — Ierarhie Excepții Custom
=========================================
Pattern: Exception Hierarchy — excepții specifice domeniului.
Avantaj: handling precis per tip de eroare, răspunsuri HTTP corecte.
"""
from typing import Optional, Any


class OptiFleetError(Exception):
    """Excepție bază pentru toate erorile aplicației."""
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message)
        self.message = message
        self.details = details


# ─── Domain Errors ──────────────────────────────────────────

class DomainError(OptiFleetError):
    """Erori la nivelul regulilor de business."""


class InvalidLocationError(DomainError):
    """Coordonate GPS invalide."""


class InvalidTimeWindowError(DomainError):
    """Fereastră temporală invalidă (start >= end)."""


class OrderStatusTransitionError(DomainError):
    """Tranziție de status nepermisă pentru o comandă."""


class InsufficientVehicleCapacityError(DomainError):
    """Vehiculul nu are capacitate suficientă pentru cluster."""


# ─── Infrastructure Errors ──────────────────────────────────

class InfrastructureError(OptiFleetError):
    """Erori la nivelul infrastructurii externe."""


class DatabaseError(InfrastructureError):
    """Erori de acces la baza de date."""


class EntityNotFoundError(DatabaseError):
    """Entitatea nu a fost găsită în DB."""
    def __init__(self, entity_type: str, entity_id: str):
        super().__init__(f"{entity_type} with id={entity_id} not found")
        self.entity_type = entity_type
        self.entity_id = entity_id


class RoutingEngineError(InfrastructureError):
    """OSRM indisponibil sau eroare de calcul rută."""


class AIModelError(InfrastructureError):
    """Eroare de comunicare cu modelul AI."""


class AIModelTimeoutError(AIModelError):
    """Modelul AI nu a răspuns în timp util."""


class CacheError(InfrastructureError):
    """Eroare Redis."""


# ─── Application/API Errors ─────────────────────────────────

class ApplicationError(OptiFleetError):
    """Erori la nivelul aplicației / use-case-urilor."""


class AuthenticationError(ApplicationError):
    """Autentificare eșuată."""


class AuthorizationError(ApplicationError):
    """Autorizare eșuată — utilizatorul nu are permisiunile necesare."""


class RateLimitExceededError(ApplicationError):
    """Rate limit depășit."""


class ValidationError(ApplicationError):
    """Date de intrare invalide."""


class ClusteringError(ApplicationError):
    """Eroare în procesul de clustering."""


class OptimizationError(ApplicationError):
    """Eroare în optimizarea rutelor."""
