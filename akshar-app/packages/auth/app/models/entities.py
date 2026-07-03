"""Domain entity models for akshar-auth."""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class UserStatus(str, Enum):
    active = "active"
    suspended = "suspended"
    banned = "banned"


class UserTier(str, Enum):
    larva = "larva"
    drone = "drone"
    colony = "colony"


class User(BaseModel):
    userId: str
    name: str
    faceHash: str
    deviceId: str
    createdAt: str
    updatedAt: str
    status: UserStatus = UserStatus.active
    tier: UserTier = UserTier.larva
    type: str = "user"


class ChallengeAction(str, Enum):
    blink = "blink"
    turn_left = "turn_left"
    turn_right = "turn_right"
    smile = "smile"


class ChallengeStatus(str, Enum):
    pending = "pending"
    passed = "passed"
    failed = "failed"
    expired = "expired"


class LivenessChallenge(BaseModel):
    challengeId: str
    action: ChallengeAction
    issuedAt: float
    timeout: int
    status: ChallengeStatus = ChallengeStatus.pending


class EnrollmentStatus(str, Enum):
    awaiting_capture = "awaiting_capture"
    awaiting_liveness = "awaiting_liveness"
    complete = "complete"
    failed = "failed"


class EnrollmentAttempt(BaseModel):
    attemptId: str
    name: str
    deviceId: str
    challenge: Optional[LivenessChallenge] = None
    retriesRemaining: int
    status: EnrollmentStatus = EnrollmentStatus.awaiting_liveness
    createdAt: float
    expiresAt: float
    type: str = "enrollment"


class Session(BaseModel):
    sessionId: str
    userId: str
    issuedAt: str
    expiresAt: str
    refreshToken: str
    refreshExpiresAt: str
    invalidated: bool = False
    deviceId: str
    type: str = "session"
