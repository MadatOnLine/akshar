"""Tests for risk-based Tier 2b gating."""
from __future__ import annotations

from app.config import RISK_REPORT_COUNT_THRESHOLD, RISK_TRUST_THRESHOLD, TIER0_BASE_TRUST
from app.services import risk_service
from app.services.tier2_trust import evidence_for_trust


def test_new_account_not_at_risk():
    doc = {
        "evidence": evidence_for_trust(TIER0_BASE_TRUST),
        "tier2b": {"lastLivenessPassed": True},
        "tier2": {"status": "at_risk"},
    }
    assert risk_service.requires_risk_check(doc, trust_score=1000, qualifying_reports=0) is False


def test_low_trust_triggers_risk():
    doc = {"tier2b": {"lastLivenessPassed": False}, "tier2": {}}
    assert risk_service.requires_risk_check(
        doc, trust_score=RISK_TRUST_THRESHOLD - 1, qualifying_reports=0
    ) is True


def test_verified_user_not_at_risk_even_with_low_trust():
    doc = {"tier2b": {"lastLivenessPassed": True}, "tier2": {}}
    assert risk_service.requires_risk_check(
        doc, trust_score=RISK_TRUST_THRESHOLD - 1, qualifying_reports=0
    ) is False


def test_qualifying_reports_trigger_risk():
    doc = {"tier2b": {"lastLivenessPassed": False}, "tier2": {}}
    assert risk_service.requires_risk_check(
        doc, trust_score=5000, qualifying_reports=RISK_REPORT_COUNT_THRESHOLD
    ) is True


def test_few_reports_no_risk():
    doc = {"tier2b": {"lastLivenessPassed": False}, "tier2": {}}
    assert risk_service.requires_risk_check(
        doc, trust_score=5000, qualifying_reports=1
    ) is False
