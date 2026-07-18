"""Tier-0 trust seeding — writes initial trust state to auth and AI CouchDB databases."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

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


def _default_tier2_integrity(now_iso: str) -> dict[str, Any]:
    return {
        "validReports": 0,
        "dismissedReports": 0,
        "lastAnalysis": now_iso,
        "status": "establishing",
        "demo": {},
    }


def _default_tier2b(now: datetime) -> dict[str, Any]:
    return {
        "lastFaceMatchDistance": 0,
        "lastLivenessPassed": True,
        "reauthFailures": 0,
        "riskHold": False,
        "status": "fresh",
    }


def _default_tier3() -> dict[str, Any]:
    return {
        "status": "progressing",
        "progress": 0.0,
    }


def build_initial_trust_doc(user_id: str, now_iso: str) -> dict:
    """Build the Tier-0 trust document seeded after face enrollment."""
    now = datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
    return {
        "userId": user_id,
        "evidence": tier0_evidence(),
        "history": [TIER0_BASE_TRUST],
        "lastAnalysis": now_iso,
        "type": "trust",
        "tier2": _default_tier2_integrity(now_iso),
        "tier2b": _default_tier2b(now),
        "tier3": _default_tier3(),
    }


async def _ensure_database(client: httpx.AsyncClient, database: str) -> None:
    resp = await client.put(f"{COUCHDB_URL}/{database}")
    if resp.status_code not in (201, 412):
        resp.raise_for_status()


async def _sync_trust_doc(doc_id: str, doc: dict[str, Any]) -> None:
    """Mirror trust doc to the AI trust database (separate CouchDB rev)."""
    auth = (COUCHDB_USER, COUCHDB_PASSWORD)
    payload = {k: v for k, v in doc.items() if k not in ("_id", "_rev")}
    async with httpx.AsyncClient(auth=auth, timeout=10.0) as client:
        await _ensure_database(client, COUCHDB_TRUST_DB)
        existing = await client.get(f"{COUCHDB_URL}/{COUCHDB_TRUST_DB}/{doc_id}")
        if existing.status_code == 200:
            payload["_rev"] = existing.json().get("_rev")
        resp = await client.put(f"{COUCHDB_URL}/{COUCHDB_TRUST_DB}/{doc_id}", json=payload)
        resp.raise_for_status()


async def create_initial_trust(user_id: str, now_iso: str) -> None:
    """Persist Tier-0 trust seed to auth DB and the AI trust DB."""
    doc_id = f"trust:{user_id}"
    doc = build_initial_trust_doc(user_id, now_iso)

    await db.put(doc_id, doc)
    await _sync_trust_doc(doc_id, doc)


async def get_trust_doc(user_id: str) -> dict[str, Any] | None:
    return await db.get(f"trust:{user_id}")


async def save_trust_doc(user_id: str, doc: dict[str, Any]) -> None:
    doc_id = f"trust:{user_id}"
    result = await db.put(doc_id, doc)
    if result.get("rev"):
        doc["_rev"] = result["rev"]
    await _sync_trust_doc(doc_id, doc)


def _is_binding_block(block: dict[str, Any]) -> bool:
    return "reauthDue" in block or "lastReauth" in block


def _strip_timer_fields(block: dict[str, Any]) -> dict[str, Any]:
    """Remove legacy periodic re-auth timer fields (risk-based Tier 2b only)."""
    return {k: v for k, v in block.items() if k not in ("reauthDue", "reauthIntervalSec", "lastReauth")}


async def ensure_trust_tiers(user_id: str) -> dict[str, Any]:
    """Ensure Tier 2 (integrity) + Tier 2b (person-binding) + Tier 3 blocks exist; migrate legacy docs."""
    doc = await get_trust_doc(user_id)
    if not doc:
        raise ValueError("Trust state not found")

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    changed = False

    tier2 = doc.get("tier2")
    tier2b = doc.get("tier2b")

    if tier2 and _is_binding_block(tier2) and not tier2b:
        doc["tier2b"] = tier2
        doc["tier2"] = _default_tier2_integrity(now_iso)
        changed = True
        tier2b = doc["tier2b"]
        tier2 = doc["tier2"]

    if not tier2b:
        doc["tier2b"] = _default_tier2b(now)
        changed = True

    if not tier2 or _is_binding_block(tier2):
        doc["tier2"] = _default_tier2_integrity(now_iso)
        changed = True

    if tier2b:
        cleaned = _strip_timer_fields(tier2b)
        if cleaned != tier2b:
            doc["tier2b"] = cleaned
            changed = True
            tier2b = doc["tier2b"]

    if not doc.get("tier3"):
        doc["tier3"] = _default_tier3()
        changed = True

    if changed:
        await save_trust_doc(user_id, doc)

    doc = await get_trust_doc(user_id) or doc
    from app.services import risk_service

    await risk_service.evaluate_risk_for_user(user_id, doc)
    return doc


# Backward-compatible alias
async def ensure_tier2_block(user_id: str) -> dict[str, Any]:
    return await ensure_trust_tiers(user_id)
