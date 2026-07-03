"""Real-time per-message bot/human classifier.

Every message is scored on 5 signals. Running EMA drives trust.
"""
from __future__ import annotations

import math
import re
import statistics
import threading
import time
from collections import deque

from app.config import (
    EMA_ALPHA, LIVE_BASE_TRUST, SPAM_HINTS,
    WEIGHT_TYPING, WEIGHT_CONTENT, WEIGHT_REPETITION, WEIGHT_RHYTHM, WEIGHT_AI_TEXT,
)
from app.services.trust_engine import (
    advance_evidence, evidence_for_trust, trust_from_evidence, tier_for, FLOOR_TRUST,
)

_WORD_RE = re.compile(r"[a-z0-9']+")
_FLOOR_E = evidence_for_trust(FLOOR_TRUST)


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _bump(x: float, center: float, width: float) -> float:
    return math.exp(-((x - center) / width) ** 2)


def _logistic(x: float, x0: float, k: float) -> float:
    try:
        return 1.0 / (1.0 + math.exp(-k * (x - x0)))
    except OverflowError:
        return 0.0 if x < x0 else 1.0


def _cv(xs: list[float]) -> float:
    if len(xs) < 2:
        return 0.0
    m = statistics.fmean(xs)
    return statistics.pstdev(xs) / abs(m) if m else 0.0


def _words(text: str) -> list[str]:
    return _WORD_RE.findall(text.lower())


def _jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


# --- Signal scoring ---

def score_typing(text: str, typing_ms: float, cps_history: list[float]) -> tuple[float, str]:
    if typing_ms <= 0 or not text:
        return 0.5, "no typing data"
    cps = len(text) / (typing_ms / 1000.0)
    if cps > 15.0:
        return _clamp01(0.05), f"{cps:.0f} chars/s - pasted instantly (bot tell)"
    s = _bump(cps, 4.5, 3.5)
    if cps < 0.6:
        s *= 0.7
    # Check for suspiciously constant typing speed
    if len(cps_history) >= 2:
        cv = _cv(cps_history + [cps])
        if cv < 0.06:
            s = _clamp01(s * 0.35)
            return _clamp01(s), f"{cps:.1f} chars/s; CV={cv:.3f} (constant speed)"
    return _clamp01(s), f"{cps:.1f} chars/s"


def score_content(text: str) -> tuple[float, str]:
    tl = text.lower()
    words = _words(text)
    has_link = "http" in tl or "www." in tl
    spam_hits = sum(1 for h in SPAM_HINTS if h in tl)
    uniq = (len(set(words)) / len(words)) if words else 0.0
    s = 0.30 + 0.70 * uniq
    if has_link:
        s -= 0.60
    s -= 0.18 * spam_hits
    note = "natural language"
    if has_link and spam_hits:
        note = f"link + {spam_hits} spam phrase(s)"
    elif has_link:
        note = "contains a link"
    elif spam_hits:
        note = f"{spam_hits} spam phrase(s)"
    return _clamp01(s), note


def score_repetition(text: str, prev_texts: list[str]) -> tuple[float, str]:
    if not prev_texts:
        return 0.7, "first message"
    norm = text.strip().lower()
    if any(norm == p.strip().lower() for p in prev_texts):
        return 0.04, "verbatim repeat"
    cur = set(_words(text))
    best = max((_jaccard(cur, set(_words(p))) for p in prev_texts), default=0.0)
    return _clamp01(1.0 - best), f"{best * 100:.0f}% word overlap"


def score_rhythm(intervals: list[float], lengths: list[float]) -> tuple[float, str]:
    if len(intervals) < 2:
        return 0.6, "insufficient history"
    iv_cv = _cv(intervals)
    len_cv = _cv(lengths)
    s = 0.7 * _logistic(iv_cv, 0.45, 5.0) + 0.3 * _logistic(len_cv, 0.30, 8.0)
    return _clamp01(s), f"timing CV={iv_cv:.2f}, length CV={len_cv:.2f}"


# --- Participant state ---

