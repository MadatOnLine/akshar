"""Shared test fixtures — mock CouchDB, test client."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def mock_db():
    """Mock CouchDB client for unit tests."""
    with patch("app.db.couch_client.db") as mock:
        mock.get = AsyncMock(return_value=None)
        mock.put = AsyncMock(return_value={"ok": True, "id": "test", "rev": "1-abc"})
        mock.find = AsyncMock(return_value=[])
        mock.delete = AsyncMock(return_value={"ok": True})
        mock.connect = AsyncMock()
        mock.close = AsyncMock()
        yield mock
