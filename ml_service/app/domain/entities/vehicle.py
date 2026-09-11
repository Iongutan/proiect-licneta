"""
OptiFleet B2B — Entitate: Vehicle
===================================
Vehicul de transport cu capacitate și locație curentă.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from app.domain.value_objects.location import Location
from app.domain.value_objects.cargo_spec import CargoSpec


class VehicleStatus(str, Enum):
    AVAILABLE   = "AVAILABLE"
    ON_ROUTE    = "ON_ROUTE"
    MAINTENANCE = "MAINTENANCE"
    OFFLINE     = "OFFLINE"


@dataclass
class Vehicle:
    """
    Vehicul al unui transportator.
    """
    carrier_id: UUID
    license_plate: str
    capacity_m3: float
    max_weight_kg: float
    # ── Cu default ──────────────────────────────────────────
    id: UUID = field(default_factory=uuid4)
    status: VehicleStatus = field(default=VehicleStatus.AVAILABLE)
    current_location: Optional[Location] = field(default=None)
    current_city: Optional[str] = field(default=None)
    driver_name: Optional[str] = field(default=None)
    driver_phone: Optional[str] = field(default=None)
    max_width_cm: Optional[float] = field(default=None)
    max_height_cm: Optional[float] = field(default=None)
    max_depth_cm: Optional[float] = field(default=None)
    last_location_update: Optional[datetime] = field(default=None)
    created_at: datetime = field(default_factory=datetime.utcnow)

    # ─── Logică de domeniu ──────────────────────────────────

    @property
    def is_available(self) -> bool:
        return self.status == VehicleStatus.AVAILABLE

    def can_carry(self, cargo: CargoSpec) -> bool:
        """Verifică dacă vehiculul poate transporta specificațiile date."""
        return cargo.fits_in(self.capacity_m3, self.max_weight_kg)

    def update_location(self, location: Location, city: Optional[str] = None) -> None:
        self.current_location = location
        if city:
            self.current_city = city
        self.last_location_update = datetime.utcnow()

    def set_on_route(self) -> None:
        self.status = VehicleStatus.ON_ROUTE

    def set_available(self) -> None:
        self.status = VehicleStatus.AVAILABLE

    def distance_to_km(self, target: Location) -> Optional[float]:
        """Distanță de la locația curentă la o țintă."""
        if self.current_location is None:
            return None
        return self.current_location.distance_to_km(target)
