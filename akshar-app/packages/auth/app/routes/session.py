"""Session endpoints — validate, refresh, logout."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Header

from app.models.requests import RefreshRequest
from app.services import session_service

router = APIRouter(prefix="/auth", tags=["session"])


def _extract_token(authorization: str | None) -> str:
    """Extract Bearer token from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    return authorization[7:]


@router.get("/session/validate")
async def validate_session(authorization: str | None = Header(None)):
    """Validate a JWT session token. Used by other services for inter-service auth."""
    token = _extract_token(authorization)
    result = await session_service.validate_session(token)
    if not result:
        return {"valid": False}
    return result


@router.post("/refresh")
async def refresh(body: RefreshRequest):
    """Refresh an expired access token using a refresh token."""
    result = await session_service.refresh_session(body.refreshToken)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    return {"ok": True, **result}


@router.post("/logout")
async def logout(authorization: str | None = Header(None)):
    """Invalidate the current session."""
    token = _extract_token(authorization)
    success = await session_service.logout(token)
    if not success:
        raise HTTPException(status_code=401, detail="Invalid session")
    return {"ok": True}
