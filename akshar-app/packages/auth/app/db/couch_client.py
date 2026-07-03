"""Async CouchDB HTTP client wrapper."""
from __future__ import annotations

from typing import Any

import httpx

from app.config import COUCHDB_URL, COUCHDB_USER, COUCHDB_PASSWORD, COUCHDB_DATABASE


class CouchClient:
    """Thin async wrapper around CouchDB's REST API."""

    def __init__(self) -> None:
        self._base = f"{COUCHDB_URL}/{COUCHDB_DATABASE}"
        self._auth = (COUCHDB_USER, COUCHDB_PASSWORD)
        self._client: httpx.AsyncClient | None = None

    async def connect(self) -> None:
        self._client = httpx.AsyncClient(auth=self._auth, timeout=10.0)
        # Ensure database exists
        resp = await self._client.put(self._base)
        if resp.status_code not in (201, 412):  # 412 = already exists
            resp.raise_for_status()

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    @property
    def client(self) -> httpx.AsyncClient:
        if not self._client:
            raise RuntimeError("CouchClient not connected. Call connect() first.")
        return self._client

    async def get(self, doc_id: str) -> dict[str, Any] | None:
        """Get a document by ID. Returns None if not found."""
        resp = await self.client.get(f"{self._base}/{doc_id}")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()

    async def put(self, doc_id: str, doc: dict[str, Any]) -> dict[str, Any]:
        """Create or update a document."""
        resp = await self.client.put(
            f"{self._base}/{doc_id}",
            json=doc,
        )
        resp.raise_for_status()
        return resp.json()

    async def delete(self, doc_id: str, rev: str) -> dict[str, Any]:
        """Delete a document by ID and revision."""
        resp = await self.client.delete(f"{self._base}/{doc_id}?rev={rev}")
        resp.raise_for_status()
        return resp.json()

    async def find(self, selector: dict[str, Any], limit: int = 100) -> list[dict[str, Any]]:
        """Query documents using Mango selector."""
        body = {"selector": selector, "limit": limit}
        resp = await self.client.post(f"{self._base}/_find", json=body)
        resp.raise_for_status()
        return resp.json().get("docs", [])

    async def view(self, design: str, view_name: str, **params: Any) -> list[dict[str, Any]]:
        """Query a CouchDB view."""
        url = f"{self._base}/_design/{design}/_view/{view_name}"
        resp = await self.client.get(url, params=params)
        resp.raise_for_status()
        return resp.json().get("rows", [])


# Global singleton
db = CouchClient()
