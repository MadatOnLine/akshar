"""Trust evidence processing for Tier 2 (integrity) and Tier 2b (person-binding)."""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from app.config import (
    TIER0_BASE_TRUST,
    TIER2_BOOST_HUMANNESS,
    TIER2_OVERDUE_HUMANNESS,
)
from app.services import tier2_integrity_checks, tier2b_checks
from app.services.integrity_aggregator import collect_integrity_signals
from app.services import reports_service, risk_service
from app.services.trust_store import save_trust_doc

MAX_TRUST = 10_000
E_MAX = 60.0
K = 0.6
STEP = 9.0
DECAY_RATE = 0.45
FLOOR_TRUST = 100
_DENOM = math.log1p(K * E_MAX)
_FLOOR_E = math.expm1(FLOOR_TRUST / MAX_TRUST * _DENOM) / K


def trust_from_evidence(evidence: float) -> int:
    e = max(0.0, min(evidence, E_MAX))
    val = MAX_TRUST * math.log1p(K * e) / _DENOM
    return int(round(max(0.0, min(float(MAX_TRUST), val))))


def evidence_for_trust(target: float) -> float:
    target = max(0.0, min(float(MAX_TRUST), target))
    return math.expm1(target / MAX_TRUST * _DENOM) / K


def tier_for(trust: int) -> str:
    if trust >= 7500:
        return "Trusted Human"
    if trust >= 4000:
        return "Likely Human"
    if trust >= 1000:
        return "Provisional"
    return "Low Trust / Suspect"


def advance_evidence(evidence: float, humanness: float) -> float:
    if humanness >= 0.5:
        return min(E_MAX, evidence + (humanness - 0.5) * 2.0 * STEP)
    strength = (0.5 - humanness) * 2.0
    factor = 1.0 - DECAY_RATE * strength
    if evidence > _FLOOR_E:
        return _FLOOR_E + (evidence - _FLOOR_E) * factor
    return evidence


def _tier2b_humanness_for_mode(mode: str, combined: float) -> float:
    if mode == "overdue":
        return TIER2_OVERDUE_HUMANNESS
    if mode == "failed_reauth":
        return min(combined, 0.1)
    if mode in ("reauth", "login_refresh") and combined >= 0.7:
        return max(combined, TIER2_BOOST_HUMANNESS)
    if mode == "login_refresh":
        return max(combined, 0.72)
    return combined


async def build_trust_status_response(user_id: str, trust_doc: dict[str, Any]) -> dict[str, Any]:
    signals = await collect_integrity_signals(user_id, trust_doc)
    integrity_checks = tier2_integrity_checks.run_tier2_integrity_checks(signals)
    integrity_humanness = tier2_integrity_checks.combined_integrity_humanness(integrity_checks)
    integrity_status = tier2_integrity_checks.integrity_status_label(
        integrity_humanness,
        signals["accountAgeDays"],
        signals["validReports"],
    )
    integrity_verdict = tier2_integrity_checks.integrity_verdict(integrity_status, integrity_humanness)

    tier2b_block = trust_doc.get("tier2b", {})
    binding_checks = tier2b_checks.run_tier2b_checks(trust_doc)
    tier2b_humanness = tier2b_checks.combined_tier2b_humanness(binding_checks)
    score = trust_from_evidence(trust_doc.get("evidence", evidence_for_trust(TIER0_BASE_TRUST)))
    qualifying = await reports_service.count_qualifying_reports(user_id)
    tier2b_status = tier2b_checks.tier2b_status_label(
        tier2b_block.get("lastFaceMatchDistance"),
        int(tier2b_block.get("reauthFailures", 0)),
        risk_hold=bool(tier2b_block.get("riskHold")),
    )
    needs_risk = risk_service.requires_risk_check(
        trust_doc, trust_score=score, qualifying_reports=qualifying
    )
    tier2b_verdict = (
        "Verification required"
        if needs_risk
        else "Bound"
        if tier2b_humanness >= 0.7 and tier2b_status == "fresh"
        else "At risk"
        if tier2b_status in ("at_risk", "watch")
        else "Failed"
    )

    evidence = trust_doc.get("evidence", evidence_for_trust(TIER0_BASE_TRUST))
    trust = score

    return {
        "ok": True,
        "userId": user_id,
        "trust": trust,
        "tier": tier_for(trust),
        "tier2": {
            **trust_doc.get("tier2", {}),
            "status": integrity_status,
            "humanness": round(integrity_humanness, 4),
            "verdict": integrity_verdict,
            "checks": integrity_checks,
            "signals": signals,
        },
        "tier2b": {
            **{k: v for k, v in tier2b_block.items() if k not in ("reauthDue", "reauthIntervalSec")},
            "status": tier2b_status,
            "humanness": round(tier2b_humanness, 4),
            "verdict": tier2b_verdict,
            "checks": binding_checks,
            "requiresRiskCheck": needs_risk,
            "riskReason": risk_service.risk_reason(
                trust_doc, trust_score=score, qualifying_reports=qualifying
            ) if needs_risk else "",
        },
        "tier3": {
            "status": (trust_doc.get("tier3") or {}).get("status", "progressing"),
        },
    }