class Participant:
    def __init__(self, name: str) -> None:
        self.name = name
        self.texts: list[str] = []
        self.recv_ts: list[float] = []
        self.lengths: list[float] = []
        self.cps_history: list[float] = []
        self.evidence = evidence_for_trust(LIVE_BASE_TRUST)
        self.humanness = 0.5
        self.msg_count = 0

    def trust(self) -> int:
        return trust_from_evidence(self.evidence)

    def ingest(self, text: str, typing_ms: float, ai_score: float, now: float) -> dict:
        trust_before = self.trust()
        intervals = [b - a for a, b in zip(self.recv_ts, self.recv_ts[1:])]

        s_type, n_type = score_typing(text, typing_ms, self.cps_history)
        s_cont, n_cont = score_content(text)
        s_rep, n_rep = score_repetition(text, list(self.texts[-20:]))
        s_rhy, n_rhy = score_rhythm(intervals[-20:], self.lengths[-20:])
        s_ai = _clamp01(1.0 - ai_score)  # invert: 1=human, 0=AI
        n_ai = f"P(AI)={ai_score:.2f}"

        signals = [
            {"key": "typing", "label": "Typing speed", "score": round(s_type, 3), "weight": WEIGHT_TYPING, "detail": n_type},
            {"key": "content", "label": "Content", "score": round(s_cont, 3), "weight": WEIGHT_CONTENT, "detail": n_cont},
            {"key": "repetition", "label": "Repetition", "score": round(s_rep, 3), "weight": WEIGHT_REPETITION, "detail": n_rep},
            {"key": "rhythm", "label": "Rhythm", "score": round(s_rhy, 3), "weight": WEIGHT_RHYTHM, "detail": n_rhy},
            {"key": "ai_text", "label": "AI Text", "score": round(s_ai, 3), "weight": WEIGHT_AI_TEXT, "detail": n_ai},
        ]
        wsum = sum(s["weight"] for s in signals)
        h_msg = sum(s["weight"] * s["score"] for s in signals) / wsum

        self.humanness = (1 - EMA_ALPHA) * self.humanness + EMA_ALPHA * h_msg
        self.evidence = advance_evidence(self.evidence, self.humanness)

        cps = len(text) / (typing_ms / 1000.0) if typing_ms > 0 else None
        self.texts.append(text)
        self.recv_ts.append(now)
        self.lengths.append(len(text))
        if cps is not None:
            self.cps_history.append(cps)
        self.msg_count += 1

        trust_after = self.trust()
        return {
            "messageHumanness": round(h_msg, 4),
            "humanness": round(self.humanness, 4),
            "verdict": "Human" if self.humanness >= 0.5 else "Bot",
            "confidence": round(abs(self.humanness - 0.5) * 200),
            "trust": trust_after,
            "trustBefore": trust_before,
            "trustDelta": trust_after - trust_before,
            "tier": tier_for(trust_after),
            "cps": round(cps, 1) if cps is not None else None,
            "signals": signals,
            "pAI": round(ai_score, 4),
        }


# --- Room management ---

class Room:
    def __init__(self, room_id: str) -> None:
        self.id = room_id
        self.participants: dict[str, Participant] = {}
        self.feed: deque = deque(maxlen=500)
        self.seq = 0

    def participant(self, name: str) -> Participant:
        if name not in self.participants:
            self.participants[name] = Participant(name)
        return self.participants[name]


_LOCK = threading.Lock()
_ROOMS: dict[str, Room] = {}


def _room(room_id: str) -> Room:
    if room_id not in _ROOMS:
        _ROOMS[room_id] = Room(room_id)
    return _ROOMS[room_id]


def classify_message(room_id: str, sender: str, text: str, typing_ms: float, ai_score: float = 0.0) -> dict:
    """Classify an incoming live message and return full result."""
    now = time.time()
    with _LOCK:
        room = _room(room_id)
        p = room.participant(sender)
        result = p.ingest(text, typing_ms, ai_score, now)
        room.seq += 1
        event = {
            "seq": room.seq,
            "ts": now,
            "room": room_id,
            "sender": sender,
            "text": text,
            "typingMs": round(typing_ms),
            "msgIndex": p.msg_count,
            **result,
        }
        room.feed.append(event)
        return event


def get_participants(room_id: str) -> list[dict]:
    """Get all participants in a room with their current verdicts."""
    with _LOCK:
        room = _room(room_id)
        out = []
        for p in room.participants.values():
            out.append({
                "name": p.name,
                "verdict": "Human" if p.humanness >= 0.5 else "Bot",
                "confidence": round(abs(p.humanness - 0.5) * 200),
                "humanness": round(p.humanness, 4),
                "trust": p.trust(),
                "tier": tier_for(p.trust()),
                "messages": p.msg_count,
            })
        return sorted(out, key=lambda x: x["trust"], reverse=True)


def reset_room(room_id: str) -> None:
    """Reset a room's state."""
    with _LOCK:
        if room_id in _ROOMS:
            del _ROOMS[room_id]
