"""Risk-based Tier 2b — mandatory human verification only for trust collapse or sustained upheld reports."""

from __future__ import annotations



from typing import Any



from app.config import (

    REPORTER_MIN_TRUST_SCORE,

    RISK_REPORT_COUNT_THRESHOLD,

    RISK_TRUST_THRESHOLD,

    TIER0_BASE_TRUST,

)

from app.services.tier2_trust import evidence_for_trust, trust_from_evidence





def trust_score_from_doc(trust_doc: dict[str, Any]) -> int:

    evidence = trust_doc.get("evidence", evidence_for_trust(TIER0_BASE_TRUST))

    return trust_from_evidence(evidence)





def requires_risk_check(

    trust_doc: dict[str, Any],

    *,

    trust_score: int | None = None,

    qualifying_reports: int = 0,

) -> bool:

    """Risk only when trust is below threshold OR enough qualifying upheld reports — and not yet re-verified."""

    tier2b = trust_doc.get("tier2b", {})

    if tier2b.get("lastLivenessPassed", True):

        return False



    score = trust_score if trust_score is not None else trust_score_from_doc(trust_doc)

    if score < RISK_TRUST_THRESHOLD:

        return True

    if qualifying_reports >= RISK_REPORT_COUNT_THRESHOLD:

        return True

    return False





def risk_reason(

    trust_doc: dict[str, Any],

    *,

    trust_score: int | None = None,

    qualifying_reports: int = 0,

) -> str:

    tier2b = trust_doc.get("tier2b", {})

    if tier2b.get("riskReason"):

        return str(tier2b["riskReason"])



    score = trust_score if trust_score is not None else trust_score_from_doc(trust_doc)

    if score < RISK_TRUST_THRESHOLD:

        return f"Trust score ({score:,}) is below safe levels — complete human verification"

    if qualifying_reports >= RISK_REPORT_COUNT_THRESHOLD:

        return (

            f"{qualifying_reports} upheld report(s) with rejected appeals — "

            "verify your identity to continue"

        )

    return "Human verification required"





def clear_risk_hold(tier2b: dict[str, Any]) -> None:

    tier2b["riskHold"] = False

    tier2b.pop("riskReason", None)

    tier2b["reauthFailures"] = 0

    tier2b["status"] = "fresh"

    tier2b["lastLivenessPassed"] = True





def set_risk_hold(tier2b: dict[str, Any], reason: str) -> None:

    tier2b["riskHold"] = True

    tier2b["riskReason"] = reason

    tier2b["status"] = "at_risk"

    tier2b["lastLivenessPassed"] = False





async def evaluate_risk_for_user(user_id: str, trust_doc: dict[str, Any]) -> dict[str, Any]:

    """Recompute risk flags from trust score + qualifying reports (never from login)."""

    from app.services import reports_service

    from app.services.trust_store import save_trust_doc



    score = trust_score_from_doc(trust_doc)

    qualifying = await reports_service.count_qualifying_reports(user_id)

    tier2b = trust_doc.setdefault("tier2b", {})



    if requires_risk_check(trust_doc, trust_score=score, qualifying_reports=qualifying):

        set_risk_hold(tier2b, risk_reason(trust_doc, trust_score=score, qualifying_reports=qualifying))

    else:

        tier2b["riskHold"] = False

        tier2b.pop("riskReason", None)

        tier2b["status"] = "fresh"

        if tier2b.get("lastLivenessPassed") is not False:

            tier2b["lastLivenessPassed"] = True



    await save_trust_doc(user_id, trust_doc)

    needs = requires_risk_check(trust_doc, trust_score=score, qualifying_reports=qualifying)

    return {

        "requiresRiskCheck": needs,

        "riskReason": risk_reason(trust_doc, trust_score=score, qualifying_reports=qualifying) if needs else "",

        "trustScore": score,

        "qualifyingReports": qualifying,

    }


