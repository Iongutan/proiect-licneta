"""
OptiFleet B2B — Asynchronous Task Queue Service (PROMPT J5)
===========================================================
Permite descărcarea calculelor grele (clustering DBSCAN, CVRP OR-Tools)
din calea sincronă a cererilor HTTP către workeri asincroni prin Redis.
Suportă polling pe task_id și notificare push prin Redis Pub/Sub (WebSocket fan-out).
"""
import json
import time
import uuid
from typing import Optional, Dict, Any
import redis
from loguru import logger

from app.core.config import get_settings

QUEUE_KEY = "optifleet:tasks:queue"
TASK_PREFIX = "optifleet:tasks:"
PUBSUB_CHANNEL = "optifleet:tasks:events"
TASK_TTL_SECONDS = 3600 * 24  # Păstrează rezultatele 24h


class TaskQueueService:
    def __init__(self):
        settings = get_settings()
        self.redis = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

    def enqueue(self, task_type: str, payload: Dict[str, Any]) -> str:
        """
        Adaugă o sarcină grea în coada Redis și returnează task_id unic.
        """
        task_id = str(uuid.uuid4())
        task_data = {
            "task_id": task_id,
            "task_type": task_type,
            "status": "PENDING",
            "payload": json.dumps(payload),
            "result": "",
            "error": "",
            "created_at": str(time.time()),
            "completed_at": "",
        }

        task_key = f"{TASK_PREFIX}{task_id}"
        pipe = self.redis.pipeline()
        pipe.hset(task_key, mapping=task_data)
        pipe.expire(task_key, TASK_TTL_SECONDS)
        pipe.lpush(QUEUE_KEY, task_id)
        pipe.execute()

        logger.info(f"Task {task_id} [{task_type}] enqueued successfully")
        return task_id

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Obține starea și rezultatul unui task (pentru polling).
        """
        task_key = f"{TASK_PREFIX}{task_id}"
        data = self.redis.hgetall(task_key)
        if not data:
            return None

        result_raw = data.get("result", "")
        parsed_result = json.loads(result_raw) if result_raw else None

        return {
            "task_id": data.get("task_id", task_id),
            "task_type": data.get("task_type", ""),
            "status": data.get("status", "UNKNOWN"),
            "result": parsed_result,
            "error": data.get("error", None) or None,
            "created_at": float(data.get("created_at", 0)),
            "completed_at": float(data.get("completed_at", 0)) if data.get("completed_at") else None,
        }

    def update_task_status(
        self,
        task_id: str,
        status: str,
        result: Optional[Any] = None,
        error: Optional[str] = None,
    ):
        """
        Actualizează starea sarcinii și publică eveniment pe canalul Pub/Sub.
        """
        task_key = f"{TASK_PREFIX}{task_id}"
        updates = {
            "status": status,
        }
        if result is not None:
            updates["result"] = json.dumps(result)
        if error is not None:
            updates["error"] = str(error)
        if status in ("COMPLETED", "FAILED"):
            updates["completed_at"] = str(time.time())

        self.redis.hset(task_key, mapping=updates)

        # Notificare prin Redis Pub/Sub (PROMPT J5 + J10)
        event = {
            "task_id": task_id,
            "status": status,
            "timestamp": time.time(),
        }
        self.redis.publish(PUBSUB_CHANNEL, json.dumps(event))
        self.redis.publish(f"task:completed:{task_id}", json.dumps(event))
        logger.info(f"Task {task_id} status updated to {status}")
