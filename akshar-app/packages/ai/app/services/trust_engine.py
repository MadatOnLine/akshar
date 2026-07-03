"""Logarithmic trust-score engine for Akshar.

Score lives on 0-10,000 scale. Grows logarithmically with evidence accumulation.
Human-like behaviour adds evidence; bot-like behaviour decays it.
"""
from __future__ import annotations

import math

from app.config import MAX_TRUST, E_MAX, K, STEP, DECAY_RATE, FLOOR_TRUST

_DENOM = math.log1p(K * E_MAX)
_FLOOR_E = math.expm1(FLOOR_TRUST / MAX_TRUST * _DENOM) / K


def trust_from_evidence(evidence: float) -> int:
    """Convert accumulated evidence to trust score (0-10,000)."""
    e = max(0.0, min(evidence, E_MAX))
    val = MAX_TRUST * math.log1p(K * e) / _DENOM
    return int(round(max(0.0, min(float(MAX_TRUST), val))))


def evidence_for_trust(target: float) -> float:
    """Inverse: what evidence yields a given trust value."""
    target = max(0.0, min(float(MAX_TRUST), target))
    return math.expm1(target / MAX_TRUST * _DENOM) / K


def tier_for(trust: int) -> str:
    """Classify trust score into a tier."""
    if trust >= 7500:
        return "Trusted Human"
    if trust >= 4000:
        return "Likely Human"
    if trust >= 1000:
        return "Provisional"
    return "Low Trust / Suspect"


def advance_evidence(evidence: float, humanness: float) -> float:
    """Update evidence based on humanness score.

    humanness >= 0.5: evidence grows (log rise toward cap)
    humanness < 0.5: evidence decays toward floor
    """
    if humanness >= 0.5:
        return min(E_MAX, evidence + (humanness - 0.5) * 2.0 * STEP)
    else:
        strength = (0.5 - humanness) * 2.0
        factor = 1.0 - DECAY_RATE * strength
        if evidence > _FLOOR_E:
            return _FLOOR_E + (evidence - _FLOOR_E) * factor
        return evidence
