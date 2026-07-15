"""Tests for Tier 2 person-binding checks and routes."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import SERVICE_API_KEY, TIER0_BASE_TRUST, TIER2_REAUTH_INTERVAL_SEC
from app.main import app
from app.services.tier2_checks import (
    combined_tier2_humanness,
    face_match_score,
    run_tier2_checks,
)
from app.services.trust_engine import evidence_for_trust, trust_from_evidence


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_db():
    with patch("app.routes.tier2.db") as mock, patch("app.db.couch_client.db", mock):
        mock.get = AsyncMock(return_value=None)
        mock.put = AsyncMock(return_value={"ok": True})
        mock.connect = AsyncMock()
        mock.close = AsyncMock()
        yield mock


def test_face_match_score_prefers_low_distance():
    assert face_match_score(0) == 1.0
    assert face_match_score(25) == 0.0


def test_combined_tier2_humanness_penalizes_device_failure():
    checks = run_tier2_checks(
        {
            "tier2": {
                "reauthIntervalSec": TIER2_REAUTH_INTERVAL_SEC,
                "lastReauth": datetime.now(timezone.utc).isoformat(),
                "reauthDue": (datetime.now(timezone.utc) + timedelta(seconds=60)).isoformat(),
                "lastFaceMatchDistance": 2,
                "deviceBindingOk": False,
                "lastLivenessPassed": True,
                "reauthFailures": 0,
            }
        },
        face_distance=2,
        device_ok=False,
        liveness_passed=True,
    )
    assert combined_tier2_humanness(checks) <= 0.15


def test_get_tier2_status(client, mock_db):
    now = datetime.now(timezone.utc)
    tier0_evidence = evidence_for_trust(TIER0_BASE_TRUST)
    mock_db.get = AsyncMock(return_value={
        "userId": "user-1",
        "evidence": tier0_evidence,
        "history": [TIER0_BASE_TRUST],
        "type": "trust",
        "tier2": {
            "reauthIntervalSec": TIER2_REAUTH_INTERVAL_SEC,
            "lastReauth": now.isoformat(),
            "reauthDue": (now + timedelta(seconds=60)).isoformat(),
            "lastFaceMatchDistance": 3,
            "deviceBindingOk": True,
            "lastLivenessPassed": True,
            "reauthFailures": 0,
        },
    })

    resp = client.get("/ai/tier2/user-1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert len(data["tier2"]["checks"]) == 4
    assert data["trust"] == TIER0_BASE_TRUST


def test_process_tier2_requires_service_key(client, mock_db):
    resp = client.post("/ai/tier2/process/user-1", json={"mode": "overdue"})
    assert resp.status_code == 403


def test_process_tier2_overdue_decays_trust(client, mock_db):
    tier0_evidence = evidence_for_trust(TIER0_BASE_TRUST)
    mock_db.get = AsyncMock(return_value={
        "userId": "user-1",
        "evidence": tier0_evidence,
        "history": [TIER0_BASE_TRUST],
        "type": "trust",
        "tier2": {
            "reauthIntervalSec": TIER2_REAUTH_INTERVAL_SEC,
            "lastReauth": datetime.now(timezone.utc).isoformat(),
            "reauthDue": (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat(),
            "lastFaceMatchDistance": 3,
            "deviceBindingOk": True,
            "lastLivenessPassed": True,
            "reauthFailures": 0,
        },
    })

    resp = client.post(
        "/ai/tier2/process/user-1",
        headers={"X-Service-Key": SERVICE_API_KEY},
        json={"mode": "overdue"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["trustAfter"] < data["trustBefore"]
    mock_db.put.assert_awaited()
