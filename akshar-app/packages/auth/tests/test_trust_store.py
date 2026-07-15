"""Tests for Tier-0 trust seeding helpers."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.config import TIER0_BASE_TRUST, tier0_evidence
from app.services.trust_store import build_initial_trust_doc, create_initial_trust


def test_build_initial_trust_doc():
    doc = build_initial_trust_doc("user-abc", "2026-07-05T00:00:00+00:00")
    assert doc["userId"] == "user-abc"
    assert doc["type"] == "trust"
    assert doc["history"] == [TIER0_BASE_TRUST]
    assert doc["evidence"] == pytest.approx(tier0_evidence(), rel=1e-6)
    assert "tier2" in doc
    assert "tier2b" in doc
    assert doc["tier2b"].get("riskHold") is False


@pytest.mark.asyncio
async def test_create_initial_trust_writes_both_databases():
    mock_response = httpx.Response(201, request=httpx.Request("PUT", "http://test"))
    mock_client = AsyncMock()
    mock_client.put = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.services.trust_store.db.put", new_callable=AsyncMock) as mock_db_put, patch(
        "app.services.trust_store.httpx.AsyncClient", return_value=mock_client
    ):
        await create_initial_trust("user-abc", "2026-07-05T00:00:00+00:00")

    mock_db_put.assert_awaited_once()
    assert mock_client.put.await_count == 2
