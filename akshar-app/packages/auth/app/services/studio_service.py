"""Account Studio — analytics, trust snapshot, reports (no trust history)."""
from __future__ import annotations

from typing import Any

from app.config import COUCHDB_FEED_DB, TIER0_BASE_TRUST
from app.db.couch_query import find_docs
from app.services import reports_service, risk_service, tier3_service, trust_store
from app.services.tier2_trust import (
    build_trust_status_response,
    evidence_for_trust,
    tier_for,
    trust_from_evidence,
)


async def get_post_analytics(user_id: str) -> dict[str, Any]:
    posts = await find_docs(
        COUCHDB_FEED_DB,
        {"$or": [{"sharerId": user_id}, {"originalAuthorId": user_id}], "type": "post"},
        limit=100,
    )
    posts.sort(key=lambda p: p.get("ts", 0), reverse=True)

    total_likes = total_dislikes = total_shares = 0
    rows: list[dict[str, Any]] = []
    for p in posts:
        likes = int(p.get("likes", 0))
        dislikes = int(p.get("dislikes", 0))
        shares = int(p.get("shares", 0))
        total_likes += likes
        total_dislikes += dislikes
        total_shares += shares
        rows.append({
            "postId": p.get("postId"),
            "content": (p.get("content") or "")[:200],
            "likes": likes,
            "dislikes": dislikes,
            "shares": shares,
            "engagement": likes + dislikes + shares,
            "ts": p.get("ts"),
            "isSharer": p.get("sharerId") == user_id,
        })

    return {
        "totals": {
            "posts": len(posts),
            "likes": total_likes,
            "dislikes": total_dislikes,
            "shares": total_shares,
            "netSentiment": total_likes - total_dislikes,
        },
        "posts": rows,
    }


async def get_studio_dashboard(user_id: str) -> dict[str, Any]:
    trust_doc = await trust_store.ensure_trust_tiers(user_id)
    risk_state = await risk_service.evaluate_risk_for_user(user_id, trust_doc)
    trust_doc = await trust_store.get_trust_doc(user_id) or trust_doc

    status = await build_trust_status_response(user_id, trust_doc)
    tier3 = await tier3_service.evaluate_and_persist(
        user_id, await trust_store.get_trust_doc(user_id) or trust_doc
    )
    reports = await reports_service.list_reports_for_user(user_id)
    analytics = await get_post_analytics(user_id)

    evidence = (await trust_store.get_trust_doc(user_id) or trust_doc).get(
        "evidence", evidence_for_trust(TIER0_BASE_TRUST)
    )
    trust_score = trust_from_evidence(evidence)
    tier2 = status.get("tier2", {})
    tier2b = status.get("tier2b", {})

    return {
        "ok": True,
        "userId": user_id,
        "requiresRiskCheck": risk_state["requiresRiskCheck"],
        "riskReason": risk_state.get("riskReason", ""),
        "trust": {
            "score": trust_score,
            "tier": tier_for(trust_score),
            "integrity": {
                "status": tier2.get("status"),
                "verdict": tier2.get("verdict"),
                "humanness": tier2.get("humanness"),
                "checks": tier2.get("checks", []),
            },
            "binding": {
                "status": tier2b.get("status"),
                "verdict": tier2b.get("verdict"),
                "humanness": tier2b.get("humanness"),
                "checks": tier2b.get("checks", []),
            },
        },
        "tier3": tier3,
        "analytics": analytics,
        "reports": reports,
    }
