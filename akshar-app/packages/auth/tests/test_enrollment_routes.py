"""HTTP route tests for hybrid enrollment flow."""
from __future__ import annotations

import time
from unittest.mock import AsyncMock, patch

import pytest

from app.services import auth_service


@pytest.fixture(autouse=True)
def clear_enrollments():
    auth_service._enrollments.clear()
    yield
    auth_service._enrollments.clear()


@pytest.fixture(autouse=True)
def skip_liveness_min_delay():
    with patch("app.services.liveness_service.LIVENESS_MIN_ELAPSED", 0.0):
        yield


@pytest.fixture
def mock_db(client):
    with patch("app.services.auth_service.db") as mock, patch("app.db.couch_client.db", mock):
        mock.get = AsyncMock(return_value=None)
        mock.put = AsyncMock(return_value={"ok": True, "id": "test", "rev": "1-x"})
        mock.find = AsyncMock(return_value=[])
        mock.connect = AsyncMock()
        mock.close = AsyncMock()
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


def test_enroll_direct_requires_server_challenge_ids(client):
    resp = client.post(
        "/auth/enroll-direct",
        json={"name": "Alice", "deviceId": "device-1", "faceHash": "abcdef0123456789"},
    )
    assert resp.status_code == 422


def test_hybrid_enrollment_flow(client, mock_db, mock_session):
    with patch("app.services.trust_store.create_initial_trust", new_callable=AsyncMock):
        start = client.post("/auth/enroll", json={"name": "Alice", "deviceId": "device-flow"})
        assert start.status_code == 200
        start_data = start.json()
        assert start_data["ok"] is True

        attempt_id = start_data["attemptId"]
        challenge_id = start_data["challenge"]["challengeId"]
        auth_service._enrollments[attempt_id].challenge.issuedAt = time.time() - 5

        finish = client.post(
            "/auth/enroll-direct",
            json={
                "name": "Alice",
                "deviceId": "device-flow",
                "faceHash": "abcdef0123456789",
                "attemptId": attempt_id,
                "challengeId": challenge_id,
            },
        )
        assert finish.status_code == 200
        finish_data = finish.json()
        assert finish_data["ok"] is True
        assert finish_data["token"] == "jwt-token"
        assert finish_data["userId"]
