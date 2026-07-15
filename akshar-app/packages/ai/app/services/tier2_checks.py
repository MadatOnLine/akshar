"""Tier 2 person-binding checks — face re-match, device binding, re-auth freshness."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.config import TIER2_FACE_MATCH_THRESHOLD, TIER2_REAUTH_INTERVAL_SEC


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def face_match_score(distance: int | None, threshold: int = TIER2_FACE_MATCH_THRESHOLD) -> float:
    """Map Hamming distance to [0, 1] — lower distance is better."""
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


def device_binding_score(device_ok: bool) -> float:
    return 1.0 if device_ok else 0.0


def liveness_score(passed: bool) -> float:
    return 1.0 if passed else 0.0


def reauth_freshness_score(
    now: datetime,
    reauth_due: str | None,
    last_reauth: str | None,
    interval_sec: int = TIER2_REAUTH_INTERVAL_SEC,
) -> float:
    """Score how fresh the last re-auth is. 1.0 = just verified; decays after due date."""
    due = _parse_iso(reauth_due)
    last = _parse_iso(last_reauth)
    if not due or not last:
        return 0.5

    if now <= due:
        remaining = (due - now).total_seconds()
        return max(0.55, min(1.0, remaining / max(interval_sec, 1)))

    overdue_sec = (now - due).total_seconds()
    grace = interval_sec * 0.5
    if overdue_sec <= grace:
        return max(0.2, 0.55 - (overdue_sec / grace) * 0.35)
    return 0.0


def tier2_status_label(
    now: datetime,
    reauth_due: str | None,
    last_face_distance: int | None,
    device_ok: bool | None,
    failures: int,
) -> str:
    due = _parse_iso(reauth_due)
    if failures >= 3:
        return "failed"
    if device_ok is False:
        return "failed"
    if last_face_distance is not None and last_face_distance > TIER2_FACE_MATCH_THRESHOLD:
        return "failed"
    if due and now > due:
        return "overdue"
    if due:
        remaining = (due - now).total_seconds()
        if remaining <= min(30, TIER2_REAUTH_INTERVAL_SEC * 0.25):
            return "due_soon"
    return "fresh"


def run_tier2_checks(
    trust_doc: dict[str, Any],
    *,
    face_distance: int | None = None,
    device_ok: bool | None = None,
    liveness_passed: bool | None = None,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    """Evaluate Tier 2 checks. Uses stored trust doc values when live values are omitted."""
    now = now or datetime.now(timezone.utc)
    tier2 = trust_doc.get("tier2", {})
    interval = int(tier2.get("reauthIntervalSec", TIER2_REAUTH_INTERVAL_SEC))
    distance = face_distance if face_distance is not None else tier2.get("lastFaceMatchDistance")
    device_bound = device_ok if device_ok is not None else tier2.get("deviceBindingOk")
    liveness = liveness_passed if liveness_passed is not None else tier2.get("lastLivenessPassed", False)

    checks = [
        {
            "id": "face_match",
            "label": "Face re-match (1:1)",
            "score": round(face_match_score(distance), 4),
            "detail": f"Hamming distance {distance}" if distance is not None else "No face match yet",
            "pass": distance is not None and distance <= TIER2_FACE_MATCH_THRESHOLD,
        },
        {
            "id": "device_binding",
            "label": "Device binding",
            "score": round(device_binding_score(bool(device_bound)), 4),
            "detail": "Device matches enrollment" if device_bound else "Unknown or mismatched device",
            "pass": bool(device_bound),
        },
        {
            "id": "liveness_reauth",
            "label": "Liveness on re-verify",
            "score": round(liveness_score(bool(liveness)), 4),
            "detail": "Hybrid liveness passed" if liveness else "Liveness not completed",
            "pass": bool(liveness),
        },
        {
            "id": "reauth_freshness",
            "label": "Re-auth freshness",
            "score": round(
                reauth_freshness_score(now, tier2.get("reauthDue"), tier2.get("lastReauth"), interval),
                4,
            ),
            "detail": f"Due {tier2.get('reauthDue', '—')}",
            "pass": reauth_freshness_score(now, tier2.get("reauthDue"), tier2.get("lastReauth"), interval) >= 0.5,
        },
    ]
    return checks


def combined_tier2_humanness(checks: list[dict[str, Any]]) -> float:
    """Weighted Tier 2 humanness — device/face failures dominate."""
    weights = {
        "face_match": 0.35,
        "device_binding": 0.30,
        "liveness_reauth": 0.20,
        "reauth_freshness": 0.15,
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
    if any(c["id"] == "device_binding" and not c["pass"] for c in checks):
        return min(humanness, 0.15)
    if any(c["id"] == "face_match" and not c["pass"] for c in checks):
        return min(humanness, 0.25)
    return humanness


def default_tier2_block(now_iso: str, interval_sec: int = TIER2_REAUTH_INTERVAL_SEC) -> dict[str, Any]:
    """Initial Tier 2 metadata seeded at enrollment."""
    now = _parse_iso(now_iso) or datetime.now(timezone.utc)
    from datetime import timedelta

    due = now + timedelta(seconds=interval_sec)
    return {
        "reauthIntervalSec": interval_sec,
        "lastReauth": now_iso,
        "reauthDue": due.isoformat(),
        "lastFaceMatchDistance": 0,
        "deviceBindingOk": True,
        "lastLivenessPassed": True,
        "reauthFailures": 0,
        "status": "fresh",
    }
