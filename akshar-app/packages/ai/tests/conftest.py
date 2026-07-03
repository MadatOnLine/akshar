"""Shared test fixtures for akshar-ai."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture
def mock_db():
    """Mock CouchDB client."""
    with patch("app.db.couch_client.db") as mock:
        mock.get = AsyncMock(return_value=None)
        mock.put = AsyncMock(return_value={"ok": True})
        mock.find = AsyncMock(return_value=[])
        mock.connect = AsyncMock()
        mock.close = AsyncMock()
        yield mock
