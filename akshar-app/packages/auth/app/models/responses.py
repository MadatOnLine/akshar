"""Pydantic response models."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ChallengeResponse(BaseModel):
    attemptId: str
    challengeId: str
    action: str
    timeout: int


class EnrollResponse(BaseModel):
    ok: bool
    attemptId: str
    challenge: ChallengeResponse


class LivenessResponse(BaseModel):
    ok: bool
    passed: bool
    retriesRemaining: Optional[int] = None
    newChallenge: Optional[ChallengeResponse] = None
    userId: Optional[str] = None
    token: Optional[str] = None
    refreshToken: Optional[str] = None


class LoginResponse(BaseModel):
    ok: bool
    token: str
    refreshToken: str
    userId: str
    expiresAt: str
    name: Optional[str] = None
    distance: Optional[int] = None


class SessionValidateResponse(BaseModel):
    valid: bool
    userId: Optional[str] = None
    tier: Optional[str] = None


class ProfileResponse(BaseModel):
    userId: str
    name: str
    tier: str
    trustScore: int
    createdAt: str
    status: str


class ErrorResponse(BaseModel):
    ok: bool = False
    error: str


class HealthResponse(BaseModel):
    ok: bool = True
    service: str = "akshar-auth"
    version: str = "1.0.0"
