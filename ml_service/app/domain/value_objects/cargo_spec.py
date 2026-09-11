"""
OptiFleet B2B — Value Object: CargoSpec
=========================================
Specificații marfă imutabile: volum, greutate, dimensiuni.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class CargoSpec:
    """
    Specificații fizice ale mărfii.

    Exemple:
        cargo = CargoSpec(volume_m3=2.5, weight_kg=800)
        cargo.fits_in(vehicle_volume=10.0, vehicle_weight=3000)  # True
    """
    volume_m3: float
    weight_kg: float
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    depth_cm: Optional[float] = None
    is_fragile: bool = False
    requires_refrigeration: bool = False

    def __post_init__(self) -> None:
        if self.volume_m3 <= 0:
            raise ValueError(f"volume_m3 must be > 0, got {self.volume_m3}")
        if self.weight_kg <= 0:
            raise ValueError(f"weight_kg must be > 0, got {self.weight_kg}")
        if self.volume_m3 > 100:
            raise ValueError(f"volume_m3 {self.volume_m3} exceeds max 100 m³")
        if self.weight_kg > 25_000:
            raise ValueError(f"weight_kg {self.weight_kg} exceeds max 25,000 kg")

    def fits_in(self, vehicle_volume: float, vehicle_weight: float) -> bool:
        """Verifică dacă marfa încape în vehicul."""
        return self.volume_m3 <= vehicle_volume and self.weight_kg <= vehicle_weight

    def __add__(self, other: CargoSpec) -> CargoSpec:
        """Combină două specificații de marfă (pentru clustere)."""
        return CargoSpec(
            volume_m3=self.volume_m3 + other.volume_m3,
            weight_kg=self.weight_kg + other.weight_kg,
            is_fragile=self.is_fragile or other.is_fragile,
            requires_refrigeration=self.requires_refrigeration or other.requires_refrigeration,
        )
