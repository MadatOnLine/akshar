"""Tier-1 batch behavioural checks — 8 signals analyzing full user history."""
from __future__ import annotations

import math
import statistics
from typing import Any


def _logistic(x: float, x0: float, k: float) -> float:
    try:
        return 1.0 / (1.0 + math.exp(-k * (x - x0)))
    except OverflowError:
        return 0.0 if x < x0 else 1.0


def _cv(xs: list[float]) -> float:
    if len(xs) < 2:
        return 0.0
    m = statistics.fmean(xs)
    return statistics.pstdev(xs) / abs(m) if m else 0.0


def _bump(x: float, center: float, width: float) -> float:
    return math.exp(-((x - center) / width) ** 2)


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def check_messaging_pattern(messages: list[dict]) -> dict:
    """Inter-message timing variability + message length variability."""
    timestamps = sorted(m["ts"] for m in messages)
    intervals = [b - a for a, b in zip(timestamps, timestamps[1:]) if b > a]
    cv = _cv(intervals) if intervals else 0.0
    lengths = [len(m.get("text", "")) for m in messages]
    len_cv = _cv(lengths) if lengths else 0.0
    s_cv = _logistic(cv, 0.5, 5.0)
    s_len = _logistic(len_cv, 0.3, 8.0)
    score = 0.7 * s_cv + 0.3 * s_len
    return {"key": "messaging_pattern", "label": "Messaging Patterns", "score": _clamp01(score), "weight": 1.0,
            "detail": f"Timing CV={cv:.2f}, length CV={len_cv:.2f}"}


def check_posting_frequency(messages: list[dict], posts: list[float]) -> dict:
    """Circadian rhythm — dead-hour activity + 24h spread."""
    hours = [int((m["ts"] / 3600) % 24) for m in messages] + [int((p / 3600) % 24) for p in posts]
    if not hours:
        return {"key": "posting_frequency", "label": "Posting Frequency", "score": 0.5, "weight": 1.0, "detail": "No activity"}
    dead = sum(1 for h in hours if h in (2, 3, 4, 5)) / len(hours)
    active_hours = len(set(hours)) / 24.0
    s_dead = 1.0 - _logistic(dead, 0.10, 40.0)
    s_spread = 1.0 - _logistic(active_hours, 0.85, 14.0)
    score = 0.6 * s_dead + 0.4 * s_spread
    return {"key": "posting_frequency", "label": "Posting Frequency", "score": _clamp01(score), "weight": 1.0,
            "detail": f"{dead*100:.0f}% dead-hour activity, {active_hours*24:.0f}/24h active"}


def check_session_duration(sessions: list[dict]) -> dict:
    """Session length variability + mean plausibility."""
    durs = [s.get("duration_min", 0) for s in sessions]
    if len(durs) < 2:
        return {"key": "session_duration", "label": "Session Duration", "score": 0.5, "weight": 0.9, "detail": "Insufficient sessions"}
    cv = _cv(durs)
    mean = statistics.fmean(durs)
    s_cv = _logistic(cv, 0.35, 7.0)
    s_mean = 1.0 if mean < 240 else 0.1
    score = 0.8 * s_cv + 0.2 * s_mean
    return {"key": "session_duration", "label": "Session Duration", "score": _clamp01(score), "weight": 0.9,
            "detail": f"CV={cv:.2f}, mean={mean:.0f}min"}


def check_typing_behavior(messages: list[dict]) -> dict:
    """Typing speed plausibility + variability."""
    cps = [len(m.get("text", "")) / (m["typing_ms"] / 1000.0) for m in messages if m.get("typing_ms", 0) > 0 and m.get("text")]
    if not cps:
        return {"key": "typing_behavior", "label": "Typing Behaviour", "score": 0.5, "weight": 1.0, "detail": "No typing data"}
    med = statistics.median(cps)
    cps_cv = _cv(cps)
    impossible = sum(1 for c in cps if c > 15.0) / len(cps)
    s_med = _bump(med, 4.5, 3.5)
    s_var = _logistic(cps_cv, 0.15, 12.0)
    s_imp = 1.0 - impossible
    score = 0.45 * s_med + 0.25 * s_var + 0.30 * s_imp
    return {"key": "typing_behavior", "label": "Typing Behaviour", "score": _clamp01(score), "weight": 1.0,
            "detail": f"Median {med:.1f} chars/s, CV={cps_cv:.2f}, {impossible*100:.0f}% impossible"}


