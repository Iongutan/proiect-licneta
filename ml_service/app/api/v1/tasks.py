"""
OptiFleet B2B — API: Tasks Queue & Polling Endpoints (PROMPT J5)
================================================================
Endpoints pentru punerea în coadă asincronă a calculelor grele și verificare status/rezultat.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.services.task_queue import TaskQueueService

router = APIRouter(prefix="/tasks", tags=["ML: Task Queue"])


class TaskStatusResponse(BaseModel):
    task_id: str
    task_type: str
    status: str
    result: Optional[Any] = None
    error: Optional[str] = None
    created_at: float
    completed_at: Optional[float] = None


class EnqueueResponse(BaseModel):
    task_id: str
    status: str = "PENDING"
    message: str = "Task successfully queued for background processing"


@router.post("/clustering", response_model=EnqueueResponse)
async def enqueue_clustering(payload: Dict[str, Any]):
    """
    Pune o sarcină grea de clustering DBSCAN în coada Redis.
    Returnează task_id imediat (non-blocking).
    """
    queue_service = TaskQueueService()
    task_id = queue_service.enqueue("clustering", payload)
    return EnqueueResponse(task_id=task_id)


@router.post("/optimization", response_model=EnqueueResponse)
async def enqueue_optimization(payload: Dict[str, Any]):
    """
    Pune o sarcină grea de optimizare CVRP (OR-Tools) în coada Redis.
    Returnează task_id imediat (non-blocking).
    """
    queue_service = TaskQueueService()
    task_id = queue_service.enqueue("optimization", payload)
    return EnqueueResponse(task_id=task_id)


@router.get("/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """
    Verificare periodică (polling) a stării și rezultatului sarcinii.
    """
    queue_service = TaskQueueService()
    task = queue_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskStatusResponse(**task)
