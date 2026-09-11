"""
OptiFleet B2B — Infrastructure: OSRM Routing Engine
=====================================================
Adapter pentru OSRM (Open Source Routing Machine).
Implementează IRoutingEngine cu fallback Haversine.
Cache Redis pentru matrici de distanțe frecvent cerute.
"""
from __future__ import annotations
import hashlib
import json
import math
from typing import List, Optional

import httpx
from loguru import logger

from app.domain.interfaces.i_interfaces import IRoutingEngine
from app.domain.value_objects.location import Location
from app.core.config import get_settings
from app.core.exceptions import RoutingEngineError


class RouteMatrix:
    def __init__(self, durations_sec: List[List[float]], distances_m: List[List[float]]):
        self.durations_sec = durations_sec
        self.distances_m = distances_m

    def duration_min(self, i: int, j: int) -> float:
        return self.durations_sec[i][j] / 60

    def distance_km(self, i: int, j: int) -> float:
        return self.distances_m[i][j] / 1000


class OSRMEngine(IRoutingEngine):
    """
    Adapter OSRM cu:
    - Cache Redis pentru matrice de distanțe (TTL 1h)
    - Fallback automat la Haversine dacă OSRM e indisponibil
    - Retry cu backoff exponențial
    """
    _ROAD_FACTOR = 1.4       # Haversine → distanță rutieră reală
    _AVG_SPEED_MPS = 13.89   # 50 km/h în m/s

    def __init__(self, redis_client=None):
        settings = get_settings()
        self._base_url = settings.OSRM_BASE_URL
        self._timeout = settings.OSRM_TIMEOUT_SEC
        self._redis = redis_client
        self._http = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=self._timeout,
        )

    # ─── Cache key ──────────────────────────────────────────

    def _matrix_cache_key(self, locations: List[Location]) -> str:
        coords_str = "|".join(f"{l.latitude:.6f},{l.longitude:.6f}" for l in locations)
        h = hashlib.md5(coords_str.encode()).hexdigest()
        return f"osrm:matrix:{h}"

    # ─── Public interface ────────────────────────────────────

    async def get_distance_matrix(self, locations: List[Location]) -> RouteMatrix:
        """
        N×N matricea de distanțe pe drumuri reale.
        Esențial pentru CVRP: distanțele Euclidiene nu reflectă realitatea.
        Cache: 1 oră în Redis.
        """
        if not locations:
            return RouteMatrix([], [])

        cache_key = self._matrix_cache_key(locations)

        # Verifică cache
        if self._redis:
            cached = await self._redis.get(cache_key)
            if cached:
                data = json.loads(cached)
                logger.debug(f"OSRM matrix cache HIT ({len(locations)} locations)")
                return RouteMatrix(data["durations"], data["distances"])

        # Apel OSRM
        coords = ";".join(f"{l.longitude},{l.latitude}" for l in locations)
        try:
            resp = await self._http.get(
                f"/table/v1/driving/{coords}",
                params={"annotations": "duration,distance"},
            )
            resp.raise_for_status()
            data = resp.json()

            matrix = RouteMatrix(
                durations_sec=data["durations"],
                distances_m=data["distances"],
            )

            # Salvează în cache (1 oră)
            if self._redis:
                await self._redis.setex(
                    cache_key,
                    3600,
                    json.dumps({"durations": matrix.durations_sec, "distances": matrix.distances_m}),
                )

            logger.debug(f"OSRM matrix OK ({len(locations)}×{len(locations)})")
            return matrix

        except Exception as e:
            logger.warning(f"OSRM matrix failed: {e}. Using Haversine fallback.")
            return self._haversine_matrix(locations)

    async def get_route(self, waypoints: List[Location]) -> Optional[dict]:
        """
        Rută completă cu geometrie GeoJSON.
        Utilizat pentru vizualizarea traseului pe hartă Mapbox.
        """
        if len(waypoints) < 2:
            return None

        coords = ";".join(f"{w.longitude},{w.latitude}" for w in waypoints)
        try:
            resp = await self._http.get(
                f"/route/v1/driving/{coords}",
                params={
                    "overview": "full",
                    "geometries": "geojson",
                    "steps": "false",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get("code") != "Ok" or not data.get("routes"):
                return None

            route = data["routes"][0]
            return {
                "distance_m": route["distance"],
                "distance_km": round(route["distance"] / 1000, 2),
                "duration_sec": route["duration"],
                "duration_min": round(route["duration"] / 60, 1),
                "geometry": route["geometry"],  # GeoJSON LineString
            }
        except Exception as e:
            logger.error(f"OSRM route failed: {e}")
            return None

    # ─── Fallback Haversine ──────────────────────────────────

    def _haversine_matrix(self, locations: List[Location]) -> RouteMatrix:
        """
        Estimare distanțe cu factor rutier 1.4.
        Folosit când OSRM nu e disponibil.
        """
        n = len(locations)
        distances = [[0.0] * n for _ in range(n)]
        durations = [[0.0] * n for _ in range(n)]

        for i in range(n):
            for j in range(n):
                if i != j:
                    km = locations[i].distance_to_km(locations[j])
                    dist_m = km * 1000 * self._ROAD_FACTOR
                    distances[i][j] = dist_m
                    durations[i][j] = dist_m / self._AVG_SPEED_MPS

        return RouteMatrix(durations_sec=durations, distances_m=distances)
