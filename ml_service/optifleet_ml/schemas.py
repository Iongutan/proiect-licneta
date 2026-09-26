"""Contractele de intrare/ieșire. Toate câmpurile sunt validate și mărginite."""
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class Point(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class Shipment(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    pickup: Point
    dropoff: Point
    pallets: int = Field(ge=1, le=66)
    ready_from: datetime | None = None
    deliver_by: datetime | None = None

    @model_validator(mode="after")
    def _window_order(self) -> "Shipment":
        if self.ready_from and self.deliver_by and self.deliver_by <= self.ready_from:
            raise ValueError("deliver_by trebuie să fie după ready_from")
        return self


# ─── Grupare (group-buying) ────────────────────────────────────────────────

class GroupingRequest(BaseModel):
    shipments: list[Shipment] = Field(min_length=1)
    eps_km: float = Field(default=15.0, gt=0, le=100)
    min_group_size: int = Field(default=2, ge=2, le=20)
    max_group_pallets: int = Field(default=33, ge=1, le=66)


class ShipmentGroup(BaseModel):
    shipment_ids: list[str]
    pallets_total: int
    pickup_centroid: Point
    dropoff_centroid: Point
    individual_km: float
    consolidated_km: float
    savings_pct: float


class GroupingResponse(BaseModel):
    groups: list[ShipmentGroup]
    ungrouped_ids: list[str]
    algorithm: str


# ─── Rutare (CVRP cu pickup & delivery) ────────────────────────────────────

class VehicleIn(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    pallet_capacity: int = Field(ge=1, le=66)


class RoutingRequest(BaseModel):
    depot: Point
    vehicles: list[VehicleIn] = Field(min_length=1)
    shipments: list[Shipment] = Field(min_length=1)
    time_limit_s: int = Field(default=10, ge=1, le=30)


class Stop(BaseModel):
    shipment_id: str | None
    kind: str  # depot | pickup | dropoff
    point: Point
    load_after: int


class VehicleRoute(BaseModel):
    vehicle_id: str
    stops: list[Stop]
    distance_km: float
    duration_min: float


class RoutingResponse(BaseModel):
    routes: list[VehicleRoute]
    unassigned_ids: list[str]
    total_distance_km: float
    matrix_source: str  # osrm | haversine


# ─── Intenție (Qwen3 local) ────────────────────────────────────────────────

class IntentRequest(BaseModel):
    query: str = Field(min_length=1, max_length=300)
    known_places: list[str] = Field(default_factory=list, max_length=80)


class IntentResponse(BaseModel):
    origin: str | None = None
    destination: str | None = None
    pallets: int | None = Field(default=None, ge=1, le=66)
    with_transit: bool = False
