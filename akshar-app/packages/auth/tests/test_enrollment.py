"""Tests for enrollment flow."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services import auth_service


@pytest.fixture(autouse=True)
def clear_enrollments():
    """Clear in-memory enrollment store between tests."""
    auth_service._enrollments.clear()
    yield
    auth_service._enrollments.clear()


@pytest.fixture
def mock_db():
    with patch("app.services.auth_service.db") as mock:
        mock.get = AsyncMock(return_value=None)
        mock.put = AsyncMock(return_value={"ok": True, "id": "test", "rev": "1-x"})
        mock.find = AsyncMock(return_value=[])
        yield mock


@pytest.fixture
def mock_session():
    with patch("app.services.auth_service.session_service") as mock:
        mock.issue_session = AsyncMock(return_value={
            "token": "jwt-token",
            "refreshToken": "refresh-token",
            "expiresAt": "2026-07-02T00:00:00+00:00",
            "userId": "new-user",
            "sessionId": "sess-1",
        })
        yield mock


@pytest.mark.asyncio
async def test_initiate_enrollment_success(mock_db):
    result = await auth_service.initiate_enrollment("Alice", "device-1")
    assert "attemptId" in result
    assert "challenge" in result
    assert result["challenge"]["action"] in ("blink", "turn_left", "turn_right", "smile")
    assert result["challenge"]["timeout"] == 15


@pytest.mark.asyncio
async def test_initiate_enrollment_duplicate_device(mock_db):
    mock_db.find = AsyncMock(return_value=[{"userId": "existing", "deviceId": "device-1"}])
    with pytest.raises(ValueError, match="already has an enrolled account"):
        await auth_service.initiate_enrollment("Bob", "device-1")


@pytest.mark.asyncio
async def test_validate_liveness_success(mock_db, mock_session):
    with patch("app.services.trust_store.create_initial_trust", new_callable=AsyncMock):
        # First initiate
        result = await auth_service.initiate_enrollment("Charlie", "device-2")
        attempt_id = result["attemptId"]
        challenge_id = result["challenge"]["challengeId"]

        # Then validate liveness
        liveness_result = await auth_service.validate_liveness_and_complete(
            attempt_id, challenge_id, "abcdef0123456789"
        )
    assert liveness_result["passed"] is True
    assert "userId" in liveness_result
    assert "token" in liveness_result


@pytest.mark.asyncio
async def test_validate_liveness_wrong_challenge_id(mock_db):
    result = await auth_service.initiate_enrollment("Dave", "device-3")
    attempt_id = result["attemptId"]

    with pytest.raises(ValueError, match="Invalid challenge ID"):
        await auth_service.validate_liveness_and_complete(
            attempt_id, "wrong-id", "abcdef0123456789"
        )


@pytest.mark.asyncio
async def test_validate_liveness_expired_attempt(mock_db):
    result = await auth_service.initiate_enrollment("Eve", "device-4")
    attempt_id = result["attemptId"]
    challenge_id = result["challenge"]["challengeId"]

    # Force expiry
    auth_service._enrollments[attempt_id].expiresAt = 0

    with pytest.raises(ValueError, match="expired"):
        await auth_service.validate_liveness_and_complete(
            attempt_id, challenge_id, "abcdef0123456789"
        )


@pytest.mark.asyncio
async def test_validate_liveness_duplicate_face(mock_db, mock_session):
    # First, initiate with no existing user for device (device check passes)
    mock_db.find = AsyncMock(return_value=[])
    result = await auth_service.initiate_enrollment("Frank", "device-5")
    attempt_id = result["attemptId"]
    challenge_id = result["challenge"]["challengeId"]

    # Now mock: find returns existing user with same face hash (for uniqueness check)
    mock_db.find = AsyncMock(return_value=[
        {"faceHash": "abcdef0123456789", "userId": "existing", "type": "user", "status": "active"}
    ])

    # Use the exact same hash — should fail
    with pytest.raises(ValueError, match="Face already enrolled"):
        await auth_service.validate_liveness_and_complete(
            attempt_id, challenge_id, "abcdef0123456789"
        )


@pytest.mark.asyncio
async def test_validate_liveness_not_found():
    with pytest.raises(ValueError, match="not found"):
        await auth_service.validate_liveness_and_complete(
            "nonexistent", "challenge", "abcdef0123456789"
        )


@pytest.mark.asyncio
async def test_direct_enrollment_success(mock_db, mock_session):
    with patch("app.services.trust_store.create_initial_trust", new_callable=AsyncMock) as mock_trust:
        result = await auth_service.direct_enrollment("Alice", "device-direct", "abcdef0123456789")

    assert result["userId"]
    assert result["token"] == "jwt-token"
    mock_trust.assert_awaited_once()
    mock_db.put.assert_awaited()


@pytest.mark.asyncio
async def test_direct_enrollment_duplicate_device(mock_db):
    mock_db.find = AsyncMock(return_value=[{"userId": "existing", "deviceId": "device-dup"}])
    with pytest.raises(ValueError, match="already has an enrolled account"):
        await auth_service.direct_enrollment("Bob", "device-dup", "abcdef0123456789")


@pytest.mark.asyncio
async def test_direct_enrollment_duplicate_face(mock_db, mock_session):
    mock_db.find = AsyncMock(side_effect=[
        [],  # device check
        [{"faceHash": "abcdef0123456789", "userId": "existing", "type": "user", "status": "active"}],
    ])
    with pytest.raises(ValueError, match="Face already enrolled"):
        await auth_service.direct_enrollment("Carol", "device-new", "abcdef0123456789")
