"""
OptiFleet B2B — Repository: Orders (Supabase)
===============================================
Implementare concretă a IOrderRepository cu Supabase.
Codul de business nu știe că folosim Supabase.
Dacă schimbăm DB-ul, modificăm DOAR acest fișier.
"""
from __future__ import annotations
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from loguru import logger

from app.domain.entities.order import Order, OrderStatus, CargoSpec
from app.domain.interfaces.i_repositories import IOrderRepository
from app.domain.value_objects.location import Location
from app.domain.value_objects.time_window import TimeWindow
from app.infrastructure.database.supabase_client import get_supabase_sync
from app.core.exceptions import DatabaseError, EntityNotFoundError


class SupabaseOrderRepository(IOrderRepository):

    def __init__(self):
        self._db = get_supabase_sync()

    # ─── Mapping helpers ────────────────────────────────────

    def _to_row(self, order: Order) -> dict:
        """Domain Entity → Supabase row dict."""
        return {
            "id": str(order.id),
            "company_id": str(order.company_id),
            "cluster_id": str(order.cluster_id) if order.cluster_id else None,
            "volume_m3": order.cargo.volume_m3,
            "weight_kg": order.cargo.weight_kg,
            "width_cm": order.cargo.width_cm,
            "height_cm": order.cargo.height_cm,
            "depth_cm": order.cargo.depth_cm,
            "is_fragile": order.cargo.is_fragile,
            "requires_refrigeration": order.cargo.requires_refrigeration,
            "status": order.status.value,
            # PostGIS WKT: POINT(lon lat)
            "pickup_location": order.pickup_location.to_wkt(),
            "dropoff_location": order.dropoff_location.to_wkt(),
            "pickup_address": order.pickup_address,
            "dropoff_address": order.dropoff_address,
            "delivery_window_start": order.delivery_window.start.isoformat(),
            "delivery_window_end": order.delivery_window.end.isoformat(),
            "special_instructions": order.special_instructions,
        }

    def _from_row(self, row: dict) -> Order:
        """Supabase row dict → Domain Entity."""
        return Order(
            id=UUID(row["id"]),
            company_id=UUID(row["company_id"]),
            cluster_id=UUID(row["cluster_id"]) if row.get("cluster_id") else None,
            cargo=CargoSpec(
                volume_m3=float(row["volume_m3"]),
                weight_kg=float(row["weight_kg"]),
                width_cm=float(row["width_cm"]) if row.get("width_cm") else None,
                height_cm=float(row["height_cm"]) if row.get("height_cm") else None,
                depth_cm=float(row["depth_cm"]) if row.get("depth_cm") else None,
                is_fragile=bool(row.get("is_fragile", False)),
                requires_refrigeration=bool(row.get("requires_refrigeration", False)),
            ),
            # Supabase/PostGIS returnează WKT: "POINT(lon lat)"
            pickup_location=Location.from_wkt(row["pickup_location"]),
            dropoff_location=Location.from_wkt(row["dropoff_location"]),
            delivery_window=TimeWindow(
                start=datetime.fromisoformat(row["delivery_window_start"]),
                end=datetime.fromisoformat(row["delivery_window_end"]),
            ),
            status=OrderStatus(row["status"]),
            pickup_address=row.get("pickup_address"),
            dropoff_address=row.get("dropoff_address"),
            special_instructions=row.get("special_instructions"),
        )

    # ─── Repository methods ──────────────────────────────────

    async def save(self, order: Order) -> Order:
        try:
            result = self._db.table("orders").upsert(
                self._to_row(order),
                on_conflict="id",
            ).execute()
            logger.debug(f"Order {order.id} saved")
            return order
        except Exception as e:
            raise DatabaseError(f"Failed to save order: {e}")

    async def find_by_id(self, order_id: UUID) -> Optional[Order]:
        try:
            result = self._db.table("orders") \
                .select("*") \
                .eq("id", str(order_id)) \
                .maybe_single() \
                .execute()
            return self._from_row(result.data) if result.data else None
        except Exception as e:
            raise DatabaseError(f"Failed to find order {order_id}: {e}")

    async def find_by_company(
        self,
        company_id: UUID,
        status: Optional[OrderStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Order]:
        try:
            q = self._db.table("orders") \
                .select("*") \
                .eq("company_id", str(company_id)) \
                .order("created_at", desc=True) \
                .range(offset, offset + limit - 1)
            if status:
                q = q.eq("status", status.value)
            result = q.execute()
            return [self._from_row(r) for r in result.data]
        except Exception as e:
            raise DatabaseError(f"Failed to list orders: {e}")

    async def find_pending_in_area(
        self,
        center: Location,
        radius_km: float,
        time_window: TimeWindow,
    ) -> List[Order]:
        """
        Apelează funcția SQL optimizată din Supabase.
        ST_DWithin cu geografie → distanță reală în metri.
        """
        try:
            result = self._db.rpc(
                "find_pending_orders_in_radius",
                {
                    "center_lon": center.longitude,
                    "center_lat": center.latitude,
                    "radius_m": radius_km * 1000,  # km → m
                    "window_start": time_window.start.isoformat(),
                    "window_end": time_window.end.isoformat(),
                },
            ).execute()
            return [self._from_row(r) for r in result.data]
        except Exception as e:
            raise DatabaseError(f"Spatial query failed: {e}")

    async def update_status(self, order_id: UUID, status: OrderStatus) -> None:
        try:
            self._db.table("orders") \
                .update({"status": status.value}) \
                .eq("id", str(order_id)) \
                .execute()
        except Exception as e:
            raise DatabaseError(f"Failed to update order status: {e}")

    async def delete(self, order_id: UUID) -> None:
        try:
            self._db.table("orders").delete().eq("id", str(order_id)).execute()
        except Exception as e:
            raise DatabaseError(f"Failed to delete order: {e}")
