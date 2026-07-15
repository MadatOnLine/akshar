"""Tier 2 account-integrity checks — longevity, reputation, engagement, sustained humanity."""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _logistic(x: float, x0: float, k: float) -> float:
    try:
        return 1.0 / (1.0 + math.exp(-k * (x - x0)))
    except OverflowError:
        return 0.0 if x < x0 else 1.0


def account_age_score(account_age_days: float) -> float:
    """Ramp toward 1.0 over ~90 days of account life."""
    return _clamp01(_logistic(account_age_days, 30.0, 0.12))


def activity_depth_score(
    message_count: int,
    post_count: int,
    session_count: int,
    group_count: int,
) -> float:
    volume = message_count + post_count * 2 + session_count * 0.5 + group_count * 3
    return _clamp01(_logistic(volume, 25.0, 0.15))


def engagement_received_score(
    likes_received: int,
    reactions_received: int,
    replies_received: int,
) -> float:
    engagement = likes_received + reactions_received + replies_received * 2
    return _clamp01(_logistic(engagement, 8.0, 0.35))


def report_health_score(valid_reports: int, dismissed_reports: int) -> float:
    """Fewer upheld reports and more dismissed/frivolous reports = healthier account."""
    if valid_reports == 0 and dismissed_reports == 0:
        return 0.55
    penalty = valid_reports * 0.22
    bonus = min(0.25, dismissed_reports * 0.05)
    return _clamp01(0.85 - penalty + bonus)


def behavioral_sustain_score(tier1_humanness: float | None, trust_history_len: int) -> float:
    if tier1_humanness is None:
        base = 0.45
    else:
        base = tier1_humanness
    history_bonus = _clamp01(trust_history_len / 20.0) * 0.15
    return _clamp01(base * 0.85 + history_bonus)


def community_presence_score(group_count: int, unique_interactors: int) -> float:
    score = _logistic(group_count, 1.5, 1.2) * 0.5 + _logistic(unique_interactors, 4.0, 0.4) * 0.5
    return _clamp01(score)


def integrity_status_label(humanness: float, account_age_days: float, valid_reports: int) -> str:
    if valid_reports >= 3:
        return "at_risk"
    if humanness >= 0.75 and account_age_days >= 14:
        return "strong"
    if humanness >= 0.55:
        return "establishing"
    if humanness >= 0.35:
        return "weak"
    return "at_risk"


def integrity_verdict(status: str, humanness: float) -> str:
    if status == "strong":
        return "Established account"
    if status == "establishing":
        return "Building reputation"
    if status == "weak":
        return "Limited history"
    if humanness < 0.35:
        return "Integrity concern"
    return "At risk"


def run_tier2_integrity_checks(signals: dict[str, Any]) -> list[dict[str, Any]]:
    age_days = float(signals.get("accountAgeDays", 0))
    messages = int(signals.get("messageCount", 0))
    posts = int(signals.get("postCount", 0))
    sessions = int(signals.get("sessionCount", 0))
    groups = int(signals.get("groupCount", 0))
    likes = int(signals.get("likesReceived", 0))
    reactions = int(signals.get("reactionsReceived", 0))
    replies = int(signals.get("repliesReceived", 0))
    valid_reports = int(signals.get("validReports", 0))
    dismissed = int(signals.get("dismissedReports", 0))
    tier1 = signals.get("tier1Humanness")
    history_len = int(signals.get("trustHistoryLen", 0))
    interactors = int(signals.get("uniqueInteractors", 0))

    checks = [
        {
            "id": "account_age",
            "label": "Account longevity",
            "score": round(account_age_score(age_days), 4),
            "detail": f"{age_days:.0f} days since enrollment",
            "pass": age_days >= 7,
        },
        {
            "id": "activity_depth",
            "label": "Sustained activity",
            "score": round(activity_depth_score(messages, posts, sessions, groups), 4),
            "detail": f"{messages} msgs · {posts} posts · {sessions} sessions · {groups} groups",
            "pass": messages + posts + sessions >= 5,
        },
        {
            "id": "engagement_received",
            "label": "Peer engagement",
            "score": round(engagement_received_score(likes, reactions, replies), 4),
            "detail": f"{likes} likes · {reactions} reactions · {replies} replies from others",
            "pass": likes + reactions + replies >= 2,
        },
        {
            "id": "report_health",
            "label": "Report record",
            "score": round(report_health_score(valid_reports, dismissed), 4),
            "detail": f"{valid_reports} upheld · {dismissed} dismissed reports",
            "pass": valid_reports <= 1,
        },
        {
            "id": "behavioral_sustain",
            "label": "Behavioral consistency (Tier 1)",
            "score": round(behavioral_sustain_score(tier1, history_len), 4),
            "detail": "Tier 1 humanness tracked" if tier1 is not None else "Awaiting Tier 1 analysis",
            "pass": (tier1 or 0.45) >= 0.5,
        },
        {
            "id": "community_presence",
            "label": "Community footprint",
            "score": round(community_presence_score(groups, interactors), 4),
            "detail": f"{groups} groups · {interactors} unique interactors",
            "pass": groups >= 1 or interactors >= 2,
        },
    ]
    return checks


def combined_integrity_humanness(checks: list[dict[str, Any]]) -> float:
    weights = {
        "account_age": 0.20,
        "activity_depth": 0.20,
        "engagement_received": 0.20,
        "report_health": 0.15,
        "behavioral_sustain": 0.15,
        "community_presence": 0.10,
    }
    total = 0.0
    weight_sum = 0.0
    for check in checks:
        w = weights.get(check["id"], 0.1)
        total += check["score"] * w
        weight_sum += w
    if weight_sum == 0:
        return 0.0
    humanness = total / weight_sum
    report = next((c for c in checks if c["id"] == "report_health"), None)
    if report and not report["pass"] and report["score"] < 0.4:
        return min(humanness, 0.3)
    return humanness
