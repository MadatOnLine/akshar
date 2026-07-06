#!/usr/bin/env python3
"""Train the two-step AI-detection pipeline and export artifacts for akshar-ai.

This is the deployable, script form of ``AI_detection_new_pipeline.ipynb``. It
reproduces the same architecture and writes the trained classifiers into the
``ml_models/`` directory the FastAPI service loads at startup.

Architecture
------------
Step 1 — Binary (Human vs Bot), two SEPARATE embedding spaces:
    StyleDistance (768d) -> RandomForest -> P_style(bot)
    BGE           (384d) -> RandomForest -> P_sem(bot)
    LogisticRegression meta-learner on [P_style, P_sem] -> P(bot)
Step 2 — Multiclass (which bot family), StyleDistance space only:
    RandomForest -> {ChatGPT, DeepSeek, Gemini, Grok}

Usage
-----
    python training/train_pipeline.py \
        --ai-csv AI_Generated.csv \
        --human-csv human_wikipedia.csv \
        --out ml_models

Outputs (into --out):
    rf_style_binary.pkl, rf_semantic_binary.pkl, meta_learner.pkl,
    rf_bot_family.pkl, label_encoder.pkl, manifest.json
"""
from __future__ import annotations

import argparse
import json
import os
import re
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.preprocessing import LabelEncoder

STYLE_MODEL_NAME = "StyleDistance/styledistance"
SEMANTIC_MODEL_NAME = "BAAI/bge-small-en-v1.5"

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")


# --------------------------------------------------------------------------- #
# Data loading
# --------------------------------------------------------------------------- #
def load_dataset(ai_csv: str, human_csv: str) -> pd.DataFrame:
    """Combine the multi-model AI dataset with human rows into one labeled frame."""
    ai_raw = pd.read_csv(ai_csv)
    ai_df = ai_raw[["Model", "Model_Version", "Topic", "Generated"]].copy()
    ai_df = ai_df.rename(columns={"Generated": "text", "Model": "model_source"})
    ai_df["label"] = "bot"
    ai_df["label_fine"] = ai_df["model_source"]

    human_raw = pd.read_csv(human_csv)
    human_df = human_raw[["text", "topic"]].rename(columns={"topic": "Domain"})
    human_df = human_df.dropna().reset_index(drop=True)

    n_ai = len(ai_df)
    if len(human_df) > n_ai:
        human_df = human_df.sample(n=n_ai, random_state=42).reset_index(drop=True)

    human_df["label"] = "human"
    human_df["label_fine"] = "Human"
    human_df["model_source"] = "Human"

    cols = ["text", "label", "label_fine", "model_source"]
    full = pd.concat([ai_df[cols], human_df[cols]], ignore_index=True)
    full = full.dropna(subset=["text"]).reset_index(drop=True)
    return full


# --------------------------------------------------------------------------- #
# Embedding
# --------------------------------------------------------------------------- #
def _split_sentences(text: str) -> list[str]:
    chunks = [c.strip() for c in _SENT_SPLIT.split(str(text).strip()) if c.strip()]
    return chunks or [str(text)]


def chunk_embed_semantic(sem_model: SentenceTransformer, texts, batch_size: int = 32) -> np.ndarray:
    """Document embedding via sentence-chunking + mean pooling (normalized)."""
    doc_embs = []
    for text in texts:
        chunks = _split_sentences(text)
        embs = sem_model.encode(
            chunks, batch_size=batch_size, normalize_embeddings=True, show_progress_bar=False
        )
        doc = embs.mean(axis=0)
        norm = np.linalg.norm(doc)
        doc_embs.append(doc / norm if norm > 0 else doc)
    return np.vstack(doc_embs)


