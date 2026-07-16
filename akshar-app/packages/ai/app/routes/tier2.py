"""Tier 2 trust endpoints — person-binding checks and trust updates."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import SERVICE_API_KEY, TIER2_BOOST_HUMANNESS, TIER2_OVERDUE_HUMANNESS
from app.db.couch_client import db
from app.services.tier2_checks import (
    combined_tier2_humanness,
    run_tier2_checks,
    tier2_status_label,
)
from app.services.trust_engine import advance_evidence, evidence_for_trust, tier_for, trust_from_evidence

router = APIRouter(prefix="/ai", tags=["tier2"])


class Tier2ProcessRequest(BaseModel):
    faceDistance: int | None = None
    deviceOk: bool | None = None
    livenessPassed: bool | None = None
    mode: str = "reauth"  # reauth | overdue | failed_reauth

class ReportRequest(BaseModel):
    reportedUserId: str = Field(..., min_length=1)
    messageId: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=1)


def _humanness_for_mode(mode: str, checks: list[dict], combined: float) -> float:
    if mode == "overdue":
        return TIER2_OVERDUE_HUMANNESS
    if mode == "failed_reauth":
        return min(combined, 0.1)
    if mode == "reauth" and combined >= 0.7:
        return max(combined, TIER2_BOOST_HUMANNESS)
    return combined


@router.get("/tier2/{user_id}")
async def get_tier2_status(user_id: str):
    """Read Tier 2 person-binding status and latest checks."""
    trust_doc = await db.get(f"trust:{user_id}")
    if not trust_doc:
        raise HTTPException(status_code=404, detail="Trust state not found")

    tier2 = trust_doc.get("tier2", {})
    now = datetime.now(timezone.utc)
    checks = run_tier2_checks(trust_doc)
    humanness = combined_tier2_humanness(checks)
    evidence = trust_doc.get("evidence", evidence_for_trust(1000))
    trust = trust_from_evidence(evidence)
    status = tier2_status_label(
        now,
        tier2.get("reauthDue"),
        tier2.get("lastFaceMatchDistance"),
        tier2.get("deviceBindingOk"),
        int(tier2.get("reauthFailures", 0)),
    )

    return {
        "ok": True,
        "userId": user_id,
        "trust": trust,
        "tier": tier_for(trust),
        "tier2": {
            **tier2,
            "status": status,
            "humanness": round(humanness, 4),
            "verdict": "Bound" if humanness >= 0.7 and status == "fresh" else (
                "Overdue" if status == "overdue" else (
                    "At risk" if status == "due_soon" else "Failed"
                )
            ),
            "checks": checks,
        },
    }


@router.post("/tier2/process/{user_id}")
async def process_tier2(user_id: str, body: Tier2ProcessRequest, x_service_key: str | None = Header(None)):
    """Apply Tier 2 check results to trust evidence (service-to-service)."""
    if not x_service_key or x_service_key != SERVICE_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid service key")

    trust_doc = await db.get(f"trust:{user_id}")
    if not trust_doc:
        raise HTTPException(status_code=404, detail="Trust state not found")

    tier2 = trust_doc.setdefault("tier2", {})
    now = datetime.now(timezone.utc)
    checks = run_tier2_checks(
        trust_doc,
        face_distance=body.faceDistance,
        device_ok=body.deviceOk,
        liveness_passed=body.livenessPassed,
        now=now,
    )
    combined = combined_tier2_humanness(checks)
    humanness = _humanness_for_mode(body.mode, checks, combined)

    tier2["status"] = tier2_status_label(
        now,
        tier2.get("reauthDue"),
        body.faceDistance if body.faceDistance is not None else tier2.get("lastFaceMatchDistance"),
        body.deviceOk if body.deviceOk is not None else tier2.get("deviceBindingOk"),
        int(tier2.get("reauthFailures", 0)),
    )
    tier2["lastChecks"] = checks

    evidence_before = trust_doc.get("evidence", evidence_for_trust(1000))
    trust_before = trust_from_evidence(evidence_before)
    evidence_after = advance_evidence(evidence_before, humanness)
    trust_after = trust_from_evidence(evidence_after)

    trust_doc["evidence"] = evidence_after
    history = trust_doc.setdefault("history", [])
    history.append(trust_after)
    trust_doc["lastTier2Analysis"] = now.isoformat()
    await db.put(f"trust:{user_id}", trust_doc)

    return {
        "ok": True,
        "userId": user_id,
        "mode": body.mode,
        "humanness": round(humanness, 4),
        "verdict": "Person-bound" if humanness >= 0.7 else "Credential risk",
        "trustBefore": trust_before,
        "trustAfter": trust_after,
        "evidenceAfter": round(evidence_after, 4),
        "delta": trust_after - trust_before,
        "tier": tier_for(trust_after),
        "checks": checks,
        "tier2Status": tier2["status"],
    }

@router.post("/tier2/report")
async def report_user(body: ReportRequest, x_service_key: str | None = Header(None)):
    """Report a user for malicious behavior, placing them under a risk hold for moderators."""
    if not x_service_key or x_service_key != SERVICE_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid service key")

    trust_doc = await db.get(f"trust:{body.reportedUserId}")
    if not trust_doc:
        raise HTTPException(status_code=404, detail="Trust state not found")

    tier2b = trust_doc.setdefault("tier2b", {})
    tier2b["riskHold"] = True
    tier2b["riskReason"] = f"Reported: {body.reason} (Msg: {body.messageId})"
    
    await db.put(f"trust:{body.reportedUserId}", trust_doc)

    return {"ok": True, "reportedUserId": body.reportedUserId, "status": "flagged"}
