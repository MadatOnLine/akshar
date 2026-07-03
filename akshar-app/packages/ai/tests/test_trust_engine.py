"""Tests for the trust engine — logarithmic scoring, evidence accumulation."""
from __future__ import annotations

import pytest
from hypothesis import given, strategies as st

from app.services.trust_engine import (
    trust_from_evidence, evidence_for_trust, tier_for, advance_evidence,
)
from app.config import MAX_TRUST, E_MAX, FLOOR_TRUST


def test_trust_at_zero_evidence():
    assert trust_from_evidence(0.0) == 0


def test_trust_at_max_evidence():
    assert trust_from_evidence(E_MAX) == MAX_TRUST


def test_trust_at_tier0_evidence():
    e = evidence_for_trust(1000)
    t = trust_from_evidence(e)
    assert abs(t - 1000) <= 1  # allow rounding


def test_trust_monotonically_increasing():
    prev = 0
    for e in range(0, 61):
        t = trust_from_evidence(float(e))
        assert t >= prev
        prev = t


def test_tier_classification():
    assert tier_for(0) == "Low Trust / Suspect"
    assert tier_for(999) == "Low Trust / Suspect"
    assert tier_for(1000) == "Provisional"
    assert tier_for(3999) == "Provisional"
    assert tier_for(4000) == "Likely Human"
    assert tier_for(7499) == "Likely Human"
    assert tier_for(7500) == "Trusted Human"
    assert tier_for(10000) == "Trusted Human"


def test_advance_evidence_human_grows():
    e_before = 10.0
    e_after = advance_evidence(e_before, 0.8)
    assert e_after > e_before


def test_advance_evidence_bot_decays():
    e_before = 30.0
    e_after = advance_evidence(e_before, 0.2)
    assert e_after < e_before


def test_advance_evidence_exact_threshold_no_change():
    e_before = 10.0
    e_after = advance_evidence(e_before, 0.5)
    # At exactly 0.5, human-like with zero delta → evidence unchanged
    assert e_after == e_before


def test_evidence_never_exceeds_max():
    e = E_MAX
    for _ in range(100):
        e = advance_evidence(e, 1.0)
    assert e <= E_MAX


def test_evidence_never_below_floor():
    e = evidence_for_trust(FLOOR_TRUST)
    for _ in range(100):
        e = advance_evidence(e, 0.0)
    # Should asymptote at floor, never go below
    assert trust_from_evidence(e) >= FLOOR_TRUST - 5  # small tolerance


@given(st.floats(min_value=0.0, max_value=E_MAX))
def test_pbt_trust_bounded(evidence):
    t = trust_from_evidence(evidence)
    assert 0 <= t <= MAX_TRUST


@given(st.floats(min_value=0.0, max_value=1.0))
def test_pbt_advance_preserves_bounds(humanness):
    e = 30.0
    e_new = advance_evidence(e, humanness)
    assert 0.0 <= e_new <= E_MAX


@given(st.floats(min_value=0.5, max_value=1.0))
def test_pbt_human_always_grows(humanness):
    e = 20.0
    e_new = advance_evidence(e, humanness)
    assert e_new >= e


@given(st.floats(min_value=0.0, max_value=0.49))
def test_pbt_bot_always_decays(humanness):
    e = 30.0
    e_new = advance_evidence(e, humanness)
    assert e_new <= e
