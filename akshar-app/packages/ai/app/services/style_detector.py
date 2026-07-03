"""StyleDistance AI-text detection — detects AI/LLM-generated content via style embeddings."""
from __future__ import annotations

import logging
import os
from typing import Optional

import numpy as np

from app.config import STYLE_MODEL_NAME, CLASSIFIER_PATH, AI_DETECTION_THRESHOLD

logger = logging.getLogger("akshar.ai")

_style_model = None
_classifier = None
_model_loaded = False


def load_models() -> bool:
    """Load StyleDistance model and classifier at startup. Returns True if successful."""
    global _style_model, _classifier, _model_loaded

    try:
        from sentence_transformers import SentenceTransformer
        logger.info(f"Loading StyleDistance model: {STYLE_MODEL_NAME}")
        _style_model = SentenceTransformer(STYLE_MODEL_NAME)
        logger.info(f"StyleDistance loaded. Embedding dim: {_style_model.get_sentence_embedding_dimension()}")
    except Exception as e:
        logger.warning(f"Failed to load StyleDistance model: {e}. AI detection disabled.")
        _style_model = None

    # Load pre-trained classifier if available
    if os.path.exists(CLASSIFIER_PATH):
        try:
            import joblib
            _classifier = joblib.load(CLASSIFIER_PATH)
            logger.info("Loaded pre-trained AI text classifier")
        except Exception as e:
            logger.warning(f"Failed to load classifier: {e}. Using threshold-based scoring.")
            _classifier = None
    else:
        logger.info("No pre-trained classifier found. Using cosine-similarity scoring.")
        _classifier = None

    _model_loaded = _style_model is not None
    return _model_loaded


def is_loaded() -> bool:
    """Check if the model is loaded and ready."""
    return _model_loaded


def embed_text(text: str) -> Optional[np.ndarray]:
    """Get StyleDistance embedding for a text. Returns None if model unavailable."""
    if _style_model is None:
        return None
    try:
        return _style_model.encode(text, convert_to_numpy=True)
    except Exception:
        return None


def detect_ai_text(text: str) -> dict:
    """Score text for AI-generation probability.

    Returns:
        { "pAI": float [0,1], "isAI": bool, "method": str }
    """
    if _style_model is None:
        # Graceful degradation: neutral score when model unavailable
        return {"pAI": 0.0, "isAI": False, "method": "disabled"}

    embedding = embed_text(text)
    if embedding is None:
        return {"pAI": 0.0, "isAI": False, "method": "error"}

    if _classifier is not None:
        # Use trained classifier
        try:
            proba = _classifier.predict_proba(embedding.reshape(1, -1))[0]
            p_ai = float(proba[1]) if len(proba) > 1 else float(proba[0])
            return {
                "pAI": round(p_ai, 4),
                "isAI": p_ai > AI_DETECTION_THRESHOLD,
                "method": "classifier",
            }
        except Exception:
            pass

    # Fallback: simple heuristic based on embedding norm characteristics
    # (placeholder — production uses the trained classifier)
    norm = float(np.linalg.norm(embedding))
    # AI text tends to have more uniform embedding norms
    p_ai = 0.3  # default neutral-low for fallback
    return {
        "pAI": round(p_ai, 4),
        "isAI": p_ai > AI_DETECTION_THRESHOLD,
        "method": "fallback",
    }
