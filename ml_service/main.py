"""
OptiFleet B2B — Python ML Service Entry Point
=============================================
FastAPI app expus INTERN (nu direct utilizatorilor).
Rust API → ML Service via HTTP intern.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from app.core.config import get_settings
from app.core.exceptions import (
    OptiFleetError, AIModelError, RoutingEngineError, ClusteringError
)
from app.api.v1 import clustering, optimization, ai_chat, tasks


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info(f"🐍 ML Service starting [{settings.ENVIRONMENT}]")
    logger.info(f"   Qwen3 model: {settings.QWEN3_MODEL} @ {settings.OLLAMA_BASE_URL}")
    logger.info(f"   Claude model: {settings.CLAUDE_MODEL}")
    logger.info(f"   OSRM: {settings.OSRM_BASE_URL}")
    yield
    logger.info("🛑 ML Service shutting down...")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="OptiFleet ML Service",
        description="Internal ML & AI engine — not exposed to end users",
        version="1.0.0",
        docs_url="/docs" if settings.is_development else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    # CORS: acceptă DOAR request-uri de la Rust API intern
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://api:8000", "http://localhost:8000"],
        allow_methods=["POST", "GET"],
        allow_headers=["*"],
    )

    # ─── Error handlers globali ──────────────────────────────
    @app.exception_handler(ClusteringError)
    async def clustering_error_handler(req: Request, exc: ClusteringError):
        return JSONResponse(status_code=422, content={"error": "CLUSTERING_FAILED", "message": exc.message})

    @app.exception_handler(AIModelError)
    async def ai_error_handler(req: Request, exc: AIModelError):
        return JSONResponse(status_code=503, content={"error": "AI_MODEL_ERROR", "message": exc.message})

    @app.exception_handler(RoutingEngineError)
    async def routing_error_handler(req: Request, exc: RoutingEngineError):
        return JSONResponse(status_code=503, content={"error": "ROUTING_ERROR", "message": exc.message})

    @app.exception_handler(OptiFleetError)
    async def general_error_handler(req: Request, exc: OptiFleetError):
        return JSONResponse(status_code=500, content={"error": "INTERNAL", "message": exc.message})

    # ─── Routers ────────────────────────────────────────────
    prefix = "/internal/v1"
    app.include_router(clustering.router, prefix=prefix)
    app.include_router(optimization.router, prefix=prefix)
    app.include_router(ai_chat.router, prefix=prefix)
    app.include_router(tasks.router, prefix=prefix)

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "ml_service"}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.is_development,
        log_level=settings.LOG_LEVEL.lower(),
    )
