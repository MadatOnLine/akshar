"""Configuration for akshar-ai service."""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

# --- Server ---
HOST: str = os.getenv("AI_HOST", "0.0.0.0")
PORT: int = int(os.getenv("AI_PORT", "8002"))
DEBUG: bool = os.getenv("AI_DEBUG", "0") == "1"

# --- CouchDB ---
COUCHDB_URL: str = os.getenv("COUCHDB_URL", "http://127.0.0.1:5984")
COUCHDB_USER: str = os.getenv("COUCHDB_USER", "admin")
COUCHDB_PASSWORD: str = os.getenv("COUCHDB_PASSWORD", "admin")
COUCHDB_TRUST_DB: str = os.getenv("COUCHDB_TRUST_DB", "akshar_trust")
COUCHDB_CONFIG_DB: str = os.getenv("COUCHDB_CONFIG_DB", "akshar_config")

# --- Auth ---
JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production-minimum-32-chars!")
JWT_ALGORITHM: str = "HS256"
SERVICE_API_KEY: str = os.getenv("SERVICE_API_KEY", "akshar-internal-key-change-in-production")
AUTH_SERVICE_URL: str = os.getenv("AUTH_SERVICE_URL", "http://127.0.0.1:8001")

# --- Trust Engine ---
MAX_TRUST: int = 10_000
E_MAX: float = 60.0
K: float = 0.6
STEP: float = 9.0
DECAY_RATE: float = 0.45
FLOOR_TRUST: int = 100
LIVE_BASE_TRUST: int = 1000
TIER0_BASE_TRUST: int = 1000

# --- Detection Thresholds (configurable at runtime) ---
BOT_THRESHOLD: float = float(os.getenv("BOT_THRESHOLD", "0.5"))
DRIFT_THRESHOLD: float = float(os.getenv("DRIFT_THRESHOLD", "0.70"))
AI_DETECTION_THRESHOLD: float = float(os.getenv("AI_DETECTION_THRESHOLD", "0.75"))

# --- Live Engine ---
EMA_ALPHA: float = 0.55

# --- Signal Weights ---
WEIGHT_TYPING: float = 1.0
WEIGHT_CONTENT: float = 1.3
WEIGHT_REPETITION: float = 0.9
WEIGHT_RHYTHM: float = 0.6
WEIGHT_AI_TEXT: float = 0.8

# --- Tier-1 ---
TIER1_INTERVAL: int = int(os.getenv("TIER1_INTERVAL", "86400"))

# --- Tier-2 (person-binding / re-auth) ---
TIER2_REAUTH_INTERVAL_SEC: int = int(os.getenv("TIER2_REAUTH_INTERVAL_SEC", "120"))
TIER2_FACE_MATCH_THRESHOLD: int = int(os.getenv("TIER2_FACE_MATCH_THRESHOLD", "14"))
TIER2_BOOST_HUMANNESS: float = 0.85
TIER2_OVERDUE_HUMANNESS: float = 0.15

# --- StyleDistance Model ---
STYLE_MODEL_NAME: str = os.getenv("STYLE_MODEL_NAME", "StyleDistance/styledistance")
CLASSIFIER_PATH: str = os.getenv("CLASSIFIER_PATH", "ml_models/classifier.pkl")

# --- Spam Detection ---
SPAM_HINTS: tuple = (
    "http", "www.", ".com/", ".example", "click here", "claim now", "act now",
    "limited offer", "limited time", "verify your account", "free", "winner",
    "won a prize", "congratulations", "make $", "/week", "work from home",
    "followers", "buy cheap", "business proposal", "discount", "promo code",
    "subscribe", "dm me", "link in bio", "100%", "guaranteed",
)
