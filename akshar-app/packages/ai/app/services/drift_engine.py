"""GRU Conversational Drift Detection — detects conversations drifting toward violations."""
from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

from app.config import DRIFT_THRESHOLD
from app.services.style_detector import embed_text

logger = logging.getLogger("akshar.ai")


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors."""
    dot = float(np.dot(a, b))
    norm = float(np.linalg.norm(a) * np.linalg.norm(b))
    return dot / (norm + 1e-8)


# --- Anchor centroids (loaded once) ---
_anchor_violation: Optional[np.ndarray] = None
_anchor_clean: Optional[np.ndarray] = None
_anchors_loaded = False


def load_anchors() -> bool:
    """Compute anchor centroids from reference phrases using StyleDistance."""
    global _anchor_violation, _anchor_clean, _anchors_loaded

    violation_phrases = [
        "avoiding receipts and paperwork for a sale",
        "moving stolen or untraceable goods off platform",
        "cash only in person to avoid records",
    ]
    clean_phrases = [
        "a normal conversation about a book or movie",
        "discussing fictional events like a heist in a story",
        "ordinary licensed retail transaction with documentation",
    ]

    vecs_v = [embed_text(p) for p in violation_phrases]
    vecs_c = [embed_text(p) for p in clean_phrases]

    if any(v is None for v in vecs_v) or any(v is None for v in vecs_c):
        logger.warning("Cannot load drift anchors — StyleDistance model unavailable")
        return False

    _anchor_violation = np.mean(vecs_v, axis=0)
    _anchor_clean = np.mean(vecs_c, axis=0)
    _anchors_loaded = True
    logger.info("Drift anchors loaded successfully")
    return True


# --- Per-conversation state ---

@dataclass
class ConversationState:
    conversation_id: str
    turn_count: int = 0
    cumulative_risk: float = 0.0
    flagged: bool = False
    flagged_at_turn: Optional[int] = None
    srcs_score: float = 0.0
    framing_vector: Optional[np.ndarray] = None
    operational_vector: Optional[np.ndarray] = None


_LOCK = threading.Lock()
_CONVERSATIONS: dict[str, ConversationState] = {}


def _get_state(conversation_id: str) -> ConversationState:
    if conversation_id not in _CONVERSATIONS:
        _CONVERSATIONS[conversation_id] = ConversationState(conversation_id=conversation_id)
    return _CONVERSATIONS[conversation_id]


def score_drift(conversation_id: str, text: str) -> dict:
    """Score one conversation turn for policy drift.

    Returns DriftScoreResult dict.
    """
    if not _anchors_loaded:
        return {
            "turn": 0,
            "anchorDrift": 0.0,
            "gruReadout": 0.0,
            "cumulativeRisk": 0.0,
            "srcsContradiction": 0.0,
            "flagged": False,
            "method": "disabled",
        }

    turn_vector = embed_text(text)
    if turn_vector is None:
        return {
            "turn": 0,
            "anchorDrift": 0.0,
            "gruReadout": 0.0,
            "cumulativeRisk": 0.0,
            "srcsContradiction": 0.0,
            "flagged": False,
            "method": "error",
        }

    with _LOCK:
        state = _get_state(conversation_id)
        state.turn_count += 1

        # --- Anchor-similarity scoring ---
        sim_v = _cosine(turn_vector, _anchor_violation)
        sim_c = _cosine(turn_vector, _anchor_clean)
        # Squash difference to [0, 1]
        drift_signal = 1.0 / (1.0 + np.exp(-8.0 * (sim_v - sim_c)))
        drift_signal = float(drift_signal)

        # --- Cumulative risk (EMA) ---
        state.cumulative_risk = 0.55 * state.cumulative_risk + 0.45 * drift_signal
        state.cumulative_risk = min(1.0, state.cumulative_risk)

        # --- SRCS: Self-Referential Contradiction Scoring ---
        if state.framing_vector is None:
            state.framing_vector = turn_vector.copy()
            state.operational_vector = turn_vector.copy()
        else:
            state.operational_vector = 0.5 * state.operational_vector + 0.5 * turn_vector

        sim_framing = _cosine(state.framing_vector, state.operational_vector)
        contradiction_raw = (1.0 - sim_framing) / 2.0
        state.srcs_score = 0.55 * state.srcs_score + 0.45 * contradiction_raw
        state.srcs_score = min(1.0, state.srcs_score)

        # --- Flagging ---
        method: Optional[str] = None
        if not state.flagged:
            if state.cumulative_risk >= DRIFT_THRESHOLD:
                state.flagged = True
                state.flagged_at_turn = state.turn_count
                method = "anchor"
            elif state.srcs_score >= DRIFT_THRESHOLD:
                state.flagged = True
                state.flagged_at_turn = state.turn_count
                method = "srcs"

        return {
            "turn": state.turn_count,
            "anchorDrift": round(drift_signal, 4),
            "gruReadout": round(drift_signal, 4),  # simplified: using drift signal directly
            "cumulativeRisk": round(state.cumulative_risk, 4),
            "srcsContradiction": round(state.srcs_score, 4),
            "flagged": state.flagged,
            "method": method or ("anchor" if state.flagged else "none"),
        }


def get_conversation_risk(conversation_id: str) -> dict:
    """Get overall risk for a conversation."""
    with _LOCK:
        state = _get_state(conversation_id)
        return {
            "conversationId": conversation_id,
            "turnCount": state.turn_count,
            "cumulativeRisk": round(state.cumulative_risk, 4),
            "srcsScore": round(state.srcs_score, 4),
            "flagged": state.flagged,
            "flaggedAtTurn": state.flagged_at_turn,
        }


def get_flagged_conversations() -> list[dict]:
    """Get all flagged conversations."""
    with _LOCK:
        return [
            {
                "conversationId": s.conversation_id,
                "turnCount": s.turn_count,
                "cumulativeRisk": round(s.cumulative_risk, 4),
                "flaggedAtTurn": s.flagged_at_turn,
            }
            for s in _CONVERSATIONS.values()
            if s.flagged
        ]


def reset_conversation(conversation_id: str) -> None:
    """Reset drift state for a conversation."""
    with _LOCK:
        if conversation_id in _CONVERSATIONS:
            del _CONVERSATIONS[conversation_id]
