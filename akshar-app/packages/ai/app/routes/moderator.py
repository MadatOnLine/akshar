"""Moderator endpoints — dashboard, threshold management, user bans."""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import SERVICE_API_KEY
from app.db.couch_client import db
from app.services.trust_engine import trust_from_evidence, tier_for

router = APIRouter(prefix="/ai", tags=["moderator"])


def _verify_admin(x_service_key: str | None) -> None:
    """Verify admin access via service key (MVP: same key for moderators)."""
    if not x_service_key or x_service_key != SERVICE_API_KEY:
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/dashboard")
async def get_dashboard(x_service_key: str | None = Header(None)):
    """Get aggregated platform health data for moderators."""
    _verify_admin(x_service_key)

    trust_docs = await db.find({"type": "trust"}, limit=1000)

    users_by_tier = {"larva": 0, "drone": 0, "colony": 0}
    flagged_accounts = []
    bot_count = 0
    human_count = 0

    for doc in trust_docs:
        evidence = doc.get("evidence", 0.0)
        trust = trust_from_evidence(evidence)
        tier = tier_for(trust)

        if trust >= 7500:
            users_by_tier["colony"] = users_by_tier.get("colony", 0) + 1
        elif trust >= 4000:
            users_by_tier["drone"] = users_by_tier.get("drone", 0) + 1
        else:
            users_by_tier["larva"] = users_by_tier.get("larva", 0) + 1

        if trust < 1000:
            flagged_accounts.append({
                "userId": doc.get("userId"),
                "trust": trust,
                "tier": tier,
            })
            bot_count += 1
        else:
            human_count += 1

    from app.services.drift_engine import get_flagged_conversations
    flagged_convos = get_flagged_conversations()

    return {
        "ok": True,
        "totalUsers": len(trust_docs),
        "usersByTier": users_by_tier,
        "flaggedAccounts": flagged_accounts,
        "flaggedConversations": flagged_convos,
        "botCount": bot_count,
        "humanCount": human_count,
    }


class ThresholdUpdateRequest(BaseModel):
    name: str = Field(..., pattern=r"^(BOT_THRESHOLD|DRIFT_THRESHOLD|AI_DETECTION_THRESHOLD)$")
    value: float = Field(..., ge=0.0, le=1.0)


@router.post("/threshold")
async def update_threshold(body: ThresholdUpdateRequest, x_service_key: str | None = Header(None)):
    """Update a detection threshold at runtime."""
    _verify_admin(x_service_key)

    import app.config as config
    setattr(config, body.name, body.value)

    # Persist to CouchDB config
    config_doc = await db.get("config:thresholds") or {"type": "config"}
    config_doc[body.name] = body.value
    await db.put("config:thresholds", config_doc)

    return {"ok": True, "name": body.name, "value": body.value}


class BanRequest(BaseModel):
    userId: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=1, max_length=500)


@router.post("/ban")
async def ban_user(body: BanRequest, x_service_key: str | None = Header(None)):
    """Suspend a user account (set status to banned)."""
    _verify_admin(x_service_key)

    # Update user status in akshar_users database (cross-service call in production)
    # For MVP, we update the trust doc to indicate banned
    trust_doc = await db.get(f"trust:{body.userId}")
    if not trust_doc:
        raise HTTPException(status_code=404, detail="User not found")

    trust_doc["banned"] = True
    trust_doc["banReason"] = body.reason
    await db.put(f"trust:{body.userId}", trust_doc)

    return {"ok": True, "userId": body.userId, "status": "banned"}
