"""
OptiFleet B2B — Service: DBSCAN Clustering
============================================
Implementare DBSCAN pentru clustering spațial al comenzilor.
Folosește metrica Haversine → clustere pe baza distanțelor reale km.
Avantaj vs K-Means: nu necesită K predefinit, detectează outlieri.
"""
from __future__ import annotations
import numpy as np
from typing import List, Dict
from sklearn.cluster import DBSCAN

from app.domain.entities.order import Order
from app.domain.interfaces.i_interfaces import IClusteringStrategy
from loguru import logger

# Raza Pământului în km (pentru conversia eps km → radiani)
_EARTH_RADIUS_KM = 6371.0


class DBSCANClusteringStrategy(IClusteringStrategy):
    """
    DBSCAN cu metrică Haversine.
    Parametri:
        eps_km: Distanța maximă (km) între două puncte din același cluster
        min_samples: Numărul minim de comenzi pentru a forma un cluster
    """

    def cluster(
        self,
        orders: List[Order],
        eps_km: float = 15.0,
        min_samples: int = 2,
    ) -> Dict[int, List[Order]]:
        if not orders:
            return {}

        if len(orders) == 1:
            # Un singur order nu poate forma cluster (outlier)
            return {-1: orders}

        # Coordonate pickup în radiani (sklearn Haversine cere radiani)
        coords = np.array([
            [
                np.radians(o.pickup_location.latitude),
                np.radians(o.pickup_location.longitude),
            ]
            for o in orders
        ], dtype=np.float64)

        eps_radians = eps_km / _EARTH_RADIUS_KM

        db = DBSCAN(
            eps=eps_radians,
            min_samples=min_samples,
            algorithm="ball_tree",  # Cel mai eficient pentru Haversine
            metric="haversine",
            n_jobs=-1,              # Paralelizare pe toate CPU cores
        )
        labels = db.fit_predict(coords)

        # Grupare orders după label
        clusters: Dict[int, List[Order]] = {}
        for order, label in zip(orders, labels):
            clusters.setdefault(int(label), []).append(order)

        n_clusters = sum(1 for k in clusters if k >= 0)
        n_outliers = len(clusters.get(-1, []))
        logger.info(
            f"DBSCAN: {len(orders)} orders → {n_clusters} clusters, "
            f"{n_outliers} outliers (eps={eps_km}km, min_samples={min_samples})"
        )
        return clusters

    def get_algorithm_name(self) -> str:
        return "DBSCAN (Haversine, ball_tree)"


class HDBSCANClusteringStrategy(IClusteringStrategy):
    """
    HDBSCAN — versiune ierarhică, mai robustă la densități variabile.
    Avantaj: nu necesită eps fix, se adaptează la densitatea datelor.
    Dezavantaj: mai lent pe seturi mari (>10k orders).
    """

    def cluster(
        self,
        orders: List[Order],
        eps_km: float = 15.0,       # Ignorat în HDBSCAN (parametru compatibilitate)
        min_samples: int = 2,
    ) -> Dict[int, List[Order]]:
        try:
            import hdbscan
        except ImportError:
            logger.warning("hdbscan not installed, falling back to DBSCAN")
            return DBSCANClusteringStrategy().cluster(orders, eps_km, min_samples)

        if not orders:
            return {}

        coords = np.array([
            [o.pickup_location.latitude, o.pickup_location.longitude]
            for o in orders
        ], dtype=np.float64)

        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_samples,
            metric="haversine",
            cluster_selection_epsilon=eps_km / _EARTH_RADIUS_KM,
        )
        labels = clusterer.fit_predict(np.radians(coords))

        clusters: Dict[int, List[Order]] = {}
        for order, label in zip(orders, labels):
            clusters.setdefault(int(label), []).append(order)

        return clusters

    def get_algorithm_name(self) -> str:
        return "HDBSCAN (adaptive density)"
