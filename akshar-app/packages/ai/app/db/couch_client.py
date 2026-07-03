"""Async CouchDB HTTP client wrapper for akshar-ai."""
from __future__ import annotations

from typing import Any

import httpx

from app.config import COUCHDB_URL, COUCHDB_USER, COUCHDB_PASSWORD, COUCHDB_TRUST_DB


class CouchClient:
    """Thin async wrapper around CouchDB's REST API."""

    def __init__(self) -> None:
        self._base = f"{COUCHDB_URL}/{COUCHDB_TRUST_DB}"
        self._auth = (COUCHDB_USER, COUCHDB_PASSWORD)
        self._client: httpx.AsyncClient | None = None

    async def connect(self) -> None:
        self._client = httpx.AsyncClient(auth=self._auth, timeout=10.0)
        resp = await self._client.put(self._base)
        if resp.status_code not in (201, 412):
            resp.raise_for_status()

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    @property
    def client(self) -> httpx.AsyncClient:
        if not self._client:
            raise RuntimeError("CouchClient not connected")
        return self._client

    async def get(self, doc_id: str) -> dict[str, Any] | None:
        resp = await self.client.get(f"{self._base}/{doc_id}")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()

    async def put(self, doc_id: str, doc: dict[str, Any]) -> dict[str, Any]:
        resp = await self.client.put(f"{self._base}/{doc_id}", json=doc)
        resp.raise_for_status()
        return resp.json()

    async def find(self, selector: dict[str, Any], limit: int = 100) -> list[dict[str, Any]]:
        body = {"selector": selector, "limit": limit}
        resp = await self.client.post(f"{self._base}/_find", json=body)
        resp.raise_for_status()
        return resp.json().get("docs", [])


db = CouchClient()
