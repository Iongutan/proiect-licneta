"""
OptiFleet B2B — Interfaces (Ports): Repositories
==================================================
Contracte abstracte pentru accesul la date.
Pattern Repository: izolează logica de business de detaliile de persistență.
Principiu Dependency Inversion (SOLID): codul de business depinde de abstractizări.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from app.domain.entities.order import Order, OrderStatus
from app.domain.entities.vehicle import Vehicle, VehicleStatus
from app.domain.entities.cluster import GroupBuyCluster
from app.domain.value_objects.location import Location
from app.domain.value_objects.time_window import TimeWindow


# ═══════════════════════════════════════════════════════════════
# ORDER REPOSITORY
# ═══════════════════════════════════════════════════════════════

class IOrderRepository(ABC):

    @abstractmethod
    async def save(self, order: Order) -> Order:
        """Creează sau actualizează o comandă."""
        ...

    @abstractmethod
    async def find_by_id(self, order_id: UUID) -> Optional[Order]:
        """Găsește o comandă după ID."""
        ...

    @abstractmethod
    async def find_by_company(
        self,
        company_id: UUID,
        status: Optional[OrderStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Order]:
        """Listează comenzile unei companii."""
        ...

    @abstractmethod
    async def find_pending_in_area(
        self,
        center: Location,
        radius_km: float,
        time_window: TimeWindow,
    ) -> List[Order]:
        """
        Interogare spațială PostGIS: comenzi PENDING în aria dată.
        Folosit de motorul de clustering.
        """
        ...

    @abstractmethod
    async def update_status(self, order_id: UUID, status: OrderStatus) -> None:
        ...

    @abstractmethod
    async def delete(self, order_id: UUID) -> None:
        ...


# ═══════════════════════════════════════════════════════════════
# VEHICLE REPOSITORY
# ═══════════════════════════════════════════════════════════════

class IVehicleRepository(ABC):

    @abstractmethod
    async def save(self, vehicle: Vehicle) -> Vehicle:
        ...

    @abstractmethod
    async def find_by_id(self, vehicle_id: UUID) -> Optional[Vehicle]:
        ...

    @abstractmethod
    async def find_available_near(
        self,
        center: Location,
        radius_km: float,
        min_capacity_m3: float = 0.0,
        min_weight_kg: float = 0.0,
    ) -> List[Vehicle]:
        """
        KNN Spatial: vehicule AVAILABLE în raza dată cu capacitate suficientă.
        Core pentru Dynamic Fleet Relocation (modulul 2).
        """
        ...

    @abstractmethod
    async def update_location(
        self,
        vehicle_id: UUID,
        location: Location,
        city: Optional[str] = None,
    ) -> None:
        ...

    @abstractmethod
    async def find_by_carrier(self, carrier_id: UUID) -> List[Vehicle]:
        ...


# ═══════════════════════════════════════════════════════════════
# CLUSTER REPOSITORY
# ═══════════════════════════════════════════════════════════════

class IClusterRepository(ABC):

    @abstractmethod
    async def save(self, cluster: GroupBuyCluster) -> GroupBuyCluster:
        ...

    @abstractmethod
    async def find_by_id(self, cluster_id: UUID) -> Optional[GroupBuyCluster]:
        ...

    @abstractmethod
    async def find_forming(self) -> List[GroupBuyCluster]:
        """Toate clusterele în starea FORMING (pot primi comenzi noi)."""
        ...
