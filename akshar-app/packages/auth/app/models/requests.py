"""Pydantic request validation models."""
from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator


class EnrollRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    deviceId: str = Field(..., min_length=1, max_length=256)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9 \-]+$", v):
            raise ValueError("Name may only contain letters, numbers, spaces, and hyphens")
        return v.strip()


class LivenessRequest(BaseModel):
    attemptId: str = Field(..., min_length=1)
    challengeId: str = Field(..., min_length=1)
    faceHash: str = Field(..., min_length=16, max_length=16)

    @field_validator("faceHash")
    @classmethod
    def validate_face_hash(cls, v: str) -> str:
        if not re.match(r"^[0-9a-f]{16}$", v.lower()):
            raise ValueError("faceHash must be exactly 16 lowercase hex characters")
        return v.lower()


class FaceLoginRequest(BaseModel):
    faceHash: str = Field(..., min_length=16, max_length=16)
    deviceId: str = Field(..., min_length=1, max_length=256)

    @field_validator("faceHash")
    @classmethod
    def validate_face_hash(cls, v: str) -> str:
        if not re.match(r"^[0-9a-f]{16}$", v.lower()):
            raise ValueError("faceHash must be exactly 16 lowercase hex characters")
        return v.lower()


class BiometricLoginRequest(BaseModel):
    deviceId: str = Field(..., min_length=1, max_length=256)
    biometricToken: str = Field(..., min_length=1, max_length=2048)


class RefreshRequest(BaseModel):
    refreshToken: str = Field(..., min_length=1)


class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None and not re.match(r"^[a-zA-Z0-9 \-]+$", v):
            raise ValueError("Name may only contain letters, numbers, spaces, and hyphens")
        return v.strip() if v else v
