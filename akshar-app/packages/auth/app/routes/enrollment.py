"""Enrollment endpoints — face capture + liveness + account creation."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.requests import EnrollRequest, DirectEnrollRequest, LivenessRequest
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["enrollment"])


@router.post("/enroll")
async def enroll(body: EnrollRequest):
    """Initiate face enrollment with server-side liveness challenge (legacy two-step)."""
    try:
        result = await auth_service.initiate_enrollment(body.name, body.deviceId)
        return {"ok": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/enroll-direct")
async def enroll_direct(body: DirectEnrollRequest):
    """Direct face enrollment — client-side hybrid liveness already verified.

    Matches the research Proof-of-Human flow: client performs passive + active
    liveness locally, captures the face hash, then sends it in one call.
    """
    try:
        result = await auth_service.direct_enrollment(
            body.name, body.deviceId, body.faceHash
        )
        return {"ok": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/liveness")
async def validate_liveness(body: LivenessRequest):
    """Submit liveness challenge result and face hash. Completes enrollment on success."""
    try:
        result = await auth_service.validate_liveness_and_complete(
            body.attemptId, body.challengeId, body.faceHash
        )
        return {"ok": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
