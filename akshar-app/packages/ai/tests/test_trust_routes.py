"""HTTP route tests for trust score and Tier-1 analysis."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import SERVICE_API_KEY, TIER0_BASE_TRUST
from app.main import app
from app.services.trust_engine import evidence_for_trust, trust_from_evidence


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_db():
    with patch("app.routes.trust.db") as mock, patch("app.db.couch_client.db", mock):
        mock.get = AsyncMock(return_value=None)
        mock.put = AsyncMock(return_value={"ok": True})
        mock.connect = AsyncMock()
        mock.close = AsyncMock()
        yield mock


def test_get_trust_not_found(client, mock_db):
    resp = client.get("/ai/trust/missing-user")
    assert resp.status_code == 404


def test_get_trust_returns_tier0_score(client, mock_db):
    tier0_evidence = evidence_for_trust(TIER0_BASE_TRUST)
    mock_db.get = AsyncMock(return_value={
        "userId": "user-1",
        "evidence": tier0_evidence,
        "history": [TIER0_BASE_TRUST],
        "type": "trust",
    })

    resp = client.get("/ai/trust/user-1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["trust"] == trust_from_evidence(tier0_evidence)
    assert data["tier"] == "Provisional"


def test_analyze_profile_requires_service_key(client, mock_db):
    resp = client.post(
        "/ai/analyze-profile/user-1",
        json={"userData": {"messages": [], "posts": [], "sessions": [], "n_days": 7}},
    )
    assert resp.status_code == 403


def test_analyze_profile_runs_tier1_checks(client, mock_db):
    tier0_evidence = evidence_for_trust(TIER0_BASE_TRUST)
    mock_db.get = AsyncMock(return_value={
        "userId": "user-1",
        "evidence": tier0_evidence,
        "history": [TIER0_BASE_TRUST],
        "type": "trust",
    })

    user_data = {
        "messages": [
            {"ts": 1000000, "text": "hey whats up", "typing_ms": 800},
            {"ts": 1003600, "text": "maybe coffee later", "typing_ms": 1200},
        ],
        "posts": [1000000],
        "sessions": [{"duration_min": 20}, {"duration_min": 35}],
        "fr_sent": 3,
        "fr_accepted": 2,
        "n_days": 14,
    }

    resp = client.post(
        "/ai/analyze-profile/user-1",
        headers={"X-Service-Key": SERVICE_API_KEY},
        json={"userData": user_data},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert len(data["checks"]) == 8
    assert data["trustBefore"] == TIER0_BASE_TRUST
    assert data["trustAfter"] >= 0
    mock_db.put.assert_awaited()
