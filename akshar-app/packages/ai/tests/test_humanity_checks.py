"""Tests for Tier-1 batch behavioural checks."""
from __future__ import annotations

import pytest

from app.services.humanity_checks import (
    run_all_checks, combined_humanness,
    check_messaging_pattern, check_content_diversity, check_volume_plausibility,
)


def _make_human_messages(n: int = 50) -> list[dict]:
    """Generate human-like message data."""
    import random
    rng = random.Random(42)
    msgs = []
    words = "hey honestly think maybe later tonight coffee project deadline weekend".split()
    for i in range(n):
        text = " ".join(rng.choice(words) for _ in range(rng.randint(3, 15)))
        cps = rng.uniform(2.5, 6.0)
        typing_ms = (len(text) / cps) * 1000
        msgs.append({
            "ts": 1000000 + i * rng.randint(60, 3600),
            "text": text,
            "typing_ms": typing_ms,
        })
    return msgs


def _make_bot_messages(n: int = 100) -> list[dict]:
    """Generate bot-like message data."""
    templates = [
        "Click here to verify your account: http://verify.example/login",
        "Congratulations! You have won a prize. Claim now: http://promo.example/win",
        "Buy cheap products today, limited offer!!! http://deal.example/sale",
    ]
    msgs = []
    for i in range(n):
        text = templates[i % len(templates)]
        msgs.append({
            "ts": 1000000 + i * 30,  # very regular timing
            "text": text,
            "typing_ms": 45.0,  # constant speed
        })
    return msgs


def test_human_profile_scores_high():
    user_data = {
        "messages": _make_human_messages(50),
        "posts": [1000000 + i * 7200 for i in range(5)],
        "sessions": [{"duration_min": 15 + i * 3} for i in range(10)],
        "fr_sent": 5,
        "fr_accepted": 4,
        "n_days": 14,
    }
    checks = run_all_checks(user_data)
    humanness = combined_humanness(checks)
    assert humanness > 0.5, f"Expected human-like, got {humanness}"


def test_bot_profile_scores_low():
    user_data = {
        "messages": _make_bot_messages(100),
        "posts": [1000000 + i * 60 for i in range(50)],
        "sessions": [{"duration_min": 30.0} for _ in range(14)],  # constant duration
        "fr_sent": 200,
        "fr_accepted": 20,
        "n_days": 14,
    }
    checks = run_all_checks(user_data)
    humanness = combined_humanness(checks)
    assert humanness < 0.5, f"Expected bot-like, got {humanness}"


def test_all_checks_return_valid_structure():
    user_data = {
        "messages": _make_human_messages(20),
        "posts": [],
        "sessions": [{"duration_min": 10}],
        "fr_sent": 0,
        "fr_accepted": 0,
        "n_days": 7,
    }
    checks = run_all_checks(user_data)
    assert len(checks) == 8
    for check in checks:
        assert "key" in check
        assert "score" in check
        assert 0.0 <= check["score"] <= 1.0
        assert check["weight"] > 0


def test_content_diversity_spam():
    msgs = [{"ts": i, "text": "http://spam.example", "typing_ms": 100} for i in range(20)]
    result = check_content_diversity(msgs)
    assert result["score"] < 0.3


def test_volume_plausibility_high_volume():
    msgs = [{"ts": i, "text": "msg", "typing_ms": 100} for i in range(1000)]
    result = check_volume_plausibility(msgs, 7)  # ~142/day
    assert result["score"] < 0.3
