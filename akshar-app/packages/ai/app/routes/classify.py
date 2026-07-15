"""Classification endpoint — real-time per-message scoring."""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.config import SERVICE_API_KEY
from app.services import live_engine
from app.services.style_detector import detect_ai_text

router = APIRouter(prefix="/ai", tags=["classify"])


class ClassifyRequest(BaseModel):
    room: str = Field(..., min_length=1, max_length=128)
    sender: str = Field(..., min_length=1, max_length=64)
    text: str = Field(..., min_length=1, max_length=10000)
    typingMs: float = Field(default=0.0, ge=0)


def _verify_service_key(x_service_key: str | None) -> None:
    if not x_service_key or x_service_key != SERVICE_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid service key")


@router.post("/classify-message")
async def classify_message(body: ClassifyRequest, x_service_key: str | None = Header(None)):
    """Classify a single message. Called by akshar-mesh per incoming message."""
    _verify_service_key(x_service_key)

    # CPU-bound ML inference must not block the async event loop.
    ai_result = await run_in_threadpool(detect_ai_text, body.text)
    p_ai = ai_result.get("pAI", 0.0)

    result = await run_in_threadpool(
        live_engine.classify_message,
        body.room,
        body.sender,
        body.text,
        body.typingMs,
        p_ai,
    )

    result["aiDetection"] = ai_result
    return {"ok": True, **result}


@router.get("/participants/{room_id}")
async def get_participants(room_id: str, x_service_key: str | None = Header(None)):
    """Get all participants with their verdicts for a room."""
    _verify_service_key(x_service_key)
    return {"ok": True, "participants": live_engine.get_participants(room_id)}
