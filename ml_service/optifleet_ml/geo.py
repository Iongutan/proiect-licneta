"""Geometrie pe sferă (WGS84)."""
import math

import numpy as np

EARTH_RADIUS_KM = 6371.0088
# Distanța rutieră medie în Moldova e ~1.3× distanța în linie dreaptă.
ROAD_FACTOR = 1.3
AVG_TRUCK_SPEED_KMH = 60.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def haversine_matrix_km(lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    """Matrice N×N de distanțe, vectorizată."""
    lat_r, lon_r = np.radians(lat), np.radians(lon)
    dlat = lat_r[:, None] - lat_r[None, :]
    dlon = lon_r[:, None] - lon_r[None, :]
    a = np.sin(dlat / 2) ** 2 + np.cos(lat_r)[:, None] * np.cos(lat_r)[None, :] * np.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0)))
