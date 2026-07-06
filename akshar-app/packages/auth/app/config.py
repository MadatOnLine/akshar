"""Application configuration — loaded from environment variables with sensible defaults."""
from __future__ import annotations

import math
import os

from dotenv import load_dotenv

load_dotenv()


# --- Server ---
HOST: str = os.getenv("AUTH_HOST", "0.0.0.0")
PORT: int = int(os.getenv("AUTH_PORT", "8001"))
DEBUG: bool = os.getenv("AUTH_DEBUG", "0") == "1"

# --- CouchDB ---
COUCHDB_URL: str = os.getenv("COUCHDB_URL", "http://127.0.0.1:5984")
COUCHDB_USER: str = os.getenv("COUCHDB_USER", "admin")
COUCHDB_PASSWORD: str = os.getenv("COUCHDB_PASSWORD", "admin")
COUCHDB_DATABASE: str = os.getenv("COUCHDB_DATABASE", "akshar_users")
COUCHDB_TRUST_DB: str = os.getenv("COUCHDB_TRUST_DB", "akshar_trust")

# --- JWT ---
JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production-minimum-32-chars!")
JWT_ALGORITHM: str = "HS256"
SESSION_EXPIRY_HOURS: int = int(os.getenv("SESSION_EXPIRY_HOURS", "24"))
REFRESH_EXPIRY_DAYS: int = int(os.getenv("REFRESH_EXPIRY_DAYS", "30"))

# --- Face Matching ---
FACE_MATCH_THRESHOLD: int = int(os.getenv("FACE_MATCH_THRESHOLD", "14"))

# --- Liveness ---
LIVENESS_TIMEOUT: int = int(os.getenv("LIVENESS_TIMEOUT", "15"))
LIVENESS_MAX_RETRIES: int = int(os.getenv("LIVENESS_MAX_RETRIES", "3"))

# --- Rate Limiting ---
RATE_LIMIT_MAX_ATTEMPTS: int = int(os.getenv("RATE_LIMIT_MAX_ATTEMPTS", "5"))
RATE_LIMIT_WINDOW: int = int(os.getenv("RATE_LIMIT_WINDOW", "60"))
RATE_LIMIT_LOCKOUT: int = int(os.getenv("RATE_LIMIT_LOCKOUT", "300"))

# --- Enrollment ---
ENROLLMENT_TIMEOUT: int = int(os.getenv("ENROLLMENT_TIMEOUT", "300"))

# --- Trust ---
TIER0_BASE_TRUST: int = int(os.getenv("TIER0_BASE_TRUST", "1000"))

# Constants mirrored from packages/ai/app/config.py — keep in sync for Tier-0 seeding.
_TRUST_MAX = 10_000
_TRUST_E_MAX = 60.0
_TRUST_K = 0.6
_TRUST_DENOM = math.log1p(_TRUST_K * _TRUST_E_MAX)


def tier0_evidence() -> float:
    """Evidence that yields TIER0_BASE_TRUST under the shared logarithmic trust curve."""
    target = max(0.0, min(float(_TRUST_MAX), float(TIER0_BASE_TRUST)))
    return math.expm1(target / _TRUST_MAX * _TRUST_DENOM) / _TRUST_K
