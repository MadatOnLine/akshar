"""Tests for login flows — face login + biometric login."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services import auth_service
from app.services.rate_limiter import RateLimiter


@pytest.fixture(autouse=True)
def fresh_rate_limiter():
    """Use a fresh rate limiter for each test."""
    with patch("app.services.auth_service.rate_limiter", RateLimiter()):
        yield


@pytest.fixture
def mock_db():
    with patch("app.services.auth_service.db") as mock:
        mock.get = AsyncMock(return_value=None)
        mock.put = AsyncMock(return_value={"ok": True})
        mock.find = AsyncMock(return_value=[])
        yield mock


@pytest.fixture
def mock_session():
    with patch("app.services.auth_service.session_service") as mock:
        mock.issue_session = AsyncMock(return_value={
            "token": "jwt-face",
            "refreshToken": "refresh-face",
            "expiresAt": "2026-07-02T00:00:00+00:00",
            "userId": "user-face",
            "sessionId": "sess-face",
        })
        yield mock


@pytest.mark.asyncio
async def test_face_login_success(mock_db, mock_session):
    mock_db.find = AsyncMock(return_value=[{
        "userId": "user-abc",
        "faceHash": "abcdef0123456789",
        "name": "TestUser",
        "status": "active",
        "deviceId": "device-1",
        "type": "user",
    }])

    result = await auth_service.face_login("abcdef0123456789", "device-1", "127.0.0.1")
    assert result["name"] == "TestUser"
    assert result["distance"] == 0


@pytest.mark.asyncio
async def test_face_login_not_recognised(mock_db):
    mock_db.find = AsyncMock(return_value=[{
        "userId": "user-abc",
        "faceHash": "ffffffffffffffff",
        "status": "active",
        "deviceId": "device-1",
        "type": "user",
    }])

    with pytest.raises(ValueError, match="Face not recognised"):
        await auth_service.face_login("0000000000000000", "device-1", "127.0.0.1")


@pytest.mark.asyncio
async def test_face_login_banned_user(mock_db):
    mock_db.find = AsyncMock(return_value=[{
        "userId": "banned-user",
        "faceHash": "abcdef0123456789",
        "status": "banned",
        "deviceId": "device-1",
        "type": "user",
    }])

    with pytest.raises(PermissionError, match="suspended"):
        await auth_service.face_login("abcdef0123456789", "device-1", "127.0.0.1")


@pytest.mark.asyncio
async def test_face_login_device_mismatch(mock_db):
    mock_db.find = AsyncMock(return_value=[{
        "userId": "user-abc",
        "faceHash": "abcdef0123456789",
        "status": "active",
        "deviceId": "device-1",
        "type": "user",
    }])

    with pytest.raises(ValueError, match="Device not recognized"):
        await auth_service.face_login("abcdef0123456789", "different-device", "127.0.0.1")


@pytest.mark.asyncio
async def test_face_login_rate_limited(mock_db):
    mock_db.find = AsyncMock(return_value=[])

    # Exhaust rate limit
    for _ in range(5):
        with pytest.raises(ValueError):
            await auth_service.face_login("0000000000000000", "dev", "127.0.0.1")

    # 6th attempt should be rate limited
    with pytest.raises(PermissionError, match="Too many attempts"):
        await auth_service.face_login("0000000000000000", "dev", "127.0.0.1")


@pytest.mark.asyncio
async def test_biometric_login_success(mock_db, mock_session):
    mock_db.find = AsyncMock(return_value=[{
        "userId": "bio-user",
        "deviceId": "bio-device",
        "status": "active",
        "type": "user",
    }])

    result = await auth_service.biometric_login("bio-device", "valid-token", "127.0.0.1")
    assert "token" in result


@pytest.mark.asyncio
async def test_biometric_login_unknown_device(mock_db):
    mock_db.find = AsyncMock(return_value=[])

    with pytest.raises(ValueError, match="Device not recognized"):
        await auth_service.biometric_login("unknown-device", "token", "127.0.0.1")


@pytest.mark.asyncio
async def test_biometric_login_empty_token(mock_db):
    mock_db.find = AsyncMock(return_value=[{
        "userId": "bio-user",
        "deviceId": "bio-device",
        "status": "active",
        "type": "user",
    }])

    with pytest.raises(ValueError, match="Invalid biometric token"):
        await auth_service.biometric_login("bio-device", "", "127.0.0.1")
