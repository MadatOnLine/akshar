"""Lightweight multi-database CouchDB queries for integrity aggregation."""
from __future__ import annotations

from typing import Any

import httpx

from app.config import COUCHDB_PASSWORD, COUCHDB_URL, COUCHDB_USER

_AUTH = (COUCHDB_USER, COUCHDB_PASSWORD)


async def ensure_db(client: httpx.AsyncClient, database: str) -> None:
    resp = await client.put(f"{COUCHDB_URL}/{database}")
    if resp.status_code not in (201, 412):
        resp.raise_for_status()


async def find_docs(database: str, selector: dict[str, Any], *, limit: int = 500) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(auth=_AUTH, timeout=15.0) as client:
        await ensure_db(client, database)
        resp = await client.post(
            f"{COUCHDB_URL}/{database}/_find",
            json={"selector": selector, "limit": limit},
        )
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        return resp.json().get("docs", [])


async def count_docs(database: str, selector: dict[str, Any], *, limit: int = 500) -> int:
    return len(await find_docs(database, selector, limit=limit))
