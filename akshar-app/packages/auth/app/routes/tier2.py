"""Tier 2 integrity refresh + Tier 2b re-verify routes."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Header

from app.models.requests import ReverifyRequest
from app.routes.profile import _require_auth
from app.services import tier2_service

router = APIRouter(prefix="/auth", tags=["tier2"])


@router.get("/tier2/{user_id}")
async def get_trust_status(user_id: str, authorization: str | None = Header(None)):
    session = await _require_auth(authorization)
    if session.get("userId") != user_id:
        raise HTTPException(status_code=403, detail="Cannot view another user's trust status")
    try:
        return await tier2_service.get_trust_status(user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/tier2/refresh")
async def refresh_integrity(authorization: str | None = Header(None)):
    session = await _require_auth(authorization)
    user_id = session.get("userId")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session")
    try:
        return await tier2_service.refresh_integrity(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tier 2 refresh failed: {e}")


@router.post("/reverify")
async def reverify_identity(body: ReverifyRequest, authorization: str | None = Header(None)):
    """Mandatory step-up identity verification when account is under risk."""
    session = await _require_auth(authorization)
    user_id = session.get("userId")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session")

    try:
        result = await tier2_service.reverify_identity(
            user_id,
            body.faceHash,
            body.deviceId,
            liveness_passed=body.livenessPassed,
        )
        return {"ok": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Re-verify failed: {e}")
