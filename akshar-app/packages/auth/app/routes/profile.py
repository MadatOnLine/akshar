"""Profile endpoints — get and update user profile."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Header

from app.db.couch_client import db
from app.models.requests import ProfileUpdateRequest
from app.services.session_service import validate_session

router = APIRouter(prefix="/auth", tags=["profile"])


async def _require_auth(authorization: str | None) -> dict:
    """Verify token and return session info. Raises 401 on failure."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:]
    result = await validate_session(token)
    if not result or not result.get("valid"):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return result


@router.get("/profile/{user_id}")
async def get_profile(user_id: str, authorization: str | None = Header(None)):
    """Get user profile (public info + trust tier)."""
    await _require_auth(authorization)

    user_doc = await db.get(f"user:{user_id}")
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    trust_doc = await db.get(f"trust:{user_id}")
    trust_score = 0
    if trust_doc:
        history = trust_doc.get("history", [])
        trust_score = history[-1] if history else 0

    return {
        "userId": user_doc["userId"],
        "name": user_doc["name"],
        "tier": user_doc["tier"],
        "trustScore": trust_score,
        "createdAt": user_doc["createdAt"],
        "status": user_doc["status"],
    }


@router.patch("/profile/{user_id}")
async def update_profile(
    user_id: str,
    body: ProfileUpdateRequest,
    authorization: str | None = Header(None),
):
    """Update user profile. Only the user themselves can update."""
    session_info = await _require_auth(authorization)

    # IDOR protection: user can only update their own profile
    if session_info.get("userId") != user_id:
        raise HTTPException(status_code=403, detail="Cannot update another user's profile")

    user_doc = await db.get(f"user:{user_id}")
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    if body.name is not None:
        user_doc["name"] = body.name

    from datetime import datetime, timezone
    user_doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await db.put(f"user:{user_id}", user_doc)

    return {"ok": True, "name": user_doc["name"]}