# --------------------------------------------------------------------------- #
# Training
# --------------------------------------------------------------------------- #
def train(full_df: pd.DataFrame, out_dir: str, eval_loo: bool = True) -> dict:
    print("\nLoading StyleDistance (768-dim, style space)...")
    style_model = SentenceTransformer(STYLE_MODEL_NAME)
    print("Loading BGE (384-dim, semantic space)...")
    sem_model = SentenceTransformer(SEMANTIC_MODEL_NAME)

    print("\nEmbedding through StyleDistance...")
    X_style = style_model.encode(
        full_df["text"].tolist(), normalize_embeddings=True, show_progress_bar=True
    )
    print("Embedding through BGE (semantic chunking)...")
    X_sem = chunk_embed_semantic(sem_model, full_df["text"].tolist())

    y_binary = (full_df["label"] == "bot").astype(int).values
    le = LabelEncoder()
    le.fit(full_df["label_fine"].values)
    print(f"\nFine-grained classes: {list(le.classes_)}")

    metrics: dict = {}

    # --- Optional honest evaluation (Leave-One-Out) ---
    if eval_loo:
        loo = LeaveOneOut()
        p_style_loo = cross_val_predict(
            RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42, n_jobs=-1),
            X_style, y_binary, cv=loo, method="predict_proba",
        )[:, 1]
        p_sem_loo = cross_val_predict(
            RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42, n_jobs=-1),
            X_sem, y_binary, cv=loo, method="predict_proba",
        )[:, 1]
        X_meta_loo = np.column_stack([p_style_loo, p_sem_loo])
        p_meta_loo = cross_val_predict(
            LogisticRegression(random_state=42), X_meta_loo, y_binary,
            cv=loo, method="predict_proba",
        )[:, 1]
        preds = (p_meta_loo >= 0.5).astype(int)
        cm = confusion_matrix(y_binary, preds)
        fp_rate = cm[0, 1] / (cm[0, 0] + cm[0, 1]) if (cm[0, 0] + cm[0, 1]) else 0.0
        metrics["binary_loo_accuracy"] = round(float(accuracy_score(y_binary, preds)), 4)
        metrics["binary_loo_fp_rate"] = round(float(fp_rate), 4)
        print(f"\nStep 1 (LOO): accuracy={metrics['binary_loo_accuracy']}  "
              f"fp_rate={metrics['binary_loo_fp_rate']}")

    # --- Fit deployment models on all data ---
    rf_style = RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42, n_jobs=-1)
    rf_sem = RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42, n_jobs=-1)
    rf_style.fit(X_style, y_binary)
    rf_sem.fit(X_sem, y_binary)

    p_style_full = rf_style.predict_proba(X_style)[:, 1]
    p_sem_full = rf_sem.predict_proba(X_sem)[:, 1]
    meta_clf = LogisticRegression(random_state=42)
    meta_clf.fit(np.column_stack([p_style_full, p_sem_full]), y_binary)

    # --- Step 2: bot-family classifier (AI rows only, style space) ---
    ai_mask = (full_df["label"] == "bot").values
    y_ai_fine = le.transform(full_df.loc[ai_mask, "label_fine"].values)
    bot_family_clf = RandomForestClassifier(
        n_estimators=200, max_depth=6, random_state=42, n_jobs=-1
    )
    bot_family_clf.fit(X_style[ai_mask], y_ai_fine)

    # --- Persist ---
    os.makedirs(out_dir, exist_ok=True)

    # Primary artifact: single-file bundle the service loads (Step 1, binary).
    joblib.dump(
        {
            "style_rf": rf_style,
            "sem_rf": rf_sem,
            "meta_lr": meta_clf,
            "style_model": STYLE_MODEL_NAME,
            "sem_model": SEMANTIC_MODEL_NAME,
            "threshold": 0.5,
        },
        os.path.join(out_dir, "detector_v1.pkl"),
    )

    # Also emit the individual files (legacy layout + optional Step-2 family model).
    joblib.dump(rf_style, os.path.join(out_dir, "rf_style_binary.pkl"))
    joblib.dump(rf_sem, os.path.join(out_dir, "rf_semantic_binary.pkl"))
    joblib.dump(meta_clf, os.path.join(out_dir, "meta_learner.pkl"))
    joblib.dump(bot_family_clf, os.path.join(out_dir, "rf_bot_family.pkl"))
    joblib.dump(le, os.path.join(out_dir, "label_encoder.pkl"))

    manifest = {
        "version": datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S"),
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "style_model": STYLE_MODEL_NAME,
        "semantic_model": SEMANTIC_MODEL_NAME,
        "style_dim": int(X_style.shape[1]),
        "semantic_dim": int(X_sem.shape[1]),
        "n_rows": int(len(full_df)),
        "n_human": int((~ai_mask).sum()),
        "n_bot": int(ai_mask.sum()),
        "bot_families": [c for c in le.classes_ if c != "Human"],
        "classes": list(le.classes_),
        "metrics": metrics,
        "artifacts": [
            "detector_v1.pkl", "rf_style_binary.pkl", "rf_semantic_binary.pkl",
            "meta_learner.pkl", "rf_bot_family.pkl", "label_encoder.pkl",
        ],
    }
    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nSaved pipeline artifacts to {out_dir}/")
    for a in manifest["artifacts"] + ["manifest.json"]:
        print(f"  - {a}")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ai-csv", default="AI_Generated.csv",
                        help="Multi-model AI dataset CSV (needs Model/Model_Version/Topic/Generated).")
    parser.add_argument("--human-csv", default="human_wikipedia.csv",
                        help="Human dataset CSV (needs text/topic columns).")
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "ml_models"),
                        help="Output directory for artifacts (default: ../ml_models).")
    parser.add_argument("--no-eval", action="store_true",
                        help="Skip Leave-One-Out evaluation (faster).")
    args = parser.parse_args()

    full_df = load_dataset(args.ai_csv, args.human_csv)
    print(f"Dataset: {len(full_df)} rows")
    print(full_df["label_fine"].value_counts().to_string())

    out_dir = os.path.abspath(args.out)
    train(full_df, out_dir, eval_loo=not args.no_eval)


if __name__ == "__main__":
    main()
