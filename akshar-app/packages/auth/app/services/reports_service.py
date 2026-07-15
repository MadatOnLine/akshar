"""User reports and appeals — stored in auth CouchDB."""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any

from app.config import RISK_REPORT_COUNT_THRESHOLD
from app.db.couch_client import db
from app.services import risk_service, trust_store


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def list_reports_for_user(target_user_id: str) -> list[dict[str, Any]]:
    docs = await db.find({"type": "report", "targetUserId": target_user_id}, limit=100)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return [_public_report(d) for d in docs]


async def count_upheld_reports(target_user_id: str) -> int:
    docs = await db.find(
        {"type": "report", "targetUserId": target_user_id, "status": "upheld"},
        limit=100,
    )
    return sum(1 for d in docs if d.get("appeal", {}).get("status") != "approved")


async def _reporter_is_verified_human(reporter_id: str) -> bool:
    """Reporter must be a verified human (Likely Human tier or above)."""
    if not reporter_id or reporter_id == "system":
        return False
    from app.config import REPORTER_MIN_TRUST_SCORE, TIER0_BASE_TRUST
    from app.services.tier2_trust import evidence_for_trust, trust_from_evidence

    trust_doc = await trust_store.get_trust_doc(reporter_id)
    if not trust_doc:
        return False
    evidence = trust_doc.get("evidence", evidence_for_trust(TIER0_BASE_TRUST))
    return trust_from_evidence(evidence) >= REPORTER_MIN_TRUST_SCORE


async def count_qualifying_reports(target_user_id: str) -> int:
    """Upheld reports from verified humans where the target's appeal was rejected."""
    docs = await db.find(
        {"type": "report", "targetUserId": target_user_id, "status": "upheld"},
        limit=100,
    )
    count = 0
    for doc in docs:
        appeal = doc.get("appeal") or {}
        if appeal.get("status") == "approved":
            continue
        if appeal.get("status") != "rejected":
            continue
        if not await _reporter_is_verified_human(doc.get("reporterId", "")):
            continue
        count += 1
    return count


async def create_report(
    target_user_id: str,
    reporter_id: str,
    *,
    reason: str,
    category: str = "other",
) -> dict[str, Any]:
    report_id = secrets.token_hex(12)
    doc = {
        "type": "report",
        "reportId": report_id,
        "targetUserId": target_user_id,
        "reporterId": reporter_id,
        "reason": reason.strip(),
        "category": category,
        "status": "pending",
        "createdAt": _now_iso(),
        "appeal": {"status": "none", "text": "", "submittedAt": None, "reviewedAt": None, "reviewNotes": ""},
    }
    await db.put(f"report:{report_id}", doc)
    return _public_report(doc)


async def record_upheld_report(
    target_user_id: str,
    *,
    reason: str,
    category: str = "conduct",
    increment_counter: bool = True,
) -> dict[str, Any]:
    """Create an upheld report record (used by moderation sync)."""
    report_id = secrets.token_hex(12)
    doc = {
        "type": "report",
        "reportId": report_id,
        "targetUserId": target_user_id,
        "reporterId": "system",
        "reason": reason.strip(),
        "category": category,
        "status": "upheld",
        "createdAt": _now_iso(),
        "reviewedAt": _now_iso(),
        "reviewNotes": "Upheld after community review",
        "appeal": {"status": "none", "text": "", "submittedAt": None, "reviewedAt": None, "reviewNotes": ""},
    }
    await db.put(f"report:{report_id}", doc)

    trust_doc = await trust_store.ensure_trust_tiers(target_user_id)
    if increment_counter:
        tier2 = trust_doc.setdefault("tier2", {})
        tier2["validReports"] = int(tier2.get("validReports", 0)) + 1
    await trust_store.save_trust_doc(target_user_id, trust_doc)
    from app.services.tier2_service import refresh_integrity

    await refresh_integrity(target_user_id)
    return _public_report(doc)


async def uphold_report(report_id: str, *, notes: str = "") -> dict[str, Any]:
    doc = await db.get(f"report:{report_id}")
    if not doc:
        raise ValueError("Report not found")
    if doc.get("status") == "upheld":
        return _public_report(doc)
    doc["status"] = "upheld"
    doc["reviewedAt"] = _now_iso()
    doc["reviewNotes"] = notes or "Report upheld after review"
    await db.put(f"report:{report_id}", doc)

    trust_doc = await trust_store.ensure_trust_tiers(doc["targetUserId"])
    tier2 = trust_doc.setdefault("tier2", {})
    tier2["validReports"] = int(tier2.get("validReports", 0)) + 1
    await trust_store.save_trust_doc(doc["targetUserId"], trust_doc)
    from app.services.tier2_service import refresh_integrity

    await refresh_integrity(doc["targetUserId"])
    return _public_report(doc)


