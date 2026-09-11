"""
OptiFleet B2B — Value Object: Location
========================================
Value Object imutabil pentru coordonate geografice.
Principii:
  - frozen=True → imutabil după creare
  - Validare în __post_init__
  - Comportament (metode) inclus în obiect
  - Se compară prin valoare, nu prin referință
"""
from __future__ import annotations
from dataclasses import dataclass
import math
from typing import Tuple

from app.core.exceptions import InvalidLocationError


@dataclass(frozen=True)
class Location:
    """
    Coordonate geografice imutabile (WGS84 / SRID 4326).

    Exemple:
        chisinau = Location(latitude=47.0105, longitude=28.8638)
        balti = Location(latitude=47.7630, longitude=27.9290)
        dist = chisinau.distance_to_km(balti)  # ~94 km
    """
    latitude: float
    longitude: float

    def __post_init__(self) -> None:
        if not (-90.0 <= self.latitude <= 90.0):
            raise InvalidLocationError(
                f"Latitude {self.latitude} out of range [-90, 90]"
            )
        if not (-180.0 <= self.longitude <= 180.0):
            raise InvalidLocationError(
                f"Longitude {self.longitude} out of range [-180, 180]"
            )

    # ─── Distanță ───────────────────────────────────────────

    def distance_to_km(self, other: Location) -> float:
        """
        Distanță Haversine în km.
        Eroare: ~0.5% față de distanța reală pe glob.
        """
        R = 6371.0
        lat1 = math.radians(self.latitude)
        lat2 = math.radians(other.latitude)
        dlat = math.radians(other.latitude - self.latitude)
        dlon = math.radians(other.longitude - self.longitude)

        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        )
        return R * 2 * math.asin(math.sqrt(a))

    def is_within_radius_km(self, center: Location, radius_km: float) -> bool:
        """Verifică dacă locația e în raza dată față de centru."""
        return self.distance_to_km(center) <= radius_km

    # ─── Conversii ──────────────────────────────────────────

    def to_wkt(self) -> str:
        """PostGIS WKT format: POINT(lon lat)"""
        return f"POINT({self.longitude} {self.latitude})"

    def to_tuple_lat_lon(self) -> Tuple[float, float]:
        return (self.latitude, self.longitude)

    def to_tuple_lon_lat(self) -> Tuple[float, float]:
        """Format GeoJSON și Mapbox: [lon, lat]"""
        return (self.longitude, self.latitude)

    def to_geojson_coords(self) -> list:
        """GeoJSON coordinates: [longitude, latitude]"""
        return [self.longitude, self.latitude]

    def to_radians_tuple(self) -> Tuple[float, float]:
        """Format pentru sklearn (Haversine metric): [lat_rad, lon_rad]"""
        return (math.radians(self.latitude), math.radians(self.longitude))

    @classmethod
    def from_wkt(cls, wkt: str) -> Location:
        """
        Parse din format WKT PostGIS: 'POINT(28.8638 47.0105)'
        Atenție: WKT e (lon, lat) nu (lat, lon)!
        """
        clean = wkt.strip().upper()
        if not clean.startswith("POINT("):
            raise InvalidLocationError(f"Invalid WKT format: {wkt}")
        coords_str = clean.replace("POINT(", "").replace(")", "")
        parts = coords_str.strip().split()
        if len(parts) != 2:
            raise InvalidLocationError(f"Expected 2 coordinates, got: {wkt}")
        lon, lat = float(parts[0]), float(parts[1])
        return cls(latitude=lat, longitude=lon)

    @classmethod
    def chisinau(cls) -> Location:
        """Locație predefinită: Chișinău (pentru testing)."""
        return cls(latitude=47.0105, longitude=28.8638)

    @classmethod
    def balti(cls) -> Location:
        """Locație predefinită: Bălți."""
        return cls(latitude=47.7630, longitude=27.9290)
