"""Tier 3 — passive Colony graduation (final PoH). Server-side metrics only; clients get opaque status."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

from app.config import (
    TIER0_BASE_TRUST,
    TIER3_ACTIVITY_VOLUME_MIN,
    TIER3_AGE_DAYS_MIN,
    TIER3_INTEGRITY_MIN,
    TIER3_MAX_VALID_REPORTS,
    TIER3_TRUST_MIN,
)
from app.db.couch_client import db
from app.services import reports_service, risk_service, trust_store
from app.services.integrity_aggregator import collect_integrity_signals
from app.services.tier2_integrity_checks import (
    combined_integrity_humanness,
    run_tier2_integrity_checks,
)
from app.services.tier2_trust import evidence_for_trust, trust_from_evidence


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _activity_volume(signals: dict[str, Any]) -> float:
    return (
        int(signals.get("messageCount", 0))
        + int(signals.get("postCount", 0)) * 2
        + int(signals.get("sessionCount", 0)) * 0.5
        + int(signals.get("groupCount", 0)) * 3
    )


def _community_score(signals: dict[str, Any]) -> float:
    groups = int(signals.get("groupCount", 0))
    interactors = int(signals.get("uniqueInteractors", 0))
    return _clamp01(groups / 3.0) * 0.5 + _clamp01(interactors / 6.0) * 0.5


def colony_nullifier_for_user(user_doc: dict[str, Any] | None, user_id: str) -> str:
    """Stable uniqueness token — face hash when available, else user id. Never returned to clients."""
    face = (user_doc or {}).get("faceHash") or ""
    raw = f"{face}|{user_id}" if face else user_id
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def compute_progress(
    *,
    trust_score: int,
    age_days: float,
    integrity_humanness: float,
    activity_volume: float,
    community: float,
) -> float:
    """Internal progress 0..1 — never expose component breakdown to clients."""
    age_target = max(TIER3_AGE_DAYS_MIN, 14.0)
    activity_target = max(TIER3_ACTIVITY_VOLUME_MIN, 25.0)
    parts = [
        _clamp01(trust_score / float(max(TIER3_TRUST_MIN, 1))) * 0.35,
        _clamp01(age_days / age_target) * 0.15,
        _clamp01(integrity_humanness / max(TIER3_INTEGRITY_MIN, 0.01)) * 0.25,
        _clamp01(activity_volume / activity_target) * 0.15,
        community * 0.10,
    ]
    return round(_clamp01(sum(parts)), 4)


def evaluate_gates(
    *,
    trust_score: int,
    age_days: float,
    integrity_humanness: float,
    activity_volume: float,
    valid_reports: int,
    qualifying_reports: int,
    requires_risk: bool,
    nullifier_ok: bool,
) -> bool:
    if requires_risk:
        return False
    if not nullifier_ok:
        return False
    if trust_score < TIER3_TRUST_MIN:
        return False
    if age_days < TIER3_AGE_DAYS_MIN:
        return False
    if integrity_humanness < TIER3_INTEGRITY_MIN:
        return False
    if activity_volume < TIER3_ACTIVITY_VOLUME_MIN:
        return False
    if valid_reports > TIER3_MAX_VALID_REPORTS:
        return False
    if qualifying_reports > TIER3_MAX_VALID_REPORTS:
        return False
    return True


def public_tier3_view(tier3_block: dict[str, Any]) -> dict[str, Any]:
    """Opaque client payload — no thresholds, gate names, or metric values."""
    status = tier3_block.get("status") or "progressing"
    if status == "colony":
        return {
            "status": "colony",
            "label": "Fully verified",
            "message": "Final proof-of-human tier reached. Keep using Akshar normally.",
            "progressHint": "complete",
        }
    # Soft progress only: coarse buckets, not raw scores.
    progress = float(tier3_block.get("progress", 0) or 0)
    if progress >= 0.75:
        hint = "high"
        message = "Verification is nearly complete. Keep using Akshar normally."
    elif progress >= 0.4:
        hint = "medium"
        message = "Building verification from normal account activity."
    else:
        hint = "low"
        message = "Keep using Akshar normally — verification builds in the background."
    return {
        "status": "progressing",
        "label": "Building verification",
        "message": message,
        "progressHint": hint,
    }


async def _nullifier_available(user_id: str, nullifier: str) -> bool:
    """True if this nullifier is free or already owned by this user."""
    # Lightweight scan of trust docs is expensive; store reverse index when possible.
    existing = await db.get(f"colony_nullifier:{nullifier}")
    if not existing:
        return True
    return existing.get("userId") == user_id


async def _claim_nullifier(user_id: str, nullifier: str) -> None:
    doc_id = f"colony_nullifier:{nullifier}"
    existing = await db.get(doc_id)
    payload = {
        "type": "colony_nullifier",
        "userId": user_id,
        "nullifier": nullifier,
        "claimedAt": datetime.now(timezone.utc).isoformat(),
    }
    if existing and existing.get("_rev"):
        payload["_rev"] = existing["_rev"]
        if existing.get("userId") not in (None, user_id):
            raise ValueError("Colony identity already claimed")
    await db.put(doc_id, payload)


async def evaluate_and_persist(user_id: str, trust_doc: dict[str, Any] | None = None) -> dict[str, Any]:
    """Recompute Tier 3, persist internal state, return opaque public view."""
    if trust_doc is None:
        trust_doc = await trust_store.ensure_trust_tiers(user_id)

    signals = await collect_integrity_signals(user_id, trust_doc)
    checks = run_tier2_integrity_checks(signals)
    integrity_humanness = combined_integrity_humanness(checks)
    trust_score = trust_from_evidence(
        trust_doc.get("evidence", evidence_for_trust(TIER0_BASE_TRUST))
    )
    qualifying = await reports_service.count_qualifying_reports(user_id)
    requires_risk = risk_service.requires_risk_check(
        trust_doc, trust_score=trust_score, qualifying_reports=qualifying
    )

    user_doc = await db.get(f"user:{user_id}")
    nullifier = colony_nullifier_for_user(user_doc, user_id)
    nullifier_ok = await _nullifier_available(user_id, nullifier)

    age_days = float(signals.get("accountAgeDays", 0))
    activity_volume = _activity_volume(signals)
    community = _community_score(signals)
    valid_reports = int(signals.get("validReports", 0))

    progress = compute_progress(
        trust_score=trust_score,
        age_days=age_days,
        integrity_humanness=integrity_humanness,
        activity_volume=activity_volume,
        community=community,
    )

    tier3 = trust_doc.setdefault("tier3", {})
    already_colony = tier3.get("status") == "colony"

    unlocked = already_colony or evaluate_gates(
        trust_score=trust_score,
        age_days=age_days,
        integrity_humanness=integrity_humanness,
        activity_volume=activity_volume,
        valid_reports=valid_reports,
        qualifying_reports=qualifying,
        requires_risk=requires_risk,
        nullifier_ok=nullifier_ok,
    )

    now_iso = datetime.now(timezone.utc).isoformat()
    if unlocked:
        if not already_colony:
            await _claim_nullifier(user_id, nullifier)
            tier3["unlockedAt"] = now_iso
            tier3["nullifier"] = nullifier
        tier3["status"] = "colony"
        tier3["progress"] = 1.0
    else:
        # Demote only if previously colony and now blocked by risk/reports (rare).
        if already_colony and (requires_risk or valid_reports > TIER3_MAX_VALID_REPORTS):
            tier3["status"] = "progressing"
            tier3["revokedAt"] = now_iso
        elif not already_colony:
            tier3["status"] = "progressing"
        tier3["progress"] = progress

    tier3["lastEvaluatedAt"] = now_iso
    # Strip any accidental client-facing debug keys
    for key in ("gates", "metrics", "reasons", "checks"):
        tier3.pop(key, None)

    await trust_store.save_trust_doc(user_id, trust_doc)
    return public_tier3_view(tier3)


async def get_public_tier3(user_id: str) -> dict[str, Any]:
    trust_doc = await trust_store.ensure_trust_tiers(user_id)
    return await evaluate_and_persist(user_id, trust_doc)
