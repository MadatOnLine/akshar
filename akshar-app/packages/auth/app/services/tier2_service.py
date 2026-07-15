"""Tier 2 account integrity + Tier 2b risk-based person-binding."""
from __future__ import annotations

from datetime import datetime, timezone

from app.config import FACE_MATCH_THRESHOLD
from app.db.couch_client import db
from app.services import risk_service, trust_store
from app.services.tier2_trust import (
    apply_integrity_process,
    apply_tier2b_process,
    build_trust_status_response,
)


def _hamming_distance(a: str, b: str) -> int:
    try:
        va = int(a, 16)
        vb = int(b, 16)
        return bin(va ^ vb).count("1")
    except (ValueError, TypeError):
        return 64


async def get_risk_status(user_id: str) -> dict:
    trust_doc = await trust_store.ensure_trust_tiers(user_id)
    return await risk_service.evaluate_risk_for_user(user_id, trust_doc)


async def get_trust_status(user_id: str) -> dict:
    trust_doc = await trust_store.ensure_trust_tiers(user_id)
    return await build_trust_status_response(user_id, trust_doc)


async def refresh_integrity(user_id: str) -> dict:
    trust_doc = await trust_store.ensure_trust_tiers(user_id)
    result = await apply_integrity_process(user_id, trust_doc)
    trust_doc = await trust_store.get_trust_doc(user_id) or trust_doc
    risk_state = await risk_service.evaluate_risk_for_user(user_id, trust_doc)
    return {"ok": True, **result, **risk_state}


async def touch_tier2b_on_login(
    user_id: str,
    face_hash: str,
    device_id: str,
    face_distance: int,
    *,
    device_rebound: bool = False,
    liveness_passed: bool = False,
) -> dict:
    """Record login face metrics only — login never places accounts at risk."""
    del face_hash, device_id, device_rebound, liveness_passed

    face_ok = face_distance <= FACE_MATCH_THRESHOLD
    trust_doc = await trust_store.ensure_trust_tiers(user_id)
    tier2b = trust_doc.setdefault("tier2b", {})
    tier2b["lastFaceMatchDistance"] = face_distance
    if face_ok:
        tier2b["status"] = "fresh"

    await trust_store.save_trust_doc(user_id, trust_doc)
    result = await apply_tier2b_process(
        user_id,
        trust_doc,
        mode="login_refresh" if face_ok else "failed_reauth",
        face_distance=face_distance,
        liveness_passed=bool(tier2b.get("lastLivenessPassed", True)),
    )
    return {"ok": True, "tier2bRefreshed": face_ok, "requiresRiskCheck": False, **result}


async def reverify_identity(
    user_id: str,
    face_hash: str,
    device_id: str,
    *,
    liveness_passed: bool = True,
) -> dict:
    """Mandatory step-up when trust is low or qualifying reports require it."""
    user_doc = await db.get(f"user:{user_id}")
    if not user_doc:
        raise ValueError("User not found")
    if user_doc.get("status") == "banned":
        raise PermissionError("Account suspended")

    if user_doc.get("deviceId") != device_id:
        user_doc["deviceId"] = device_id
        user_doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
        await db.put(f"user:{user_id}", user_doc)

    enrolled_hash = user_doc.get("faceHash", "")
    distance = _hamming_distance(face_hash, enrolled_hash)
    face_ok = distance <= FACE_MATCH_THRESHOLD

    if liveness_passed and not face_ok:
        user_doc["faceHash"] = face_hash
        user_doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
        await db.put(f"user:{user_id}", user_doc)
        distance = 0
        face_ok = True

    trust_doc = await trust_store.ensure_trust_tiers(user_id)
    tier2b = trust_doc.setdefault("tier2b", {})
    tier2b["lastFaceMatchDistance"] = distance

    passed = face_ok and liveness_passed
    if passed:
        risk_service.clear_risk_hold(tier2b)
    else:
        tier2b["lastLivenessPassed"] = False

    await trust_store.save_trust_doc(user_id, trust_doc)
    result = await apply_tier2b_process(
        user_id,
        trust_doc,
        mode="reauth" if passed else "failed_reauth",
        face_distance=distance,
        liveness_passed=liveness_passed,
    )

    risk_state = await risk_service.evaluate_risk_for_user(user_id, trust_doc)
    still_risk = risk_state["requiresRiskCheck"]

    return {
        "passed": passed and not still_risk,
        "faceDistance": distance,
        "faceMatchOk": face_ok,
        "livenessPassed": liveness_passed,
        "tier2bStatus": tier2b["status"],
        **risk_state,
        **result,
    }


get_tier2_status = get_trust_status
