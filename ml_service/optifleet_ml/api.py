"""Aplicația FastAPI. Toate rutele /v1 cer tokenul intern."""
import asyncio
import logging

from fastapi import APIRouter, Depends, FastAPI, HTTPException

from .config import Settings, get_settings
from .grouping import group_shipments
from .intent import IntentUnavailable, parse_intent
from .osrm import distance_matrix
from .routing import build_points, solve
from .schemas import (
    GroupingRequest, GroupingResponse, IntentRequest, IntentResponse,
    RoutingRequest, RoutingResponse,
)
from .security import require_internal_token

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

v1 = APIRouter(prefix="/v1", dependencies=[Depends(require_internal_token)])


@v1.post("/grouping", response_model=GroupingResponse)
async def grouping(req: GroupingRequest, settings: Settings = Depends(get_settings)) -> GroupingResponse:
    if len(req.shipments) > settings.max_shipments:
        raise HTTPException(413, f"maxim {settings.max_shipments} cereri")
    # DBSCAN e CPU-bound: îl rulăm pe un thread ca să nu blocăm event loop-ul.
    return await asyncio.to_thread(group_shipments, req)


@v1.post("/routing/optimize", response_model=RoutingResponse)
async def optimize(req: RoutingRequest, settings: Settings = Depends(get_settings)) -> RoutingResponse:
    if len(req.shipments) * 2 + 1 > settings.max_route_stops:
        raise HTTPException(413, f"maxim {(settings.max_route_stops - 1) // 2} cereri per optimizare")
    if len(req.vehicles) > settings.max_vehicles:
        raise HTTPException(413, f"maxim {settings.max_vehicles} vehicule")
    matrix = await distance_matrix(build_points(req), settings.osrm_base_url, settings.osrm_timeout_s)
    return await asyncio.to_thread(solve, req, matrix)


@v1.post("/intent", response_model=IntentResponse)
async def intent(req: IntentRequest, settings: Settings = Depends(get_settings)) -> IntentResponse:
    try:
        return await parse_intent(req, settings.ollama_base_url, settings.ollama_model, settings.ollama_timeout_s)
    except IntentUnavailable:
        raise HTTPException(503, "modelul local nu răspunde") from None


def create_app() -> FastAPI:
    settings = get_settings()  # eșuează la pornire dacă lipsește INTERNAL_API_TOKEN
    dev = settings.environment == "development"
    app = FastAPI(
        title="OptiFleet ML (intern)",
        docs_url="/docs" if dev else None,
        redoc_url=None,
        openapi_url="/openapi.json" if dev else None,
    )
    app.include_router(v1)

    @app.get("/health", include_in_schema=False)
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app
