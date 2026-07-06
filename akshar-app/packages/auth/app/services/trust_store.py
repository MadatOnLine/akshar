"""Tier-0 trust seeding — writes initial trust state to auth and AI CouchDB databases."""
from __future__ import annotations

import httpx

from app.config import (
    COUCHDB_PASSWORD,
    COUCHDB_TRUST_DB,
    COUCHDB_URL,
    COUCHDB_USER,
    TIER0_BASE_TRUST,
    tier0_evidence,
)
from app.db.couch_client import db


def build_initial_trust_doc(user_id: str, now_iso: str) -> dict:
    """Build the Tier-0 trust document seeded after face enrollment."""
    return {
        "userId": user_id,
        "evidence": tier0_evidence(),
        "history": [TIER0_BASE_TRUST],
        "lastAnalysis": now_iso,
        "type": "trust",
    }


async def _ensure_database(client: httpx.AsyncClient, database: str) -> None:
    resp = await client.put(f"{COUCHDB_URL}/{database}")
    if resp.status_code not in (201, 412):
        resp.raise_for_status()


async def create_initial_trust(user_id: str, now_iso: str) -> None:
    """Persist Tier-0 trust seed to auth DB and the AI trust DB."""
    doc_id = f"trust:{user_id}"
    doc = build_initial_trust_doc(user_id, now_iso)

    await db.put(doc_id, doc)

    auth = (COUCHDB_USER, COUCHDB_PASSWORD)
    async with httpx.AsyncClient(auth=auth, timeout=10.0) as client:
        await _ensure_database(client, COUCHDB_TRUST_DB)
        resp = await client.put(f"{COUCHDB_URL}/{COUCHDB_TRUST_DB}/{doc_id}", json=doc)
        resp.raise_for_status()
