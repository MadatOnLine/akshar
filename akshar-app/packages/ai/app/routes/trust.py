"""Trust score endpoints — read trust, trigger analysis."""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.config import SERVICE_API_KEY, TIER0_BASE_TRUST
from app.services.trust_engine import trust_from_evidence, tier_for, advance_evidence, evidence_for_trust
from app.services.humanity_checks import run_all_checks, combined_humanness
from app.db.couch_client import db

router = APIRouter(prefix="/ai", tags=["trust"])


@router.get("/trust/{user_id}")
async def get_trust(user_id: str):
    """Get current trust score and tier for a user."""
    trust_doc = await db.get(f"trust:{user_id}")
    if not trust_doc:
        raise HTTPException(status_code=404, detail="Trust state not found")

    evidence = trust_doc.get("evidence", 0.0)
    trust = trust_from_evidence(evidence)
    return {
        "ok": True,
        "userId": user_id,
        "trust": trust,
        "tier": tier_for(trust),
        "evidence": round(evidence, 3),
        "history": trust_doc.get("history", []),
    }


class AnalyzeRequest(BaseModel):
    userData: dict  # Full user behaviour data for Tier-1 analysis


@router.post("/analyze-profile/{user_id}")
async def analyze_profile(user_id: str, body: AnalyzeRequest, x_service_key: str | None = Header(None)):
    """Run Tier-1 batch analysis on a user's behavioural history."""
    if not x_service_key or x_service_key != SERVICE_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid service key")

    # Load current trust state
    trust_doc = await db.get(f"trust:{user_id}")
    if not trust_doc:
        tier0_evidence = evidence_for_trust(TIER0_BASE_TRUST)
        trust_doc = {
            "userId": user_id,
            "evidence": tier0_evidence,
            "history": [TIER0_BASE_TRUST],
            "type": "trust",
        }

    # Run all 8 checks
    checks = run_all_checks(body.userData)
    humanness = combined_humanness(checks)

    # Update evidence
    evidence_before = trust_doc.get("evidence", evidence_for_trust(TIER0_BASE_TRUST))
    trust_before = trust_from_evidence(evidence_before)
    evidence_after = advance_evidence(evidence_before, humanness)
    trust_after = trust_from_evidence(evidence_after)

    # Persist
    trust_doc["evidence"] = evidence_after
    history = trust_doc.setdefault("history", [])
    history.append(trust_after)
    await db.put(f"trust:{user_id}", trust_doc)

    return {
        "ok": True,
        "userId": user_id,
        "humanness": round(humanness, 4),
        "verdict": "Human-like" if humanness >= 0.5 else "Bot-like",
        "trustBefore": trust_before,
        "trustAfter": trust_after,
        "delta": trust_after - trust_before,
        "tier": tier_for(trust_after),
        "checks": checks,
    }
