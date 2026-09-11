"""
OptiFleet B2B — Service: Clustering Orchestrator
=================================================
Coordonează procesul complet de group-buying clustering.
Injectează strategia de clustering (Strategy Pattern).
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional
from uuid import UUID

from loguru import logger

from app.domain.entities.order import Order
from app.domain.entities.cluster import GroupBuyCluster
from app.domain.interfaces.i_interfaces import IClusteringStrategy
from app.domain.value_objects.location import Location
from app.domain.value_objects.time_window import TimeWindow
from app.infrastructure.database.order_repository import SupabaseOrderRepository
from app.infrastructure.database.vehicle_repository import SupabaseVehicleRepository
from app.services.clustering.clustering_strategies import DBSCANClusteringStrategy
from app.core.config import get_settings
from app.core.exceptions import ClusteringError


@dataclass
class ClusteringResult:
    cluster: GroupBuyCluster
    savings_pct: float          # % reducere față de livrări individuale
    vehicles_available: int     # vehicule disponibile în zonă


class ClusteringService:
    """
    Use Case: Group-Buying Clustering
    Orchestrează: query DB → clustering → creare entități cluster → persistare
    """

    def __init__(
        self,
        strategy: Optional[IClusteringStrategy] = None,
    ):
        # Dependency Injection — default DBSCAN, poate fi înlocuit
        self._strategy = strategy or DBSCANClusteringStrategy()
        self._order_repo = SupabaseOrderRepository()
        self._vehicle_repo = SupabaseVehicleRepository()
        self._settings = get_settings()

    async def cluster_area(
        self,
        center: Location,
        radius_km: float = None,
        window_hours: float = None,
    ) -> List[ClusteringResult]:
        """
        Procesul complet de clustering pentru o zonă:
        1. Găsește comenzi PENDING în aria dată
        2. Aplică algoritmul de clustering
        3. Creează entitățile GroupBuyCluster
        4. Calculează economiile estimate
        5. Găsește vehicule disponibile
        """
        radius_km = radius_km or self._settings.CLUSTERING_EPS_KM
        window_hours = window_hours or self._settings.CLUSTERING_WINDOW_HOURS

        time_window = TimeWindow.next_24h() if window_hours == 24 else \
            TimeWindow.next_24h().expand(window_hours / 2 - 12)

        # Pasul 1: Găsește comenzi eligibile (spatial query PostGIS)
        pending_orders = await self._order_repo.find_pending_in_area(
            center=center,
            radius_km=radius_km * 2,  # Zonă mai mare → clustering mai bun
            time_window=time_window,
        )

        if len(pending_orders) < 2:
            logger.info(f"Not enough orders for clustering in area (found {len(pending_orders)})")
            return []

        logger.info(f"Clustering {len(pending_orders)} orders in {radius_km}km radius...")

        # Pasul 2: Aplică algoritm de clustering
        try:
            label_to_orders = self._strategy.cluster(
                orders=pending_orders,
                eps_km=radius_km,
                min_samples=self._settings.CLUSTERING_MIN_SAMPLES,
            )
        except Exception as e:
            raise ClusteringError(f"Clustering algorithm failed: {e}")

        results: List[ClusteringResult] = []

        # Pasul 3: Creează clustere (ignoră outlieri cu label -1)
        for label, orders in label_to_orders.items():
            if label == -1 or len(orders) < 2:
                continue

            cluster = GroupBuyCluster()
            for order in orders:
                cluster.add_order(order)
            cluster.mark_ready()

            # Pasul 4: Calculează economii
            savings = cluster.estimated_discount_pct

            # Pasul 5: Vehicule disponibile în zonă
            cluster_center = cluster.center_location
            vehicles_nearby = []
            if cluster_center:
                vehicles_nearby = await self._vehicle_repo.find_available_near(
                    center=cluster_center,
                    radius_km=radius_km * 3,
                    min_capacity_m3=cluster.total_volume_m3,
                    min_weight_kg=cluster.total_weight_kg,
                )

            results.append(ClusteringResult(
                cluster=cluster,
                savings_pct=savings,
                vehicles_available=len(vehicles_nearby),
            ))

            logger.info(
                f"Cluster formed: {cluster.order_count} orders, "
                f"{cluster.total_volume_m3:.1f}m³, "
                f"{cluster.total_weight_kg:.0f}kg, "
                f"discount={savings:.1f}%, "
                f"vehicles_nearby={len(vehicles_nearby)}"
            )

        return results
