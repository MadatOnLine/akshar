"""Core authentication business logic — enrollment, face login, biometric login."""
from __future__ import annotations

import secrets
import time
from datetime import datetime, timezone

from app.config import (
    FACE_MATCH_THRESHOLD,
    ENROLLMENT_TIMEOUT,
    LIVENESS_MAX_RETRIES,
)
from app.db.couch_client import db
from app.models.entities import (
    EnrollmentAttempt,
    EnrollmentStatus,
    User,
    UserStatus,
    UserTier,
)
from app.services import liveness_service, session_service, trust_store
from app.services.rate_limiter import rate_limiter


# --- In-memory enrollment store (CouchDB for production persistence) ---
_enrollments: dict[str, EnrollmentAttempt] = {}


def _hamming_distance(a: str, b: str) -> int:
    """Compute Hamming distance between two 16-hex-char face hashes."""
    try:
        va = int(a, 16)
        vb = int(b, 16)
        xor = va ^ vb
        return bin(xor).count("1")
    except (ValueError, TypeError):
        return 64


async def initiate_enrollment(name: str, device_id: str) -> dict:
    """Start a new face enrollment attempt."""
    # Check no existing user with same device
    existing = await db.find(
        {"type": "user", "deviceId": device_id, "status": "active"}, limit=1
    )
    if existing:
        raise ValueError(
            "This browser already has an account — use Log in with face instead. "
            "If login keeps failing, use Reset browser below."
        )

    attempt_id = secrets.token_hex(16)
    challenge = liveness_service.generate_challenge()
    now = time.time()

    attempt = EnrollmentAttempt(
        attemptId=attempt_id,
        name=name,
        deviceId=device_id,
        challenge=challenge,
        retriesRemaining=LIVENESS_MAX_RETRIES,
        status=EnrollmentStatus.awaiting_liveness,
        createdAt=now,
        expiresAt=now + ENROLLMENT_TIMEOUT,
    )
    _enrollments[attempt_id] = attempt

    return {
        "attemptId": attempt_id,
        "challenge": {
            "challengeId": challenge.challengeId,
            "action": challenge.action.value,
            "timeout": challenge.timeout,
        },
    }


async def _finalize_enrollment(attempt: EnrollmentAttempt, face_hash: str, attempt_id: str) -> dict:
    """Create user, trust state, and session after liveness checks pass."""
    all_users = await db.find({"type": "user", "status": "active"}, limit=1000)
    for user_doc in all_users:
        existing_hash = user_doc.get("faceHash", "")
        if _hamming_distance(face_hash, existing_hash) <= FACE_MATCH_THRESHOLD:
            raise ValueError(
                "Face already enrolled — use Log in with face instead of creating a new account"
            )

    user_id = secrets.token_hex(16)
    now_iso = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "userId": user_id,
        "name": attempt.name,
        "faceHash": face_hash,
        "deviceId": attempt.deviceId,
        "createdAt": now_iso,
        "updatedAt": now_iso,
        "status": UserStatus.active.value,
        "tier": UserTier.larva.value,
        "type": "user",
    }
    await db.put(f"user:{user_id}", user_doc)
    await trust_store.create_initial_trust(user_id, now_iso)

    from app.services import tier2_service
    try:
        await tier2_service.refresh_integrity(user_id)
    except Exception:
        pass

    session_data = await session_service.issue_session(user_id, attempt.deviceId)

    attempt.status = EnrollmentStatus.complete
    del _enrollments[attempt_id]

    return {
        "userId": user_id,
        "token": session_data["token"],
        "refreshToken": session_data["refreshToken"],
    }


async def validate_liveness_and_complete(
    attempt_id: str, challenge_id: str, face_hash: str
) -> dict:
    """Validate liveness challenge and complete enrollment if passed."""
    attempt = _enrollments.get(attempt_id)
    if not attempt:
        raise ValueError("Enrollment attempt not found")

    # Check not expired
    if time.time() > attempt.expiresAt:
        attempt.status = EnrollmentStatus.failed
        raise ValueError("Enrollment attempt expired")

    # Validate challenge
    if not attempt.challenge or attempt.challenge.challengeId != challenge_id:
        raise ValueError("Invalid challenge ID")

    passed, reason = liveness_service.validate_challenge(attempt.challenge)

    if not passed:
        attempt.retriesRemaining -= 1
        if attempt.retriesRemaining <= 0:
            attempt.status = EnrollmentStatus.failed
            return {"passed": False, "retriesRemaining": 0, "reason": reason}

        # Issue new challenge
        new_challenge = liveness_service.generate_challenge()
        attempt.challenge = new_challenge
        return {
            "passed": False,
            "retriesRemaining": attempt.retriesRemaining,
            "reason": reason,
            "newChallenge": {
                "challengeId": new_challenge.challengeId,
                "action": new_challenge.action.value,
                "timeout": new_challenge.timeout,
            },
        }

    # Liveness passed — complete enrollment
    result = await _finalize_enrollment(attempt, face_hash, attempt_id)
    return {"passed": True, **result}


