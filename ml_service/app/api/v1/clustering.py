"""
OptiFleet B2B — API: Clustering Endpoint (ML Service)
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List
from uuid import UUID

from app.services.clustering.clustering_service import ClusteringService
from app.domain.value_objects.location import Location

router = APIRouter(prefix="/clustering", tags=["ML: Clustering"])


class TriggerClusteringRequest(BaseModel):
    center_lat: float = Field(..., ge=-90, le=90)
    center_lon: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(default=15.0, gt=0, le=500)
    window_hours: float = Field(default=24.0, gt=0, le=168)


class ClusterResultResponse(BaseModel):
    cluster_id: UUID
    order_ids: List[UUID]
    order_count: int
    total_volume_m3: float
    total_weight_kg: float
    estimated_discount_pct: float
    vehicles_available: int
    center_lat: float
    center_lon: float


@router.post("/trigger", response_model=List[ClusterResultResponse])
async def trigger_clustering(req: TriggerClusteringRequest):
    """
    Declanșat de Rust API după plasarea unei noi comenzi.
    Găsește comenzi PENDING în zonă și le grupează.
    """
    service = ClusteringService()
    results = await service.cluster_area(
        center=Location(req.center_lat, req.center_lon),
        radius_km=req.radius_km,
        window_hours=req.window_hours,
    )

    return [
        ClusterResultResponse(
            cluster_id=r.cluster.id,
            order_ids=[o.id for o in r.cluster.orders],
            order_count=r.cluster.order_count,
            total_volume_m3=round(r.cluster.total_volume_m3, 3),
            total_weight_kg=round(r.cluster.total_weight_kg, 2),
            estimated_discount_pct=r.savings_pct,
            vehicles_available=r.vehicles_available,
            center_lat=r.cluster.center_location.latitude if r.cluster.center_location else req.center_lat,
            center_lon=r.cluster.center_location.longitude if r.cluster.center_location else req.center_lon,
        )
        for r in results
    ]
