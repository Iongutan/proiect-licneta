"""
OptiFleet B2B — Entitate: Order
=================================
Entitate cu identitate unică (UUID).
Conține DOAR logică de domeniu — fără SQL, HTTP sau I/O.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from app.domain.value_objects.location import Location
from app.domain.value_objects.time_window import TimeWindow
from app.domain.value_objects.cargo_spec import CargoSpec
from app.core.exceptions import OrderStatusTransitionError


class OrderStatus(str, Enum):
    PENDING    = "PENDING"
    CLUSTERED  = "CLUSTERED"
    ASSIGNED   = "ASSIGNED"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED  = "DELIVERED"
    CANCELLED  = "CANCELLED"


# Tranziții permise: {status_curent: [statusuri_posibile]}
_ALLOWED_TRANSITIONS: dict[OrderStatus, list[OrderStatus]] = {
    OrderStatus.PENDING:    [OrderStatus.CLUSTERED, OrderStatus.CANCELLED],
    OrderStatus.CLUSTERED:  [OrderStatus.ASSIGNED, OrderStatus.PENDING, OrderStatus.CANCELLED],
    OrderStatus.ASSIGNED:   [OrderStatus.IN_TRANSIT, OrderStatus.CLUSTERED, OrderStatus.CANCELLED],
    OrderStatus.IN_TRANSIT: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
    OrderStatus.DELIVERED:  [],
    OrderStatus.CANCELLED:  [],
}


@dataclass
class Order:
    """
    Comandă de transport.
    Invariant: statusul urmează mașina de stări definită în _ALLOWED_TRANSITIONS.
    """
    company_id: UUID
    cargo: CargoSpec
    pickup_location: Location
    dropoff_location: Location
    delivery_window: TimeWindow
    # ── Câmpuri cu default ──────────────────────────────────
    id: UUID = field(default_factory=uuid4)
    status: OrderStatus = field(default=OrderStatus.PENDING)
    cluster_id: Optional[UUID] = field(default=None)
    special_instructions: Optional[str] = field(default=None)
    pickup_address: Optional[str] = field(default=None)
    dropoff_address: Optional[str] = field(default=None)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    # ─── Logică de domeniu ──────────────────────────────────

    def transition_to(self, new_status: OrderStatus) -> None:
        """
        Schimbă statusul respectând mașina de stări.
        Aruncă excepție dacă tranziția nu e permisă.
        """
        allowed = _ALLOWED_TRANSITIONS.get(self.status, [])
        if new_status not in allowed:
            raise OrderStatusTransitionError(
                f"Cannot transition order {self.id} "
                f"from {self.status} to {new_status}. "
                f"Allowed: {[s.value for s in allowed]}"
            )
        self.status = new_status
        self.updated_at = datetime.utcnow()

    def assign_to_cluster(self, cluster_id: UUID) -> None:
        self.cluster_id = cluster_id
        self.transition_to(OrderStatus.CLUSTERED)

    def remove_from_cluster(self) -> None:
        self.cluster_id = None
        self.transition_to(OrderStatus.PENDING)

    def start_transit(self) -> None:
        self.transition_to(OrderStatus.IN_TRANSIT)

    def mark_delivered(self) -> None:
        self.transition_to(OrderStatus.DELIVERED)

    def cancel(self) -> None:
        self.transition_to(OrderStatus.CANCELLED)

    # ─── Interogări ─────────────────────────────────────────

    @property
    def is_active(self) -> bool:
        return self.status not in (OrderStatus.DELIVERED, OrderStatus.CANCELLED)

    @property
    def is_pending(self) -> bool:
        return self.status == OrderStatus.PENDING

    @property
    def straight_line_km(self) -> float:
        """Distanța în linie dreaptă pickup → dropoff (estimare)."""
        return self.pickup_location.distance_to_km(self.dropoff_location)
