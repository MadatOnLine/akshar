"""Application configuration — loaded from environment variables with sensible defaults."""
from __future__ import annotations

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
