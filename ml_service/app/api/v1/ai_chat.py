"""
OptiFleet B2B — API: AI Chat Endpoint (ML Service)
===================================================
Endpoint intern apelat de Rust API.
Returnează SSE stream cu răspunsul Claude (îmbogățit de Qwen3).
"""
from fastapi import APIRouter, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json

from app.domain.interfaces.i_interfaces import Message
from app.services.ai_agent.orchestrator import AgentOrchestrator

router = APIRouter(prefix="/chat", tags=["AI Chat"])


class ChatRequest(BaseModel):
    messages: List[dict]          # [{role, content}]
    user_roles: List[str]         # Rolurile utilizatorului (din JWT Rust)
    stream: bool = True


@router.post("/stream")
async def chat_stream(req: ChatRequest):
    """
    Chat cu streaming SSE.
    Apelat de Rust API care transmite mai departe stream-ul la frontend.
    """
    messages = [Message(**m) for m in req.messages]
    orchestrator = AgentOrchestrator(user_roles=req.user_roles)

    async def generate():
        try:
            async for chunk in orchestrator.chat_stream(messages):
                yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/complete")
async def chat_complete(req: ChatRequest):
    """Versiune non-streaming (pentru integrări simple)."""
    messages = [Message(**m) for m in req.messages]
    orchestrator = AgentOrchestrator(user_roles=req.user_roles)
    content = await orchestrator.chat_complete(messages)
    return {"content": content}
