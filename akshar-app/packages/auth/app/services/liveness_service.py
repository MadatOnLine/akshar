"""Liveness challenge generation and validation."""
from __future__ import annotations

import secrets
import time

from app.config import LIVENESS_TIMEOUT, LIVENESS_MAX_RETRIES, LIVENESS_MIN_ELAPSED
from app.models.entities import ChallengeAction, ChallengeStatus, LivenessChallenge

_ACTIONS = list(ChallengeAction)


def generate_challenge() -> LivenessChallenge:
    """Generate a random liveness challenge using CSPRNG."""
    action_index = secrets.randbelow(len(_ACTIONS))
    return LivenessChallenge(
        challengeId=secrets.token_hex(16),
        action=_ACTIONS[action_index],
        issuedAt=time.time(),
        timeout=LIVENESS_TIMEOUT,
        status=ChallengeStatus.pending,
    )


def validate_challenge(challenge: LivenessChallenge) -> tuple[bool, str]:
    """Check if the challenge is still valid (not expired).

    Returns (valid, reason).
    In MVP, we accept the liveness as passed if submitted within timeout.
    Production would validate actual facial action detection from frames.
    """
    now = time.time()
    elapsed = now - challenge.issuedAt

    if challenge.status != ChallengeStatus.pending:
        return False, f"Challenge already {challenge.status.value}"

    if elapsed > challenge.timeout:
        challenge.status = ChallengeStatus.expired
        return False, "Challenge expired"

    if elapsed < LIVENESS_MIN_ELAPSED:
        return False, "Challenge completed too quickly"

    # MVP: accept any submission within timeout as "passed"
    # Production: validate frames show the correct action (blink/turn/smile)
    challenge.status = ChallengeStatus.passed
    return True, "Liveness verified"
