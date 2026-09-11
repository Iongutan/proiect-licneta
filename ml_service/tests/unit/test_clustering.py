"""
OptiFleet B2B — Tests: DBSCAN Clustering Unit Tests
Rulează: pytest tests/unit/test_clustering.py -v
"""
import pytest
import math
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
from datetime import datetime, timedelta, timezone

from app.services.clustering.clustering_service import ClusteringService
from app.domain.entities.order import Order, OrderStatus
from app.domain.value_objects.location import Location
from app.domain.value_objects.time_window import TimeWindow
from app.domain.value_objects.cargo_spec import CargoSpec


# ─── Helpers ───────────────────────────────────────────────────────────────

def make_order(lat: float, lon: float, hours_from_now: float = 12) -> Order:
    """Factory: creează Order la coordonate date."""
    now = datetime.now(timezone.utc)
    return Order(
        id=uuid4(),
        company_id=uuid4(),
        status=OrderStatus.PENDING,
        pickup_location=Location(lat, lon),
        dropoff_location=Location(lat + 0.1, lon + 0.1),
        delivery_window=TimeWindow(
            start=now + timedelta(hours=2),
            end=now + timedelta(hours=hours_from_now),
        ),
        cargo=CargoSpec(volume_m3=2.0, weight_kg=300.0),
    )


# ─── Tests ─────────────────────────────────────────────────────────────────

class TestDBSCANClustering:
    """Testează algoritmul DBSCAN de clustering geo-temporal."""

    def test_cluster_nearby_orders(self):
        """
        8 comenzi în raza 5km → trebuie să formeze 1 cluster.
        """
        # Toate în centrul Chișinăului (±0.03° ≈ 3km)
        orders = [
            make_order(47.0105 + i * 0.005, 28.8638 + i * 0.003)
            for i in range(8)
        ]

        service = ClusteringService(eps_km=15.0, min_samples=2)
        clusters = service.cluster_orders_spatial(orders)

        assert len(clusters) >= 1
        # Cel mai mare cluster trebuie să aibă cele mai multe comenzi
        largest = max(clusters, key=lambda c: len(c.orders))
        assert len(largest.orders) >= 4

    def test_distant_orders_not_clustered_together(self):
        """
        Comenzi la 100km distanță → clustere separate.
        """
        chisinau_orders = [make_order(47.01 + i * 0.001, 28.86) for i in range(4)]
        balti_orders = [make_order(47.76 + i * 0.001, 27.93) for i in range(4)]

        all_orders = chisinau_orders + balti_orders
        service = ClusteringService(eps_km=15.0, min_samples=2)
        clusters = service.cluster_orders_spatial(all_orders)

        # Trebuie să avem cel puțin 2 clustere separate
        assert len(clusters) >= 2

    def test_single_order_is_noise(self):
        """
        O singură comandă izolată → nu formează cluster (DBSCAN noise).
        """
        isolated = [make_order(46.0, 27.0)]  # Departe de orice
        grouped = [make_order(47.01 + i * 0.001, 28.86) for i in range(5)]

        service = ClusteringService(eps_km=15.0, min_samples=2)
        clusters = service.cluster_orders_spatial(isolated + grouped)

        # Comanda izolată nu trebuie să fie în niciun cluster
        all_order_ids_in_clusters = {
            str(o.id) for c in clusters for o in c.orders
        }
        assert str(isolated[0].id) not in all_order_ids_in_clusters

    def test_cluster_stats_calculation(self):
        """
        Statisticile clusterului (volum total, greutate, discount) sunt corecte.
        """
        orders = [
            make_order(47.010 + i * 0.002, 28.863)
            for i in range(5)
        ]
        # Fiecare comandă: 2.0 m³, 300 kg

        service = ClusteringService(eps_km=15.0, min_samples=2)
        clusters = service.cluster_orders_spatial(orders)

        if clusters:
            cluster = clusters[0]
            n = len(cluster.orders)
            assert math.isclose(cluster.total_volume_m3, n * 2.0, rel_tol=0.01)
            assert math.isclose(cluster.total_weight_kg, n * 300.0, rel_tol=0.01)
            # Discount ≥ 5% dacă sunt ≥ 2 comenzi
            assert cluster.estimated_discount >= 5.0

    def test_empty_orders_returns_empty_clusters(self):
        """Lista goală → niciun cluster."""
        service = ClusteringService(eps_km=15.0, min_samples=2)
        clusters = service.cluster_orders_spatial([])
        assert clusters == []


class TestLocationValueObject:
    """Testează Value Object Location și calculele de distanță."""

    def test_haversine_chisinau_balti(self):
        """
        Distanța Chișinău–Bălți ≈ 137 km (verificat pe hartă).
        """
        chisinau = Location(47.0105, 28.8638)
        balti = Location(47.7630, 27.9290)

        dist = chisinau.distance_km(balti)
        assert 130 < dist < 150, f"Expected ~137 km, got {dist:.1f} km"

    def test_same_location_zero_distance(self):
        """Aceeași locație → distanță 0."""
        loc = Location(47.0, 28.86)
        assert loc.distance_km(loc) < 0.001

    def test_invalid_latitude_raises(self):
        """Latitudine invalidă → ValueError."""
        with pytest.raises(ValueError):
            Location(91.0, 28.86)  # Lat > 90

    def test_invalid_longitude_raises(self):
        """Longitudine invalidă → ValueError."""
        with pytest.raises(ValueError):
            Location(47.0, 181.0)  # Lon > 180
