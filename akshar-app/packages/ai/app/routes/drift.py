"""Drift detection endpoints — per-turn scoring + flagged conversations."""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import SERVICE_API_KEY
from app.services import drift_engine

router = APIRouter(prefix="/ai", tags=["drift"])


class DriftScoreRequest(BaseModel):
    conversationId: str = Field(..., min_length=1, max_length=128)
    text: str = Field(..., min_length=1, max_length=10000)


def _verify_service_key(x_service_key: str | None) -> None:
    if not x_service_key or x_service_key != SERVICE_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid service key")


@router.post("/drift-score")
async def score_drift(body: DriftScoreRequest, x_service_key: str | None = Header(None)):
    """Score one conversation turn for policy drift."""
    _verify_service_key(x_service_key)
    result = drift_engine.score_drift(body.conversationId, body.text)
    return {"ok": True, **result}


@router.get("/drift/{conversation_id}")
async def get_drift(conversation_id: str, x_service_key: str | None = Header(None)):
    """Get overall risk state for a conversation."""
    _verify_service_key(x_service_key)
    return {"ok": True, **drift_engine.get_conversation_risk(conversation_id)}


@router.get("/flagged-conversations")
async def get_flagged(x_service_key: str | None = Header(None)):
    """Get all conversations that have been flagged for drift."""
    _verify_service_key(x_service_key)
    return {"ok": True, "conversations": drift_engine.get_flagged_conversations()}
