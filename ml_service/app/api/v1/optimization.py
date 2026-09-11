"""
OptiFleet B2B — API: Route Optimization Endpoint (ML Service)
"""
from fastapi import APIRouter, Body
from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID

from app.services.optimization.cvrp_optimizer import CVRPOptimizer, OptimizedRoute
from app.infrastructure.routing.osrm_engine import OSRMEngine
from app.infrastructure.database.vehicle_repository import SupabaseVehicleRepository
from app.domain.value_objects.location import Location

router = APIRouter(prefix="/optimization", tags=["ML: Route Optimization"])


class OptimizeRequest(BaseModel):
    cluster_id: UUID
    depot_lat: float = Field(..., ge=-90, le=90)
    depot_lon: float = Field(..., ge=-180, le=180)
    vehicle_ids: List[UUID]
    time_limit_seconds: int = Field(default=30, ge=5, le=120)


class WaypointOut(BaseModel):
    lat: float
    lon: float
    order_id: Optional[UUID]
    stop_type: str


class OptimizedRouteOut(BaseModel):
    vehicle_id: UUID
    stops: List[WaypointOut]
    total_distance_km: float
    total_duration_min: float
    estimated_co2_saved_kg: float
    waypoints_geojson: list


@router.post("/route", response_model=List[OptimizedRouteOut])
async def optimize_cluster_routes(req: OptimizeRequest):
    """
    CVRP cu OR-Tools + OSRM.
    Calculează secvența optimă de vizitare a tuturor comenzilor din cluster.
    Minimizează km totali, respectă capacitățile vehiculelor.
    """
    from app.infrastructure.database.order_repository import SupabaseOrderRepository
    from app.domain.entities.cluster import GroupBuyCluster, ClusterStatus

    # Obține comenzile clusterului
    order_repo = SupabaseOrderRepository()
    orders = await order_repo.find_by_company(
        # Clustered orders for this cluster
        company_id=req.cluster_id,  # Hack: folosim cluster_id — în producție adaugă repo dedicat
    )

    # Obține vehiculele
    vehicle_repo = SupabaseVehicleRepository()
    vehicles = []
    for vid in req.vehicle_ids:
        v = await vehicle_repo.find_by_id(vid)
        if v:
            vehicles.append(v)

    if not vehicles:
        return []

    depot = Location(req.depot_lat, req.depot_lon)
    osrm = OSRMEngine()
    optimizer = CVRPOptimizer(osrm=osrm)

    # Construiește cluster din comenzile găsite
    cluster = GroupBuyCluster()
    for order in orders:
        if order.cluster_id == req.cluster_id:
            cluster.orders.append(order)

    if not cluster.orders:
        return []

    routes = await optimizer.optimize(
        cluster=cluster,
        vehicles=vehicles,
        depot_location=depot,
        time_limit_seconds=req.time_limit_seconds,
    )

    return [
        OptimizedRouteOut(
            vehicle_id=r.vehicle_id,
            stops=[WaypointOut(
                lat=s.location.latitude,
                lon=s.location.longitude,
                order_id=s.order_id,
                stop_type=s.stop_type,
            ) for s in r.stops],
            total_distance_km=r.total_distance_km,
            total_duration_min=r.total_duration_min,
            estimated_co2_saved_kg=r.estimated_co2_saved_kg,
            waypoints_geojson=r.waypoints_geojson,
        )
        for r in routes
    ]
