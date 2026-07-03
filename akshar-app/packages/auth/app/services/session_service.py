"""JWT session management — issuance, validation, refresh, logout."""
from __future__ import annotations

import secrets
import time
from datetime import datetime, timezone, timedelta

import jwt

from app.config import JWT_SECRET, JWT_ALGORITHM, SESSION_EXPIRY_HOURS, REFRESH_EXPIRY_DAYS
from app.db.couch_client import db
from app.models.entities import Session


async def issue_session(user_id: str, device_id: str) -> dict:
    """Create a new session and return tokens."""
    session_id = secrets.token_hex(16)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=SESSION_EXPIRY_HOURS)
    refresh_expires = now + timedelta(days=REFRESH_EXPIRY_DAYS)
    refresh_token = secrets.token_hex(64)

    # Create JWT
    token = jwt.encode(
        {
            "sub": user_id,
            "sid": session_id,
            "iat": int(now.timestamp()),
            "exp": int(expires_at.timestamp()),
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )

    # Persist session to CouchDB
    session_doc = {
        "sessionId": session_id,
        "userId": user_id,
        "issuedAt": now.isoformat(),
        "expiresAt": expires_at.isoformat(),
        "refreshToken": refresh_token,
        "refreshExpiresAt": refresh_expires.isoformat(),
        "invalidated": False,
        "deviceId": device_id,
        "type": "session",
    }
    await db.put(f"session:{session_id}", session_doc)

    return {
        "token": token,
        "refreshToken": refresh_token,
        "expiresAt": expires_at.isoformat(),
        "userId": user_id,
        "sessionId": session_id,
    }


async def validate_session(token: str) -> dict | None:
    """Validate a JWT token. Returns user info or None."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return None

    session_id = payload.get("sid")
    user_id = payload.get("sub")
    if not session_id or not user_id:
        return None

    # Check session not invalidated
    session_doc = await db.get(f"session:{session_id}")
    if not session_doc or session_doc.get("invalidated"):
        return None

    # Check user still active
    user_doc = await db.get(f"user:{user_id}")
    if not user_doc or user_doc.get("status") != "active":
        return None

    return {
        "valid": True,
        "userId": user_id,
        "tier": user_doc.get("tier", "larva"),
    }


async def refresh_session(refresh_token: str) -> dict | None:
    """Refresh a session using the refresh token. Returns new tokens or None."""
    # Find session by refresh token
    docs = await db.find({
        "type": "session",
        "refreshToken": refresh_token,
        "invalidated": False,
    }, limit=1)

    if not docs:
        return None

    session_doc = docs[0]
    now = datetime.now(timezone.utc)

    # Check refresh not expired
    refresh_expires = datetime.fromisoformat(session_doc["refreshExpiresAt"])
    if now > refresh_expires:
        return None

    # Invalidate old session
    session_doc["invalidated"] = True
    await db.put(session_doc["_id"], session_doc)

    # Issue new session
    return await issue_session(session_doc["userId"], session_doc["deviceId"])


async def logout(token: str) -> bool:
    """Invalidate the session associated with this token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return False

    session_id = payload.get("sid")
    if not session_id:
        return False

    session_doc = await db.get(f"session:{session_id}")
    if not session_doc:
        return False

    session_doc["invalidated"] = True
    await db.put(f"session:{session_id}", session_doc)
    return True
