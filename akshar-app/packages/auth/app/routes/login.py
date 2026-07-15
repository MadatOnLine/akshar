"""Login endpoints — face match + biometric device login."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.models.requests import FaceLoginRequest, BiometricLoginRequest
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["login"])


@router.post("/login")
async def face_login(body: FaceLoginRequest, request: Request):
    """Authenticate via face hash comparison."""
    client_ip = request.client.host if request.client else "unknown"
    try:
        result = await auth_service.face_login(
            body.faceHash, body.deviceId, client_ip, liveness_passed=body.livenessPassed
        )
        return {"ok": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=429, detail=str(e))


@router.post("/biometric")
async def biometric_login(body: BiometricLoginRequest, request: Request):
    """Authenticate via device-native biometric token."""
    client_ip = request.client.host if request.client else "unknown"
    try:
        result = await auth_service.biometric_login(
            body.deviceId, body.biometricToken, client_ip
        )
        return {"ok": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=429, detail=str(e))
