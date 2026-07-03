"""Tests for session service — JWT creation, validation, refresh, logout."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import jwt
import pytest

from app.config import JWT_SECRET, JWT_ALGORITHM
from app.services import session_service


@pytest.fixture
def mock_db():
    with patch("app.services.session_service.db") as mock:
        mock.get = AsyncMock()
        mock.put = AsyncMock(return_value={"ok": True})
        mock.find = AsyncMock(return_value=[])
        yield mock


@pytest.mark.asyncio
async def test_issue_session_returns_valid_jwt(mock_db):
    result = await session_service.issue_session("user123", "device-abc")
    assert "token" in result
    assert "refreshToken" in result
    assert "expiresAt" in result
    assert result["userId"] == "user123"

    # Decode JWT
    payload = jwt.decode(result["token"], JWT_SECRET, algorithms=[JWT_ALGORITHM])
    assert payload["sub"] == "user123"
    assert "sid" in payload
    assert "exp" in payload


@pytest.mark.asyncio
async def test_validate_session_valid_token(mock_db):
    # Issue a session
    result = await session_service.issue_session("user456", "device-xyz")

    # Mock: session exists and not invalidated
    mock_db.get = AsyncMock(side_effect=lambda doc_id: {
        "sessionId": "test",
        "invalidated": False,
        "userId": "user456",
        "type": "session",
    } if doc_id.startswith("session:") else {
        "userId": "user456",
        "status": "active",
        "tier": "larva",
        "type": "user",
    })

    validated = await session_service.validate_session(result["token"])
    assert validated is not None
    assert validated["valid"] is True
    assert validated["userId"] == "user456"


@pytest.mark.asyncio
async def test_validate_session_invalid_token(mock_db):
    result = await session_service.validate_session("invalid.token.here")
    assert result is None


@pytest.mark.asyncio
async def test_validate_session_invalidated(mock_db):
    result = await session_service.issue_session("user789", "device-123")

    # Mock: session is invalidated
    mock_db.get = AsyncMock(return_value={
        "sessionId": "test",
        "invalidated": True,
        "type": "session",
    })

    validated = await session_service.validate_session(result["token"])
    assert validated is None


@pytest.mark.asyncio
async def test_logout_invalidates_session(mock_db):
    result = await session_service.issue_session("user000", "dev-0")

    # Mock: session exists
    session_doc = {
        "_id": "session:test",
        "sessionId": "test",
        "invalidated": False,
        "type": "session",
    }
    mock_db.get = AsyncMock(return_value=session_doc)

    success = await session_service.logout(result["token"])
    assert success is True
    # Verify put was called with invalidated=True
    put_call = mock_db.put.call_args
    assert put_call[0][1]["invalidated"] is True


@pytest.mark.asyncio
async def test_refresh_session(mock_db):
    result = await session_service.issue_session("userR", "dev-R")
    refresh_token = result["refreshToken"]

    # Mock: find returns the session doc
    session_doc = {
        "_id": "session:old",
        "sessionId": "old",
        "userId": "userR",
        "deviceId": "dev-R",
        "refreshToken": refresh_token,
        "refreshExpiresAt": "2027-01-01T00:00:00+00:00",
        "invalidated": False,
        "type": "session",
    }
    mock_db.find = AsyncMock(return_value=[session_doc])

    new_result = await session_service.refresh_session(refresh_token)
    assert new_result is not None
    assert new_result["userId"] == "userR"
    assert new_result["token"] != result["token"]


@pytest.mark.asyncio
async def test_refresh_expired_token(mock_db):
    mock_db.find = AsyncMock(return_value=[{
        "_id": "session:old",
        "refreshToken": "expired",
        "refreshExpiresAt": "2020-01-01T00:00:00+00:00",
        "invalidated": False,
        "type": "session",
    }])

    result = await session_service.refresh_session("expired")
    assert result is None
