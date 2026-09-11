"""
OptiFleet B2B — Repository: Vehicles (Supabase)
================================================
KNN spatial pentru găsirea vehiculelor disponibile.
"""
from __future__ import annotations
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from loguru import logger

from app.domain.entities.vehicle import Vehicle, VehicleStatus
from app.domain.interfaces.i_repositories import IVehicleRepository
from app.domain.value_objects.location import Location
from app.infrastructure.database.supabase_client import get_supabase_sync
from app.core.exceptions import DatabaseError


class SupabaseVehicleRepository(IVehicleRepository):

    def __init__(self):
        self._db = get_supabase_sync()

    def _to_row(self, v: Vehicle) -> dict:
        return {
            "id": str(v.id),
            "carrier_id": str(v.carrier_id),
            "license_plate": v.license_plate,
            "capacity_m3": v.capacity_m3,
            "max_weight_kg": v.max_weight_kg,
            "max_width_cm": v.max_width_cm,
            "max_height_cm": v.max_height_cm,
            "max_depth_cm": v.max_depth_cm,
            "status": v.status.value,
            "current_location": v.current_location.to_wkt() if v.current_location else None,
            "current_city": v.current_city,
            "driver_name": v.driver_name,
            "driver_phone": v.driver_phone,
            "last_location_update": v.last_location_update.isoformat() if v.last_location_update else None,
        }

    def _from_row(self, row: dict) -> Vehicle:
        loc = None
        if row.get("current_location"):
            try:
                loc = Location.from_wkt(row["current_location"])
            except Exception:
                pass
        return Vehicle(
            id=UUID(row["id"]),
            carrier_id=UUID(row["carrier_id"]),
            license_plate=row["license_plate"],
            capacity_m3=float(row["capacity_m3"]),
            max_weight_kg=float(row["max_weight_kg"]),
            max_width_cm=float(row["max_width_cm"]) if row.get("max_width_cm") else None,
            max_height_cm=float(row["max_height_cm"]) if row.get("max_height_cm") else None,
            max_depth_cm=float(row["max_depth_cm"]) if row.get("max_depth_cm") else None,
            status=VehicleStatus(row["status"]),
            current_location=loc,
            current_city=row.get("current_city"),
            driver_name=row.get("driver_name"),
            driver_phone=row.get("driver_phone"),
            last_location_update=(
                datetime.fromisoformat(row["last_location_update"])
                if row.get("last_location_update") else None
            ),
        )

    async def save(self, vehicle: Vehicle) -> Vehicle:
        try:
            self._db.table("vehicles").upsert(self._to_row(vehicle), on_conflict="id").execute()
            return vehicle
        except Exception as e:
            raise DatabaseError(f"Failed to save vehicle: {e}")

    async def find_by_id(self, vehicle_id: UUID) -> Optional[Vehicle]:
        try:
            result = self._db.table("vehicles") \
                .select("*").eq("id", str(vehicle_id)).maybe_single().execute()
            return self._from_row(result.data) if result.data else None
        except Exception as e:
            raise DatabaseError(f"Failed to find vehicle: {e}")

    async def find_available_near(
        self,
        center: Location,
        radius_km: float,
        min_capacity_m3: float = 0.0,
        min_weight_kg: float = 0.0,
    ) -> List[Vehicle]:
        """
        Apelează funcția PostGIS KNN din Supabase.
        Returnează vehicule ordonate după distanță (cel mai aproape primul).
        """
        try:
            result = self._db.rpc(
                "find_nearest_vehicles",
                {
                    "target_lon": center.longitude,
                    "target_lat": center.latitude,
                    "max_radius_m": radius_km * 1000,
                    "min_capacity_m3": min_capacity_m3,
                    "min_weight_kg": min_weight_kg,
                    "k": 10,
                },
            ).execute()
            return [self._from_row(r) for r in result.data]
        except Exception as e:
            raise DatabaseError(f"KNN vehicle query failed: {e}")

    async def update_location(
        self,
        vehicle_id: UUID,
        location: Location,
        city: Optional[str] = None,
    ) -> None:
        try:
            update = {
                "current_location": location.to_wkt(),
                "last_location_update": datetime.utcnow().isoformat(),
            }
            if city:
                update["current_city"] = city
            self._db.table("vehicles").update(update).eq("id", str(vehicle_id)).execute()
        except Exception as e:
            raise DatabaseError(f"Failed to update vehicle location: {e}")

    async def find_by_carrier(self, carrier_id: UUID) -> List[Vehicle]:
        try:
            result = self._db.table("vehicles") \
                .select("*").eq("carrier_id", str(carrier_id)).execute()
            return [self._from_row(r) for r in result.data]
        except Exception as e:
            raise DatabaseError(f"Failed to list vehicles: {e}")
