"""Aggregate account activity signals from CouchDB for Tier 2 integrity."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.config import (
    COUCHDB_DATABASE,
    COUCHDB_FEED_DB,
    COUCHDB_GROUPS_DB,
    COUCHDB_VAULT_DB,
)
from app.db.couch_client import db
from app.db.couch_query import count_docs, find_docs


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


async def collect_integrity_signals(user_id: str, trust_doc: dict[str, Any]) -> dict[str, Any]:
    user_doc = await db.get(f"user:{user_id}")
    if not user_doc:
        raise ValueError("User not found")

    created = _parse_iso(user_doc.get("createdAt"))
    now = datetime.now(timezone.utc)
    age_days = (now - created).total_seconds() / 86400.0 if created else 0.0

    tier2 = trust_doc.get("tier2", {})
    demo = tier2.get("demo", {})

    sessions = await find_docs(COUCHDB_DATABASE, {"type": "session", "userId": user_id}, limit=200)
    session_count = len(sessions)
    device_ids = {s.get("deviceId") for s in sessions if s.get("deviceId")}

    posts = await find_docs(
        COUCHDB_FEED_DB,
        {"$or": [{"sharerId": user_id}, {"originalAuthorId": user_id}], "type": "post"},
        limit=200,
    )
    post_count = len(posts)
    post_ids = [p.get("postId") for p in posts if p.get("postId")]

    likes_received = sum(int(p.get("likes", 0)) for p in posts)
    reactions_received = 0
    unique_interactors: set[str] = set()
    for pid in post_ids[:50]:
        reactions = await find_docs(
            COUCHDB_FEED_DB,
            {"type": {"$in": ["like", "dislike", "share"]}, "postId": pid},
            limit=100,
        )
        for r in reactions:
            if r.get("userId") and r["userId"] != user_id:
                unique_interactors.add(r["userId"])
                reactions_received += 1

    messages_sent = await count_docs(COUCHDB_VAULT_DB, {"type": "message", "fromNode": user_id}, limit=300)
    messages_recv = await count_docs(COUCHDB_VAULT_DB, {"type": "message", "toNode": user_id}, limit=300)
    replies_received = messages_recv

    groups = await find_docs(COUCHDB_GROUPS_DB, {"type": "group"}, limit=100)
    group_count = sum(1 for g in groups if user_id in (g.get("memberIds") or []))

    tier1_humanness = trust_doc.get("lastTier1Humanness")
    history = trust_doc.get("history", [])

    signals = {
        "accountAgeDays": max(age_days, float(demo.get("accountAgeDays", 0))),
        "messageCount": messages_sent + int(demo.get("extraMessages", 0)),
        "postCount": post_count + int(demo.get("extraPosts", 0)),
        "sessionCount": session_count + int(demo.get("extraSessions", 0)),
        "groupCount": group_count + int(demo.get("extraGroups", 0)),
        "likesReceived": likes_received + int(demo.get("extraLikes", 0)),
        "reactionsReceived": reactions_received + int(demo.get("extraReactions", 0)),
        "repliesReceived": replies_received + int(demo.get("extraReplies", 0)),
        "validReports": int(tier2.get("validReports", 0)) + int(demo.get("extraValidReports", 0)),
        "dismissedReports": int(tier2.get("dismissedReports", 0)) + int(demo.get("extraDismissedReports", 0)),
        "tier1Humanness": tier1_humanness if tier1_humanness is not None else demo.get("tier1Humanness"),
        "trustHistoryLen": len(history),
        "uniqueInteractors": len(unique_interactors) + int(demo.get("extraInteractors", 0)),
        "uniqueDevices": len(device_ids),
    }
    return signals