async def apply_integrity_process(user_id: str, trust_doc: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    signals = await collect_integrity_signals(user_id, trust_doc)
    checks = tier2_integrity_checks.run_tier2_integrity_checks(signals)
    humanness = tier2_integrity_checks.combined_integrity_humanness(checks)

    tier2 = trust_doc.setdefault("tier2", {})
    tier2["status"] = tier2_integrity_checks.integrity_status_label(
        humanness, signals["accountAgeDays"], signals["validReports"]
    )
    tier2["lastChecks"] = checks
    tier2["lastSignals"] = signals
    tier2["lastAnalysis"] = now.isoformat()

    evidence_before = trust_doc.get("evidence", evidence_for_trust(TIER0_BASE_TRUST))
    trust_before = trust_from_evidence(evidence_before)
    evidence_after = advance_evidence(evidence_before, humanness)
    trust_after = trust_from_evidence(evidence_after)

    trust_doc["evidence"] = evidence_after
    trust_doc.setdefault("history", []).append(trust_after)
    trust_doc["lastTier2Analysis"] = now.isoformat()
    await save_trust_doc(user_id, trust_doc)

    return {
        "ok": True,
        "userId": user_id,
        "mode": "integrity",
        "humanness": round(humanness, 4),
        "verdict": tier2_integrity_checks.integrity_verdict(tier2["status"], humanness),
        "trustBefore": trust_before,
        "trustAfter": trust_after,
        "delta": trust_after - trust_before,
        "tier": tier_for(trust_after),
        "checks": checks,
        "signals": signals,
        "tier2Status": tier2["status"],
    }


async def apply_tier2b_process(
    user_id: str,
    trust_doc: dict[str, Any],
    *,
    mode: str = "reauth",
    face_distance: int | None = None,
    liveness_passed: bool | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    tier2b = trust_doc.setdefault("tier2b", {})
    checks = tier2b_checks.run_tier2b_checks(
        trust_doc,
        face_distance=face_distance,
        liveness_passed=liveness_passed,
        now=now,
    )
    combined = tier2b_checks.combined_tier2b_humanness(checks)
    humanness = _tier2b_humanness_for_mode(mode, combined)

    tier2b["status"] = tier2b_checks.tier2b_status_label(
        face_distance if face_distance is not None else tier2b.get("lastFaceMatchDistance"),
        int(tier2b.get("reauthFailures", 0)),
        risk_hold=bool(tier2b.get("riskHold")),
    )
    tier2b["lastChecks"] = checks

    evidence_before = trust_doc.get("evidence", evidence_for_trust(TIER0_BASE_TRUST))
    trust_before = trust_from_evidence(evidence_before)
    evidence_after = advance_evidence(evidence_before, humanness)
    trust_after = trust_from_evidence(evidence_after)

    trust_doc["evidence"] = evidence_after
    trust_doc.setdefault("history", []).append(trust_after)
    trust_doc["lastTier2bAnalysis"] = now.isoformat()
    await save_trust_doc(user_id, trust_doc)

    return {
        "ok": True,
        "userId": user_id,
        "mode": mode,
        "humanness": round(humanness, 4),
        "verdict": "Person-bound" if humanness >= 0.7 else "Credential risk",
        "trustBefore": trust_before,
        "trustAfter": trust_after,
        "evidenceAfter": round(evidence_after, 4),
        "delta": trust_after - trust_before,
        "tier": tier_for(trust_after),
        "checks": checks,
        "tier2bStatus": tier2b["status"],
    }


# Backward-compatible aliases
build_tier2_response = build_trust_status_response
apply_tier2_process = apply_tier2b_process