def check_friend_requests(fr_sent: int, fr_accepted: int, n_days: int) -> dict:
    """Acceptance ratio + send rate."""
    if fr_sent == 0:
        return {"key": "friend_requests", "label": "Friend Requests", "score": 0.5, "weight": 0.8, "detail": "No requests sent"}
    acceptance = fr_accepted / fr_sent
    rate = fr_sent / max(1, n_days)
    s_acc = _logistic(acceptance, 0.35, 12.0)
    s_rate = 1.0 - _logistic(rate, 7.0, 1.0)
    score = 0.6 * s_acc + 0.4 * s_rate
    return {"key": "friend_requests", "label": "Friend Requests", "score": _clamp01(score), "weight": 0.8,
            "detail": f"{acceptance*100:.0f}% accepted, {rate:.1f}/day"}


def check_content_diversity(messages: list[dict]) -> dict:
    """Unique messages + lexical diversity + spam ratio."""
    texts = [m.get("text", "") for m in messages]
    if not texts:
        return {"key": "content_diversity", "label": "Content Diversity", "score": 0.5, "weight": 1.0, "detail": "No content"}
    unique_ratio = len(set(texts)) / len(texts)
    words = [w for t in texts for w in t.lower().split()]
    lexical = (len(set(words)) / len(words)) if words else 0.0
    spam = sum(1 for t in texts if "http" in t.lower()) / len(texts)
    s_u = _logistic(unique_ratio, 0.55, 9.0)
    s_l = _logistic(lexical, 0.40, 8.0)
    s_s = 1.0 - spam
    score = 0.5 * s_u + 0.3 * s_l + 0.2 * s_s
    return {"key": "content_diversity", "label": "Content Diversity", "score": _clamp01(score), "weight": 1.0,
            "detail": f"{unique_ratio*100:.0f}% unique, lexical {lexical:.2f}, {spam*100:.0f}% links"}


def check_activity_rhythm(messages: list[dict]) -> dict:
    """Burstiness coefficient."""
    timestamps = sorted(m["ts"] for m in messages)
    intervals = [b - a for a, b in zip(timestamps, timestamps[1:]) if b > a]
    if len(intervals) < 2:
        return {"key": "activity_rhythm", "label": "Activity Rhythm", "score": 0.5, "weight": 0.6, "detail": "Insufficient activity"}
    sd = statistics.pstdev(intervals)
    mn = statistics.fmean(intervals)
    burst = (sd - mn) / (sd + mn) if (sd + mn) > 0 else 0.0
    score = _logistic(burst, 0.0, 6.0)
    return {"key": "activity_rhythm", "label": "Activity Rhythm", "score": _clamp01(score), "weight": 0.6,
            "detail": f"Burstiness B={burst:+.2f}"}


def check_volume_plausibility(messages: list[dict], n_days: int) -> dict:
    """Messages per day — sustained high volume is automation signal."""
    mpd = len(messages) / max(1, n_days)
    score = 1.0 - _logistic(mpd, 55.0, 0.15)
    return {"key": "volume_plausibility", "label": "Volume Plausibility", "score": _clamp01(score), "weight": 0.6,
            "detail": f"{mpd:.1f} messages/day"}


def run_all_checks(user_data: dict[str, Any]) -> list[dict]:
    """Run all 8 Tier-1 checks and return results."""
    messages = user_data.get("messages", [])
    posts = user_data.get("posts", [])
    sessions = user_data.get("sessions", [])
    fr_sent = user_data.get("fr_sent", 0)
    fr_accepted = user_data.get("fr_accepted", 0)
    n_days = user_data.get("n_days", 14)

    return [
        check_messaging_pattern(messages),
        check_posting_frequency(messages, posts),
        check_session_duration(sessions),
        check_typing_behavior(messages),
        check_friend_requests(fr_sent, fr_accepted, n_days),
        check_content_diversity(messages),
        check_activity_rhythm(messages),
        check_volume_plausibility(messages, n_days),
    ]


def combined_humanness(checks: list[dict]) -> float:
    """Compute weighted mean humanness from all checks."""
    wsum = sum(c["weight"] for c in checks) or 1.0
    return sum(c["weight"] * c["score"] for c in checks) / wsum