async def direct_enrollment(
    name: str,
    device_id: str,
    face_hash: str,
    attempt_id: str,
    challenge_id: str,
) -> dict:
    """Hybrid enrollment — client liveness plus mandatory server challenge gate.

    Flow: POST /auth/enroll → client hybrid liveness → POST /auth/enroll-direct.
    The server challenge prevents blind Sybil creation with synthetic hashes.
    """
    attempt = _enrollments.get(attempt_id)
    if not attempt:
        raise ValueError("Enrollment attempt not found")

    if time.time() > attempt.expiresAt:
        attempt.status = EnrollmentStatus.failed
        raise ValueError("Enrollment attempt expired")

    if attempt.name != name or attempt.deviceId != device_id:
        raise ValueError("Enrollment attempt does not match request")

    if not attempt.challenge or attempt.challenge.challengeId != challenge_id:
        raise ValueError("Invalid challenge ID")

    passed, reason = liveness_service.validate_challenge(attempt.challenge)
    if not passed:
        attempt.retriesRemaining -= 1
        if attempt.retriesRemaining <= 0:
            attempt.status = EnrollmentStatus.failed
            raise ValueError(reason)

        new_challenge = liveness_service.generate_challenge()
        attempt.challenge = new_challenge
        raise ValueError(
            f"{reason}. New challenge issued: {new_challenge.challengeId}"
        )

    return await _finalize_enrollment(attempt, face_hash, attempt_id)


async def face_login(
    face_hash: str,
    device_id: str,
    client_ip: str,
    *,
    liveness_passed: bool = False,
) -> dict:
    """Authenticate via face hash comparison."""
    # Rate limit check
    rate_key = f"ip:{client_ip}"
    if rate_limiter.is_blocked(rate_key):
        remaining = rate_limiter.remaining_lockout(rate_key)
        raise PermissionError(f"Too many attempts. Try again in {remaining}s.")

    # Find best matching face
    all_users = await db.find({"type": "user", "status": "active"}, limit=1000)
    best_user = None
    best_distance = 65

    for user_doc in all_users:
        existing_hash = user_doc.get("faceHash", "")
        dist = _hamming_distance(face_hash, existing_hash)
        if dist < best_distance:
            best_user = user_doc
            best_distance = dist

    face_recovered = False
    if best_user is None or best_distance > FACE_MATCH_THRESHOLD:
        device_user = next((u for u in all_users if u.get("deviceId") == device_id), None)
        if device_user and liveness_passed:
            # Same browser — face hash can drift with lighting/camera; refresh after liveness.
            best_user = device_user
            best_user["faceHash"] = face_hash
            best_user["updatedAt"] = datetime.now(timezone.utc).isoformat()
            await db.put(f"user:{best_user['userId']}", best_user)
            best_distance = 0
            face_recovered = True
        else:
            rate_limiter.record_failure(rate_key)
            raise ValueError(
                "Face not recognised — try again with even lighting, facing the camera. "
                "If this browser was reset, use Reset browser below then create a new account."
            )

    if best_user.get("status") == "banned":
        raise PermissionError("Account suspended")

    user_id = best_user["userId"]
    stored_device = best_user.get("deviceId")
    device_rebound = False
    if stored_device != device_id:
        # Web demo: face match is primary — re-bind ephemeral browser deviceId
        best_user["deviceId"] = device_id
        best_user["updatedAt"] = datetime.now(timezone.utc).isoformat()
        await db.put(f"user:{user_id}", best_user)
        device_rebound = True

    # Success
    rate_limiter.record_success(rate_key)
    session_data = await session_service.issue_session(user_id, device_id)

    from app.services import tier2_service
    try:
        touch = await tier2_service.touch_tier2b_on_login(
            user_id,
            face_hash,
            device_id,
            best_distance,
            device_rebound=device_rebound,
            liveness_passed=liveness_passed or face_recovered,
        )
        risk = await tier2_service.get_risk_status(user_id)
    except Exception:
        touch = {}
        risk = {"requiresRiskCheck": False, "riskReason": ""}

    return {
        **session_data,
        "name": best_user["name"],
        "distance": best_distance,
        "deviceRebound": device_rebound,
        "requiresRiskCheck": risk.get("requiresRiskCheck", False),
        "riskReason": risk.get("riskReason", ""),
    }


async def biometric_login(device_id: str, biometric_token: str, client_ip: str) -> dict:
    """Authenticate via device-native biometric token."""
    # Rate limit check
    rate_key = f"ip:{client_ip}"
    if rate_limiter.is_blocked(rate_key):
        remaining = rate_limiter.remaining_lockout(rate_key)
        raise PermissionError(f"Too many attempts. Try again in {remaining}s.")

    # Look up user by device
    users = await db.find(
        {"type": "user", "deviceId": device_id, "status": "active"}, limit=1
    )
    if not users:
        rate_limiter.record_failure(rate_key)
        raise ValueError("Device not recognized")

    user_doc = users[0]

    # MVP: trust the biometric token if non-empty
    # Production: verify the token signature against the device's public key
    if not biometric_token:
        rate_limiter.record_failure(rate_key)
        raise ValueError("Invalid biometric token")

    # Success
    rate_limiter.record_success(rate_key)
    return await session_service.issue_session(user_doc["userId"], device_id)
