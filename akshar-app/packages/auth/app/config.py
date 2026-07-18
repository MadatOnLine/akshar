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
COUCHDB_FEED_DB: str = os.getenv("COUCHDB_FEED_DB", "akshar_feed")
COUCHDB_VAULT_DB: str = os.getenv("COUCHDB_VAULT_DB", "akshar_vault")
COUCHDB_GROUPS_DB: str = os.getenv("COUCHDB_GROUPS_DB", "akshar_groups")

# --- JWT ---
JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production-minimum-32-chars!")
JWT_ALGORITHM: str = "HS256"
SESSION_EXPIRY_HOURS: int = int(os.getenv("SESSION_EXPIRY_HOURS", "24"))
REFRESH_EXPIRY_DAYS: int = int(os.getenv("REFRESH_EXPIRY_DAYS", "30"))

# --- Face Matching ---
FACE_MATCH_THRESHOLD: int = int(os.getenv("FACE_MATCH_THRESHOLD", "14"))

# --- Risk verification (Tier 2b step-up) ---
RISK_TRUST_THRESHOLD: int = int(os.getenv("RISK_TRUST_THRESHOLD", "1000"))
RISK_REPORT_COUNT_THRESHOLD: int = int(os.getenv("RISK_REPORT_COUNT_THRESHOLD", "3"))
REPORTER_MIN_TRUST_SCORE: int = int(os.getenv("REPORTER_MIN_TRUST_SCORE", "4000"))

# --- Liveness ---
LIVENESS_TIMEOUT: int = int(os.getenv("LIVENESS_TIMEOUT", "15"))
LIVENESS_MAX_RETRIES: int = int(os.getenv("LIVENESS_MAX_RETRIES", "3"))
LIVENESS_MIN_ELAPSED: float = float(os.getenv("LIVENESS_MIN_ELAPSED", "1.0"))

# --- Rate Limiting ---
RATE_LIMIT_MAX_ATTEMPTS: int = int(os.getenv("RATE_LIMIT_MAX_ATTEMPTS", "5"))
RATE_LIMIT_WINDOW: int = int(os.getenv("RATE_LIMIT_WINDOW", "60"))
RATE_LIMIT_LOCKOUT: int = int(os.getenv("RATE_LIMIT_LOCKOUT", "300"))

# --- Enrollment ---
ENROLLMENT_TIMEOUT: int = int(os.getenv("ENROLLMENT_TIMEOUT", "300"))

# --- Trust ---
TIER0_BASE_TRUST: int = int(os.getenv("TIER0_BASE_TRUST", "1000"))

# --- Tier-2 (person-binding / periodic re-auth) ---
TIER2_REAUTH_INTERVAL_SEC: int = int(os.getenv("TIER2_REAUTH_INTERVAL_SEC", "120"))
TIER2_FACE_MATCH_THRESHOLD: int = int(os.getenv("TIER2_FACE_MATCH_THRESHOLD", "14"))
TIER2_BOOST_HUMANNESS: float = float(os.getenv("TIER2_BOOST_HUMANNESS", "0.85"))
TIER2_OVERDUE_HUMANNESS: float = float(os.getenv("TIER2_OVERDUE_HUMANNESS", "0.15"))

# --- Tier-3 (passive Colony / final PoH) — thresholds stay server-side only ---
# Likely Human remains at trust >= 4000 (tier_for). Tier 3 requires higher trust.
# No minimum account-age wait — unlock when trust/integrity/other gates pass.
TIER3_TRUST_MIN: int = int(os.getenv("TIER3_TRUST_MIN", "8000"))
TIER3_AGE_DAYS_MIN: float = float(os.getenv("TIER3_AGE_DAYS_MIN", "0"))
TIER3_INTEGRITY_MIN: float = float(os.getenv("TIER3_INTEGRITY_MIN", "0.55"))
TIER3_ACTIVITY_VOLUME_MIN: float = float(os.getenv("TIER3_ACTIVITY_VOLUME_MIN", "5"))
TIER3_MAX_VALID_REPORTS: int = int(os.getenv("TIER3_MAX_VALID_REPORTS", "2"))

AI_SERVICE_URL: str = os.getenv("AI_SERVICE_URL", "http://127.0.0.1:8002")
SERVICE_API_KEY: str = os.getenv("SERVICE_API_KEY", "akshar-internal-dev-key")

# Constants mirrored from packages/ai/app/config.py — keep in sync for Tier-0 seeding.
_TRUST_MAX = 10_000
_TRUST_E_MAX = 60.0
_TRUST_K = 0.6
_TRUST_DENOM = math.log1p(_TRUST_K * _TRUST_E_MAX)


def tier0_evidence() -> float:
    """Evidence that yields TIER0_BASE_TRUST under the shared logarithmic trust curve."""
    target = max(0.0, min(float(_TRUST_MAX), float(TIER0_BASE_TRUST)))
    return math.expm1(target / _TRUST_MAX * _TRUST_DENOM) / _TRUST_K