async def _auto_review_appeal(doc: dict[str, Any], trust_doc: dict[str, Any]) -> dict[str, Any]:
    """Rule-based appeal review — checks detail, category, and identity state."""
    appeal = doc.setdefault("appeal", {})
    text = (appeal.get("text") or "").strip().lower()
    original = (doc.get("reason") or "").strip()
    category = doc.get("category", "other")
    tier2b = trust_doc.get("tier2b", {})
    face_ok = tier2b.get("lastFaceMatchDistance") is not None and tier2b.get("lastFaceMatchDistance", 99) <= 14
    liveness_ok = bool(tier2b.get("lastLivenessPassed"))

    score = 0.0
    notes: list[str] = []

    if len(text) >= 50:
        score += 0.35
        notes.append("Appeal includes a detailed explanation")
    elif len(text) >= 25:
        score += 0.2
        notes.append("Appeal provides reasonable context")
    else:
        score -= 0.25
        notes.append("Appeal lacks sufficient detail")

    if any(w in text for w in ("mistake", "false", "incorrect", "wrong", "did not", "never")):
        score += 0.15
        notes.append("Appeal disputes the report with specific claims")

    if len(original) < 25:
        score += 0.15
        notes.append("Original report was vague — harder to substantiate")

    if category in ("spam", "harassment") and "context" in text:
        score += 0.1
        notes.append("Context provided for content-related report")

    if face_ok and liveness_ok:
        score += 0.25
        notes.append("Identity re-verified at time of appeal review")

    if score >= 0.45:
        doc["status"] = "dismissed"
        appeal["status"] = "approved"
        appeal["reviewNotes"] = "; ".join(notes) + " — appeal accepted, report dismissed"
        trust_doc = trust_doc  # noqa: PLW0127
        tier2 = trust_doc.setdefault("tier2", {})
        tier2["dismissedReports"] = int(tier2.get("dismissedReports", 0)) + 1
        tier2["validReports"] = max(0, int(tier2.get("validReports", 0)) - 1)
        upheld = await count_qualifying_reports(doc["targetUserId"])
        if upheld < RISK_REPORT_COUNT_THRESHOLD:
            risk_service.clear_risk_hold(trust_doc.setdefault("tier2b", {}))
    else:
        appeal["status"] = "rejected"
        appeal["reviewNotes"] = "; ".join(notes) + " — appeal rejected, report upheld"

    appeal["reviewedAt"] = _now_iso()
    return doc


async def submit_appeal(user_id: str, report_id: str, appeal_text: str) -> dict[str, Any]:
    doc = await db.get(f"report:{report_id}")
    if not doc or doc.get("targetUserId") != user_id:
        raise ValueError("Report not found")
    if doc.get("status") != "upheld":
        raise ValueError("Only upheld reports can be appealed")
    appeal = doc.setdefault("appeal", {})
    if appeal.get("status") == "pending":
        raise ValueError("Appeal already pending review")
    if appeal.get("status") == "approved":
        raise ValueError("This report was already overturned")

    appeal["status"] = "pending"
    appeal["text"] = appeal_text.strip()
    appeal["submittedAt"] = _now_iso()

    trust_doc = await trust_store.ensure_trust_tiers(user_id)
    doc = await _auto_review_appeal(doc, trust_doc)
    await db.put(f"report:{report_id}", doc)

    trust_doc = await trust_store.get_trust_doc(user_id) or trust_doc
    await trust_store.save_trust_doc(user_id, trust_doc)
    from app.services.tier2_service import refresh_integrity

    await refresh_integrity(user_id)
    return _public_report(doc)


def _public_report(doc: dict[str, Any]) -> dict[str, Any]:
    appeal = doc.get("appeal") or {}
    return {
        "reportId": doc.get("reportId"),
        "category": doc.get("category"),
        "reason": doc.get("reason"),
        "status": doc.get("status"),
        "createdAt": doc.get("createdAt"),
        "reviewedAt": doc.get("reviewedAt"),
        "reviewNotes": doc.get("reviewNotes"),
        "appeal": {
            "status": appeal.get("status", "none"),
            "text": appeal.get("text", ""),
            "submittedAt": appeal.get("submittedAt"),
            "reviewedAt": appeal.get("reviewedAt"),
            "reviewNotes": appeal.get("reviewNotes", ""),
        },
    }
