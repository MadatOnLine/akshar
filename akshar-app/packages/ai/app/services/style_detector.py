"""Two-space AI-text detection (Human vs Bot).

Two SEPARATE embedding spaces, never concatenated:
  * StyleDistance (768-dim) -> RandomForest -> P_style(bot)
  * BGE (384-dim)           -> RandomForest -> P_sem(bot)
A logistic-regression meta-learner combines [P_style, P_sem] -> P(bot), compared
against a trained threshold to decide isAI.

The trained model ships as a single bundle (``detector_v1.pkl``) — a dict with
keys ``style_rf``, ``sem_rf``, ``meta_lr``, ``style_model``, ``sem_model`` and
``threshold``. An optional bot-family classifier (Step 2: which LLM) is loaded
from separate files if present. If nothing is available the service degrades
gracefully instead of crashing.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Optional

import numpy as np

from app.config import (
    STYLE_MODEL_NAME,
    SEMANTIC_MODEL_NAME,
    DETECTOR_BUNDLE_PATH,
    RF_STYLE_PATH,
    RF_SEMANTIC_PATH,
    META_LEARNER_PATH,
    BOT_FAMILY_PATH,
    LABEL_ENCODER_PATH,
    MANIFEST_PATH,
    AI_DETECTION_THRESHOLD,
)

logger = logging.getLogger("akshar.ai")

# --- Embedding models (frozen — only the classifiers on top are trained) ---
_style_model = None
_sem_model = None

# --- Step 1 classifiers ---
_rf_style = None
_rf_sem = None
_meta_clf = None
_threshold = AI_DETECTION_THRESHOLD

# --- Step 2 classifier (optional) ---
_bot_family_clf = None
_label_encoder = None

_manifest: dict = {}
_model_loaded = False
_pipeline_ready = False

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _load_pickle(path: str, description: str):
    """Load a joblib pickle if present. Returns the object or None."""
    if not os.path.exists(path):
        return None
    try:
        import joblib

        obj = joblib.load(path)
        logger.info(f"Loaded {description} from {path}")
        return obj
    except Exception as e:
        logger.warning(f"Failed to load {description} from {path}: {e}")
        return None


def _load_classifiers() -> tuple[str, str]:
    """Populate the Step-1 classifier globals + threshold.

    Prefers the single-file bundle; falls back to the individual-file layout.
    Returns the (style_model_name, semantic_model_name) to load embeddings for.
    """
    global _rf_style, _rf_sem, _meta_clf, _threshold

    bundle = _load_pickle(DETECTOR_BUNDLE_PATH, "detector bundle")
    if isinstance(bundle, dict) and {"style_rf", "sem_rf", "meta_lr"} <= bundle.keys():
        _rf_style = bundle["style_rf"]
        _rf_sem = bundle["sem_rf"]
        _meta_clf = bundle["meta_lr"]
        _threshold = float(bundle.get("threshold", AI_DETECTION_THRESHOLD))
        style_name = bundle.get("style_model") or STYLE_MODEL_NAME
        sem_name = bundle.get("sem_model") or SEMANTIC_MODEL_NAME
        logger.info(f"Detector bundle loaded (threshold={_threshold})")
        return style_name, sem_name

    # Fallback: individual files (train_pipeline.py legacy layout)
    _rf_style = _load_pickle(RF_STYLE_PATH, "style-space RF")
    _rf_sem = _load_pickle(RF_SEMANTIC_PATH, "semantic-space RF")
    _meta_clf = _load_pickle(META_LEARNER_PATH, "meta-learner")
    _threshold = AI_DETECTION_THRESHOLD
    return STYLE_MODEL_NAME, SEMANTIC_MODEL_NAME


def _load_sentence_transformer(name: str, description: str):
    try:
        from sentence_transformers import SentenceTransformer

        logger.info(f"Loading {description}: {name}")
        model = SentenceTransformer(name)
        logger.info(f"{description} loaded. Dim: {model.get_sentence_embedding_dimension()}")
        return model
    except Exception as e:
        logger.warning(f"Failed to load {description} ({name}): {e}")
        return None


def load_models() -> bool:
    """Load the trained classifiers and embedding models at startup.

    Returns True if at least the StyleDistance embedding model is available
    (embeddings power both drift scoring and the classifiers).
    """
    global _style_model, _sem_model, _bot_family_clf, _label_encoder
    global _manifest, _model_loaded, _pipeline_ready

    # --- Trained classifiers first (the bundle also names its embeddings) ---
    style_name, sem_name = _load_classifiers()

    # --- Embedding spaces ---
    _style_model = _load_sentence_transformer(style_name, "StyleDistance model")
    if _style_model is not None:
        _sem_model = _load_sentence_transformer(sem_name, "semantic (BGE) model")

    # --- Optional Step-2 bot-family classifier ---
    _bot_family_clf = _load_pickle(BOT_FAMILY_PATH, "bot-family RF")
    _label_encoder = _load_pickle(LABEL_ENCODER_PATH, "label encoder")

    if os.path.exists(MANIFEST_PATH):
        try:
            with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
                _manifest = json.load(f)
            logger.info(f"Loaded pipeline manifest: {_manifest.get('version', 'unknown')}")
        except Exception as e:
            logger.warning(f"Failed to read manifest {MANIFEST_PATH}: {e}")
            _manifest = {}

    _pipeline_ready = all(
        x is not None
        for x in (_style_model, _sem_model, _rf_style, _rf_sem, _meta_clf)
    )
    if _pipeline_ready:
        logger.info("AI-detection pipeline ready (ensemble mode)")
    else:
        logger.info(
            "Trained detector unavailable — AI detection running in fallback mode. "
            "Place detector_v1.pkl in ml_models/ (see training/README.md)."
        )

    _model_loaded = _style_model is not None
    return _model_loaded


def is_loaded() -> bool:
    """Whether the StyleDistance embedding model is loaded and ready."""
    return _model_loaded


def pipeline_ready() -> bool:
    """Whether the full trained ensemble is available."""
    return _pipeline_ready


def embed_text(text: str) -> Optional[np.ndarray]:
    """StyleDistance embedding for a text (normalized). None if model unavailable.

    Used by both AI detection and the drift engine.
    """
    if _style_model is None:
        return None
    try:
        return _style_model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    except Exception:
        return None


def _split_sentences(text: str) -> list[str]:
    chunks = [c.strip() for c in _SENT_SPLIT.split(str(text).strip()) if c.strip()]
    return chunks or [str(text)]


def embed_semantic(text: str) -> Optional[np.ndarray]:
    """BGE document embedding via sentence-chunking + mean pooling (normalized).

    Mirrors the training pipeline so inference matches training exactly. None if
    the semantic model is unavailable.
    """
    if _sem_model is None:
        return None
    try:
        chunks = _split_sentences(text)
        embs = _sem_model.encode(
            chunks, normalize_embeddings=True, show_progress_bar=False, convert_to_numpy=True
        )
        doc = embs.mean(axis=0)
        norm = float(np.linalg.norm(doc))
        return doc / norm if norm > 0 else doc
    except Exception:
        return None


def _predict_bot_family(style_vec: np.ndarray) -> Optional[str]:
    """Step 2 (optional): classify which bot family produced the text."""
    if _bot_family_clf is None or _label_encoder is None:
        return None
    try:
        pred = _bot_family_clf.predict(style_vec.reshape(1, -1))
        return str(_label_encoder.inverse_transform(pred)[0])
    except Exception:
        return None


def detect_ai_text(text: str) -> dict:
    """Score text for AI-generation probability using the two-space ensemble.

    Returns:
        {
          "pAI": float [0,1],        # meta-learner P(bot)
          "isAI": bool,              # pAI > trained threshold
          "method": str,             # "ensemble" | "fallback" | "disabled" | "error"
          "pStyle": float | None,    # style-space P(bot)
          "pSemantic": float | None, # semantic-space P(bot)
          "botFamily": str | None,   # only when isAI and the Step-2 model is present
        }
    """
    if _style_model is None:
        # Graceful degradation: neutral score when embeddings are unavailable.
        return {"pAI": 0.0, "isAI": False, "method": "disabled",
                "pStyle": None, "pSemantic": None, "botFamily": None}

    style_vec = embed_text(text)
    if style_vec is None:
        return {"pAI": 0.0, "isAI": False, "method": "error",
                "pStyle": None, "pSemantic": None, "botFamily": None}

    if _pipeline_ready:
        try:
            sem_vec = embed_semantic(text)
            p_style = float(_rf_style.predict_proba(style_vec.reshape(1, -1))[0][1])
            p_sem = float(_rf_sem.predict_proba(sem_vec.reshape(1, -1))[0][1])
            p_ai = float(_meta_clf.predict_proba(np.array([[p_style, p_sem]]))[0][1])
            is_ai = p_ai > _threshold
            return {
                "pAI": round(p_ai, 4),
                "isAI": is_ai,
                "method": "ensemble",
                "pStyle": round(p_style, 4),
                "pSemantic": round(p_sem, 4),
                "botFamily": _predict_bot_family(style_vec) if is_ai else None,
            }
        except Exception as e:
            logger.warning(f"Ensemble inference failed: {e}. Using fallback score.")

    # Fallback: no trained pipeline — return a neutral-low score so downstream
    # weighting stays conservative (never flags a human on a missing model).
    return {"pAI": 0.3, "isAI": False, "method": "fallback",
            "pStyle": None, "pSemantic": None, "botFamily": None}
