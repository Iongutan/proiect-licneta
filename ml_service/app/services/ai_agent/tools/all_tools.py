"""
OptiFleet B2B — Qwen3 Tools: Route, Vehicle, Cluster
======================================================
Tool-urile disponibile agentului Qwen3.
Fiecare tool se înregistrează automat în ToolRegistry la import.
Adaugă tool nou: crează fișier nou, importă-l în agent_orchestrator.py.
"""
from __future__ import annotations
from uuid import UUID

from loguru import logger

from app.services.ai_agent.tool_registry import ToolRegistry, Tool
from app.infrastructure.routing.osrm_engine import OSRMEngine
from app.infrastructure.database.vehicle_repository import SupabaseVehicleRepository
from app.domain.value_objects.location import Location


# ═══════════════════════════════════════════════════════════
# TOOL: calculate_route
# ═══════════════════════════════════════════════════════════

async def _calculate_route(
    origin_lat: float, origin_lon: float,
    dest_lat: float, dest_lon: float,
) -> dict:
    """Calculează ruta optimă pe drumuri reale între două puncte."""
    try:
        engine = OSRMEngine()
        result = await engine.get_route([
            Location(origin_lat, origin_lon),
            Location(dest_lat, dest_lon),
        ])
        if result:
            return {
                "distance_km": result["distance_km"],
                "duration_min": result["duration_min"],
                "has_route": True,
            }
        return {"has_route": False, "error": "Route not found"}
    except Exception as e:
        return {"has_route": False, "error": str(e)}


ToolRegistry.register(Tool(
    name="calculate_route",
    description=(
        "Calculează distanța și durata pe drumuri reale între două puncte GPS. "
        "Folosește date OSM actualizate pentru Moldova."
    ),
    parameters_schema={
        "type": "object",
        "properties": {
            "origin_lat":  {"type": "number", "description": "Latitudine punct plecare"},
            "origin_lon":  {"type": "number", "description": "Longitudine punct plecare"},
            "dest_lat":    {"type": "number", "description": "Latitudine destinație"},
            "dest_lon":    {"type": "number", "description": "Longitudine destinație"},
        },
        "required": ["origin_lat", "origin_lon", "dest_lat", "dest_lon"],
    },
    handler=_calculate_route,
    roles_allowed=["SUPER_ADMIN", "CARRIER_ADMIN", "CARRIER_DRIVER", "SME_ADMIN", "SME_USER"],
))


# ═══════════════════════════════════════════════════════════
# TOOL: find_available_vehicles
# ═══════════════════════════════════════════════════════════

async def _find_available_vehicles(
    center_lat: float, center_lon: float,
    radius_km: float = 50.0,
    min_volume_m3: float = 0.0,
    min_weight_kg: float = 0.0,
) -> dict:
    """Găsește vehicule disponibile în raza dată, ordonate după distanță."""
    try:
        repo = SupabaseVehicleRepository()
        vehicles = await repo.find_available_near(
            center=Location(center_lat, center_lon),
            radius_km=radius_km,
            min_capacity_m3=min_volume_m3,
            min_weight_kg=min_weight_kg,
        )
        return {
            "count": len(vehicles),
            "vehicles": [
                {
                    "id": str(v.id),
                    "license_plate": v.license_plate,
                    "capacity_m3": v.capacity_m3,
                    "max_weight_kg": v.max_weight_kg,
                    "city": v.current_city,
                    "driver": v.driver_name,
                }
                for v in vehicles[:5]  # Top 5 cele mai apropiate
            ],
        }
    except Exception as e:
        return {"count": 0, "error": str(e)}


ToolRegistry.register(Tool(
    name="find_available_vehicles",
    description=(
        "Caută vehicule disponibile în raza specificată față de o locație. "
        "Rezultatele sunt ordonate după distanță (cel mai aproape primul). "
        "Folosit pentru Dynamic Fleet Relocation."
    ),
    parameters_schema={
        "type": "object",
        "properties": {
            "center_lat":    {"type": "number", "description": "Latitudine centru căutare"},
            "center_lon":    {"type": "number", "description": "Longitudine centru căutare"},
            "radius_km":     {"type": "number", "description": "Raza de căutare în km (default 50)"},
            "min_volume_m3": {"type": "number", "description": "Capacitate minimă m³ necesară"},
            "min_weight_kg": {"type": "number", "description": "Capacitate minimă kg necesară"},
        },
        "required": ["center_lat", "center_lon"],
    },
    handler=_find_available_vehicles,
    roles_allowed=["SUPER_ADMIN", "CARRIER_ADMIN", "SME_ADMIN"],
))


# ═══════════════════════════════════════════════════════════
# TOOL: estimate_groupbuy_savings
# ═══════════════════════════════════════════════════════════

async def _estimate_groupbuy_savings(
    order_count: int,
    individual_cost_mdl: float,
) -> dict:
    """Estimează economiile la gruparea unui număr de comenzi."""
    if order_count < 2:
        return {"savings_pct": 0, "savings_mdl": 0, "message": "Minim 2 comenzi pentru groupbuy"}

    # 5% reducere per comandă adițională, max 35%
    discount_pct = min(5.0 * (order_count - 1), 35.0)
    total_individual = order_count * individual_cost_mdl
    total_grouped = total_individual * (1 - discount_pct / 100)
    savings_mdl = total_individual - total_grouped

    return {
        "order_count": order_count,
        "discount_pct": discount_pct,
        "individual_total_mdl": round(total_individual, 2),
        "grouped_total_mdl": round(total_grouped, 2),
        "savings_mdl": round(savings_mdl, 2),
        "cost_per_order_grouped": round(total_grouped / order_count, 2),
    }


ToolRegistry.register(Tool(
    name="estimate_groupbuy_savings",
    description=(
        "Calculează economiile estimate la gruparea comenzilor. "
        "Returnează discount procentual, economii totale în MDL și cost per comandă."
    ),
    parameters_schema={
        "type": "object",
        "properties": {
            "order_count":           {"type": "integer", "description": "Numărul de comenzi grupate"},
            "individual_cost_mdl":   {"type": "number", "description": "Costul individual per livrare (MDL)"},
        },
        "required": ["order_count", "individual_cost_mdl"],
    },
    handler=_estimate_groupbuy_savings,
    roles_allowed=["SUPER_ADMIN", "CARRIER_ADMIN", "SME_ADMIN", "SME_USER", "SUPPLIER"],
))
