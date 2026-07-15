"""Account Studio + reports/appeals routes."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

from app.routes.profile import _require_auth
from app.services import reports_service, studio_service, tier2_service

router = APIRouter(prefix="/auth", tags=["studio"])


class AppealRequest(BaseModel):
    appealText: str = Field(..., min_length=10, max_length=2000)


@router.get("/studio/{user_id}")
async def get_studio(user_id: str, authorization: str | None = Header(None)):
    session = await _require_auth(authorization)
    if session.get("userId") != user_id:
        raise HTTPException(status_code=403, detail="Cannot view another user's studio")
    try:
        return await studio_service.get_studio_dashboard(user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/risk-status")
async def get_risk_status(authorization: str | None = Header(None)):
    session = await _require_auth(authorization)
    user_id = session.get("userId")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session")
    return await tier2_service.get_risk_status(user_id)


@router.post("/reports/{report_id}/appeal")
async def submit_appeal(
    report_id: str,
    body: AppealRequest,
    authorization: str | None = Header(None),
):
    session = await _require_auth(authorization)
    user_id = session.get("userId")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session")
    try:
        return await reports_service.submit_appeal(user_id, report_id, body.appealText)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
