"""Tests for the two-step AI-text detection wiring.

Uses real (tiny) sklearn classifiers but stubs the heavy embedding models, so it
runs without torch / sentence-transformers / network access.
"""
from __future__ import annotations

import numpy as np
import pytest

import app.services.style_detector as sd

STYLE_DIM, SEM_DIM = 768, 384


@pytest.fixture
def reset_detector():
    """Snapshot and restore module globals around each test."""
    keys = ["_style_model", "_sem_model", "_rf_style", "_rf_sem", "_meta_clf",
            "_bot_family_clf", "_label_encoder", "_model_loaded", "_pipeline_ready"]
    saved = {k: getattr(sd, k) for k in keys}
    for k in keys:
        setattr(sd, k, None)
    sd._model_loaded = False
    sd._pipeline_ready = False
    yield sd
    for k, v in saved.items():
        setattr(sd, k, v)


def _fit_pipeline():
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import LabelEncoder

    rng = np.random.default_rng(0)
    n = 40

    def norm(x):
        return x / np.linalg.norm(x, axis=1, keepdims=True)

    X_style = norm(np.vstack([rng.normal(0, 1, (n, STYLE_DIM)),
                              rng.normal(2, 1, (n, STYLE_DIM))]))
    X_sem = norm(np.vstack([rng.normal(0, 1, (n, SEM_DIM)),
                            rng.normal(2, 1, (n, SEM_DIM))]))
    y = np.array([0] * n + [1] * n)
    families = np.array(["Human"] * n + ["ChatGPT", "Grok", "Gemini", "DeepSeek"] * (n // 4))

    rf_style = RandomForestClassifier(n_estimators=50, random_state=42).fit(X_style, y)
    rf_sem = RandomForestClassifier(n_estimators=50, random_state=42).fit(X_sem, y)
    meta = LogisticRegression().fit(
        np.column_stack([rf_style.predict_proba(X_style)[:, 1],
                         rf_sem.predict_proba(X_sem)[:, 1]]), y)
    le = LabelEncoder().fit(families)
    ai = y == 1
    fam = RandomForestClassifier(n_estimators=50, random_state=42).fit(
        X_style[ai], le.transform(families[ai]))
    return rf_style, rf_sem, meta, fam, le, rng


class _FakeStyle:
    def __init__(self, rng):
        self.rng = rng

    def encode(self, text, convert_to_numpy=True, normalize_embeddings=True):
        base = 2.0 if "bot" in text else 0.0
        v = self.rng.normal(base, 0.3, STYLE_DIM)
        return v / np.linalg.norm(v)


class _FakeSem:
    def __init__(self, rng):
        self.rng = rng

    def encode(self, chunks, normalize_embeddings=True, show_progress_bar=False,
               convert_to_numpy=True):
        base = 2.0 if any("bot" in c for c in chunks) else 0.0
        return self.rng.normal(base, 0.3, (len(chunks), SEM_DIM))


def _install(sd_mod):
    rf_style, rf_sem, meta, fam, le, rng = _fit_pipeline()
    sd_mod._style_model = _FakeStyle(rng)
    sd_mod._sem_model = _FakeSem(rng)
    sd_mod._rf_style = rf_style
    sd_mod._rf_sem = rf_sem
    sd_mod._meta_clf = meta
    sd_mod._bot_family_clf = fam
    sd_mod._label_encoder = le
    sd_mod._model_loaded = True
    sd_mod._pipeline_ready = True


def test_disabled_when_no_embedding_model(reset_detector):
    """No embedding model -> neutral, never flags."""
    r = reset_detector.detect_ai_text("hello world")
    assert r["method"] == "disabled"
    assert r["pAI"] == 0.0 and r["isAI"] is False


def test_fallback_when_pipeline_missing(reset_detector):
    """Embeddings present but classifiers missing -> conservative fallback."""
    rng = np.random.default_rng(1)
    reset_detector._style_model = _FakeStyle(rng)
    reset_detector._model_loaded = True
    reset_detector._pipeline_ready = False
    r = reset_detector.detect_ai_text("hello world")
    assert r["method"] == "fallback"
    assert r["isAI"] is False


def test_ensemble_flags_bot_text(reset_detector):
    _install(reset_detector)
    r = reset_detector.detect_ai_text("this is bot bot bot generated text.")
    assert r["method"] == "ensemble"
    assert r["pAI"] > 0.5 and r["isAI"] is True
    assert r["botFamily"] in ("ChatGPT", "Grok", "Gemini", "DeepSeek")
    assert 0.0 <= r["pStyle"] <= 1.0 and 0.0 <= r["pSemantic"] <= 1.0


def test_ensemble_passes_human_text(reset_detector):
    _install(reset_detector)
    r = reset_detector.detect_ai_text("a calm human sentence about books.")
    assert r["method"] == "ensemble"
    assert r["pAI"] < 0.5 and r["isAI"] is False
    assert r["botFamily"] is None


def test_pipeline_ready_flag(reset_detector):
    assert reset_detector.pipeline_ready() is False
    _install(reset_detector)
    assert reset_detector.pipeline_ready() is True


def test_real_bundle_loads(reset_detector):
    """The committed detector_v1.pkl must load and expose the expected shape."""
    import os

    from app.config import DETECTOR_BUNDLE_PATH

    if not os.path.exists(DETECTOR_BUNDLE_PATH):
        import pytest
        pytest.skip("detector_v1.pkl not present")

    style_name, sem_name = reset_detector._load_classifiers()
    assert reset_detector._rf_style.n_features_in_ == 768   # StyleDistance
    assert reset_detector._rf_sem.n_features_in_ == 384     # BGE
    assert reset_detector._meta_clf.n_features_in_ == 2     # [P_style, P_sem]
    assert 0.0 < reset_detector._threshold <= 1.0
    assert isinstance(style_name, str) and isinstance(sem_name, str)
