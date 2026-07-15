"""Tier 2b person-binding — face re-match and liveness on step-up (risk-based, no timers)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.config import TIER2_FACE_MATCH_THRESHOLD


def face_match_score(distance: int | None, threshold: int = TIER2_FACE_MATCH_THRESHOLD) -> float:
    if distance is None:
        return 0.0
    if distance <= 4:
        return 1.0
    if distance <= threshold // 2:
        return 0.9
    if distance <= threshold:
        return 0.7
    if distance <= threshold + 6:
        return 0.3
    return 0.0


def liveness_score(passed: bool, *, face_confirmed: bool = False) -> float:
    if passed:
        return 1.0
    if face_confirmed:
        return 0.85
    return 0.0


def tier2b_status_label(
    last_face_distance: int | None,
    failures: int,
    *,
    risk_hold: bool = False,
) -> str:
    if risk_hold:
        return "at_risk"
    if failures >= 3:
        return "failed"
    if last_face_distance is not None and last_face_distance > TIER2_FACE_MATCH_THRESHOLD:
        return "at_risk"
    if failures >= 1:
        return "watch"
    return "fresh"


def run_tier2b_checks(
    trust_doc: dict[str, Any],
    *,
    face_distance: int | None = None,
    liveness_passed: bool | None = None,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    del now
    tier2b = trust_doc.get("tier2b", trust_doc.get("tier2", {}))
    distance = face_distance if face_distance is not None else tier2b.get("lastFaceMatchDistance")
    liveness = liveness_passed if liveness_passed is not None else tier2b.get("lastLivenessPassed", False)
    face_ok = distance is not None and distance <= TIER2_FACE_MATCH_THRESHOLD

    return [
        {
            "id": "face_match",
            "label": "Face re-match (1:1)",
            "score": round(face_match_score(distance), 4),
            "detail": f"Hamming distance {distance}" if distance is not None else "No face match yet",
            "pass": face_ok,
        },
        {
            "id": "liveness_reauth",
            "label": "Liveness verification",
            "score": round(liveness_score(bool(liveness), face_confirmed=face_ok), 4),
            "detail": (
                "Step-up liveness completed"
                if liveness
                else "Required while account is under risk"
            ),
            "pass": bool(liveness),
        },
    ]


def combined_tier2b_humanness(checks: list[dict[str, Any]]) -> float:
    weights = {"face_match": 0.55, "liveness_reauth": 0.45}
    total = 0.0
    weight_sum = 0.0
    for check in checks:
        w = weights.get(check["id"], 0.1)
        total += check["score"] * w
        weight_sum += w
    if weight_sum == 0:
        return 0.0
    humanness = total / weight_sum
    if any(c["id"] == "face_match" and not c["pass"] for c in checks):
        return min(humanness, 0.25)
    return humanness
