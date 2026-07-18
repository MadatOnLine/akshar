"""Tests for opaque Tier 3 Colony graduation."""
from __future__ import annotations

from app.config import TIER3_TRUST_MIN
from app.services.tier3_service import compute_progress, evaluate_gates, public_tier3_view


def test_gates_pass_when_healthy():
    assert evaluate_gates(
        trust_score=TIER3_TRUST_MIN,
        age_days=0,
        integrity_humanness=0.7,
        activity_volume=10,
        valid_reports=0,
        qualifying_reports=0,
        requires_risk=False,
        nullifier_ok=True,
    ) is True


def test_gates_fail_on_risk():
    assert evaluate_gates(
        trust_score=TIER3_TRUST_MIN + 1000,
        age_days=100,
        integrity_humanness=0.9,
        activity_volume=50,
        valid_reports=0,
        qualifying_reports=0,
        requires_risk=True,
        nullifier_ok=True,
    ) is False


def test_gates_fail_on_low_trust():
    assert evaluate_gates(
        trust_score=max(0, TIER3_TRUST_MIN - 1),
        age_days=100,
        integrity_humanness=0.9,
        activity_volume=50,
        valid_reports=0,
        qualifying_reports=0,
        requires_risk=False,
        nullifier_ok=True,
    ) is False


def test_likely_human_not_enough_for_tier3():
    """Trust 4000+ is Likely Human, but Tier 3 needs the higher Colony threshold."""
    assert evaluate_gates(
        trust_score=4000,
        age_days=100,
        integrity_humanness=0.9,
        activity_volume=50,
        valid_reports=0,
        qualifying_reports=0,
        requires_risk=False,
        nullifier_ok=True,
    ) is False


def test_no_age_wait_for_tier3():
    """Account age is not a hard gate — high trust + healthy integrity can unlock early."""
    assert evaluate_gates(
        trust_score=TIER3_TRUST_MIN,
        age_days=1,
        integrity_humanness=0.9,
        activity_volume=50,
        valid_reports=0,
        qualifying_reports=0,
        requires_risk=False,
        nullifier_ok=True,
    ) is True


def test_public_view_hides_metrics():
    view = public_tier3_view({"status": "progressing", "progress": 0.5})
    assert view["status"] == "progressing"
    assert "gates" not in view
    assert "metrics" not in view
    assert "progress" not in view
    assert view["progressHint"] in ("low", "medium", "high")
    assert "Building" in view["label"] or "verification" in view["message"].lower()


def test_public_colony_view():
    view = public_tier3_view({"status": "colony", "progress": 1.0})
    assert view["status"] == "colony"
    assert view["progressHint"] == "complete"
    assert "Fully verified" in view["label"]


def test_progress_increases_with_signals():
    low = compute_progress(
        trust_score=1000,
        age_days=0,
        integrity_humanness=0.2,
        activity_volume=0,
        community=0,
    )
    high = compute_progress(
        trust_score=TIER3_TRUST_MIN,
        age_days=90,
        integrity_humanness=0.9,
        activity_volume=40,
        community=0.8,
    )
    assert 0 <= low < high <= 1.0
