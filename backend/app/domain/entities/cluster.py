"""
OptiFleet B2B — Entitate: GroupBuyCluster
==========================================
Cluster de comenzi grupate pentru livrare comună.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from functools import reduce
from typing import Optional, List
from uuid import UUID, uuid4

from app.domain.entities.order import Order, OrderStatus
from app.domain.value_objects.cargo_spec import CargoSpec
from app.domain.value_objects.location import Location
from app.domain.value_objects.time_window import TimeWindow


class ClusterStatus(str, Enum):
    FORMING   = "FORMING"
    READY     = "READY"
    ASSIGNED  = "ASSIGNED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


@dataclass
class GroupBuyCluster:
    """
    Grup de comenzi cu destinații apropiate, livrate împreună.
    Calculează automat totalurile și discountul estimat.
    """
    id: UUID = field(default_factory=uuid4)
    status: ClusterStatus = field(default=ClusterStatus.FORMING)
    orders: List[Order] = field(default_factory=list)
    assigned_vehicle_id: Optional[UUID] = field(default=None)
    window_start: Optional[datetime] = field(default=None)
    window_end: Optional[datetime] = field(default=None)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    # ─── Proprietăți calculate ──────────────────────────────

    @property
    def order_count(self) -> int:
        return len(self.orders)

    @property
    def total_cargo(self) -> Optional[CargoSpec]:
        if not self.orders:
            return None
        return reduce(
            lambda acc, o: acc + o.cargo,
            self.orders,
            CargoSpec(volume_m3=0.001, weight_kg=0.001),  # neutru
        )

    @property
    def total_volume_m3(self) -> float:
        return sum(o.cargo.volume_m3 for o in self.orders)

    @property
    def total_weight_kg(self) -> float:
        return sum(o.cargo.weight_kg for o in self.orders)

    @property
    def estimated_discount_pct(self) -> float:
        """
        Discount estimat pe baza numărului de comenzi grupate.
        Formula: mai multe comenzi → discount mai mare (cap la 35%).
        """
        if self.order_count <= 1:
            return 0.0
        # 5% per comandă adițională, max 35%
        return min(5.0 * (self.order_count - 1), 35.0)

    @property
    def center_location(self) -> Optional[Location]:
        """Centrul geometric al comenzilor din cluster."""
        if not self.orders:
            return None
        lats = [o.pickup_location.latitude for o in self.orders]
        lons = [o.pickup_location.longitude for o in self.orders]
        return Location(
            latitude=sum(lats) / len(lats),
            longitude=sum(lons) / len(lons),
        )

    # ─── Logică de domeniu ──────────────────────────────────

    def add_order(self, order: Order) -> None:
        if self.status != ClusterStatus.FORMING:
            raise ValueError(f"Cannot add order to cluster in status {self.status}")
        if not order.is_pending:
            raise ValueError(f"Order {order.id} is not PENDING")
        self.orders.append(order)
        order.assign_to_cluster(self.id)
        self.updated_at = datetime.utcnow()

    def remove_order(self, order_id: UUID) -> None:
        order = next((o for o in self.orders if o.id == order_id), None)
        if order:
            self.orders = [o for o in self.orders if o.id != order_id]
            order.remove_from_cluster()
            self.updated_at = datetime.utcnow()

    def mark_ready(self) -> None:
        if self.order_count < 2:
            raise ValueError("Cluster needs at least 2 orders to be READY")
        self.status = ClusterStatus.READY
        self.updated_at = datetime.utcnow()

    def assign_vehicle(self, vehicle_id: UUID) -> None:
        self.assigned_vehicle_id = vehicle_id
        self.status = ClusterStatus.ASSIGNED
        self.updated_at = datetime.utcnow()
