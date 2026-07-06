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

# --- Embedding Models (two separate spaces, never concatenated) ---
# Style space: captures HOW text is written (768-dim)
STYLE_MODEL_NAME: str = os.getenv("STYLE_MODEL_NAME", "StyleDistance/styledistance")
# Semantic space: captures WHAT the text is about (384-dim)
SEMANTIC_MODEL_NAME: str = os.getenv("SEMANTIC_MODEL_NAME", "BAAI/bge-small-en-v1.5")

# --- Two-Step Detection Pipeline Artifacts ---
# Directory holding the trained classifiers produced by training/train_pipeline.py
# (or the notebook). If the artifacts are absent the service degrades gracefully.
ML_MODELS_DIR: str = os.getenv("ML_MODELS_DIR", "ml_models")

# Primary format: a single bundle produced by training — a dict with keys
# style_rf / sem_rf / meta_lr / style_model / sem_model / threshold. Loaded first;
# if absent the loader falls back to the individual-file layout below.
DETECTOR_BUNDLE_PATH: str = os.getenv(
    "DETECTOR_BUNDLE_PATH", os.path.join(ML_MODELS_DIR, "detector_v1.pkl")
)

# Step 1 — binary ensemble (Human vs Bot)
RF_STYLE_PATH: str = os.path.join(ML_MODELS_DIR, "rf_style_binary.pkl")
RF_SEMANTIC_PATH: str = os.path.join(ML_MODELS_DIR, "rf_semantic_binary.pkl")
META_LEARNER_PATH: str = os.path.join(ML_MODELS_DIR, "meta_learner.pkl")
# Step 2 — multiclass bot-family classifier (style space only)
BOT_FAMILY_PATH: str = os.path.join(ML_MODELS_DIR, "rf_bot_family.pkl")
LABEL_ENCODER_PATH: str = os.path.join(ML_MODELS_DIR, "label_encoder.pkl")
MANIFEST_PATH: str = os.path.join(ML_MODELS_DIR, "manifest.json")

# Legacy single-classifier path (kept for backward compatibility; unused by the
# new pipeline).
CLASSIFIER_PATH: str = os.getenv("CLASSIFIER_PATH", os.path.join(ML_MODELS_DIR, "classifier.pkl"))

# --- Spam Detection ---
SPAM_HINTS: tuple = (
    "http", "www.", ".com/", ".example", "click here", "claim now", "act now",
    "limited offer", "limited time", "verify your account", "free", "winner",
    "won a prize", "congratulations", "make $", "/week", "work from home",
    "followers", "buy cheap", "business proposal", "discount", "promo code",
    "subscribe", "dm me", "link in bio", "100%", "guaranteed",
)
