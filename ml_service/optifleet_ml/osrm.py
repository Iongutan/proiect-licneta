"""Client OSRM pentru matrici de distanță, cu rezervă Haversine."""
import logging

import httpx
import numpy as np

from .geo import AVG_TRUCK_SPEED_KMH, ROAD_FACTOR, haversine_matrix_km
from .schemas import Point

log = logging.getLogger(__name__)


class DistanceMatrix:
    def __init__(self, km: np.ndarray, minutes: np.ndarray, source: str):
        self.km = km
        self.minutes = minutes
        self.source = source


def haversine_fallback(points: list[Point]) -> DistanceMatrix:
    lat = np.array([p.lat for p in points])
    lon = np.array([p.lon for p in points])
    km = haversine_matrix_km(lat, lon) * ROAD_FACTOR
    return DistanceMatrix(km, km / AVG_TRUCK_SPEED_KMH * 60.0, "haversine")


async def distance_matrix(points: list[Point], base_url: str, timeout_s: float) -> DistanceMatrix:
    coords = ";".join(f"{p.lon:.6f},{p.lat:.6f}" for p in points)
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=timeout_s) as client:
            resp = await client.get(f"/table/v1/driving/{coords}", params={"annotations": "duration,distance"})
            resp.raise_for_status()
            data = resp.json()
        if data.get("code") != "Ok":
            raise ValueError(data.get("code"))
        # OSRM întoarce null pentru perechi fără drum; le înlocuim cu estimarea Haversine.
        fallback = haversine_fallback(points)
        km = np.array([[fallback.km[i][j] if v is None else v / 1000 for j, v in enumerate(row)]
                       for i, row in enumerate(data["distances"])])
        minutes = np.array([[fallback.minutes[i][j] if v is None else v / 60 for j, v in enumerate(row)]
                            for i, row in enumerate(data["durations"])])
        return DistanceMatrix(km, minutes, "osrm")
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        log.warning("OSRM indisponibil (%s) — folosesc Haversine", exc)
        return haversine_fallback(points)
