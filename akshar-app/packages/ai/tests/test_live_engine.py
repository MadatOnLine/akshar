"""Tests for the live per-message classification engine."""
from __future__ import annotations

import pytest

from app.services.live_engine import (
    classify_message, score_typing, score_content, score_repetition, score_rhythm,
    reset_room,
)


@pytest.fixture(autouse=True)
def clean_rooms():
    reset_room("test")
    yield
    reset_room("test")


def test_classify_returns_verdict():
    result = classify_message("test", "alice", "hey are we still on for coffee?", 3200.0)
    assert "verdict" in result
    assert result["verdict"] in ("Human", "Bot")
    assert "trust" in result
    assert "signals" in result
    assert len(result["signals"]) == 5


def test_human_message_scores_high():
    result = classify_message("test", "human", "honestly that meeting was way too long today", 4500.0)
    assert result["messageHumanness"] > 0.5


def test_bot_message_scores_low():
    result = classify_message(
        "test", "bot",
        "Congratulations! You have won a prize. Claim now: http://promo.example/win",
        45.0
    )
    assert result["messageHumanness"] < 0.5


def test_verbatim_repeat_reduces_score():
    classify_message("test", "repeater", "buy cheap products now", 100.0)
    result = classify_message("test", "repeater", "buy cheap products now", 100.0)
    rep_signal = next(s for s in result["signals"] if s["key"] == "repetition")
    assert rep_signal["score"] < 0.1


def test_trust_grows_with_human_messages():
    first = classify_message("test", "good_user", "just got back from the gym", 3000.0)
    for i in range(5):
        classify_message("test", "good_user", f"message number {i} about my day", 2800.0 + i * 100)
    last = classify_message("test", "good_user", "going to bed now goodnight", 2500.0)
    assert last["trust"] >= first["trust"]


def test_trust_decays_with_bot_messages():
    first = classify_message("test", "spammer", "hello world", 2000.0)
    for _ in range(5):
        classify_message(
            "test", "spammer",
            "Click here to verify your account: http://verify.example/login",
            45.0
        )
    last = classify_message(
        "test", "spammer",
        "FREE gift card waiting for you, act now: http://promo.example/gift",
        45.0
    )
    assert last["trust"] < first["trust"]


# --- Signal unit tests ---

def test_score_typing_normal_speed():
    score, _ = score_typing("hello world", 2200.0, [])
    assert score > 0.5  # ~5 cps is normal human


def test_score_typing_impossible_speed():
    score, _ = score_typing("a very long message that was typed", 10.0, [])
    assert score < 0.2  # Way too fast


def test_score_content_spam():
    score, _ = score_content("Click here to verify your account: http://verify.example/login")
    assert score < 0.3


def test_score_content_normal():
    score, _ = score_content("honestly that meeting ran way over again")
    assert score > 0.7


def test_score_repetition_first_message():
    score, _ = score_repetition("hello", [])
    assert score == 0.7


def test_score_repetition_verbatim():
    score, _ = score_repetition("same message", ["same message"])
    assert score < 0.1


def test_score_rhythm_insufficient():
    score, _ = score_rhythm([], [])
    assert score == 0.6
