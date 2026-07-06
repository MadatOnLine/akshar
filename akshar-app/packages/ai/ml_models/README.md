# ml_models/

Trained artifacts for AI-text detection. The `akshar-ai` service loads these at
startup; if they are absent it degrades gracefully (AI-text detection returns a
neutral score, everything else keeps working).

## Primary artifact — `detector_v1.pkl`

A single joblib bundle (a dict) the service loads first:

| Key | Type | Role |
|---|---|---|
| `style_rf` | RandomForest (768d) | Step 1 — P(bot) from StyleDistance |
| `sem_rf` | RandomForest (384d) | Step 1 — P(bot) from BGE |
| `meta_lr` | LogisticRegression (2 inputs) | Step 1 — final P(bot) |
| `style_model` | str | StyleDistance model name to load |
| `sem_model` | str | BGE model name to load |
| `threshold` | float | `isAI` decision threshold |

This is the production model: **Human vs Bot** (binary). When `pAI > threshold`
the message is flagged as AI.

## Optional Step-2 files (which bot family)

If present, the service adds a `botFamily` label (ChatGPT/DeepSeek/Gemini/Grok):

- `rf_bot_family.pkl`, `label_encoder.pkl`

The individual `rf_style_binary.pkl` / `rf_semantic_binary.pkl` /
`meta_learner.pkl` files are also written by the training script as a legacy
fallback layout, but `detector_v1.pkl` takes precedence.

## How to (re)generate

- **Colab** — run `training/AI_detection_new_pipeline.ipynb`; the export cell
  downloads `akshar_ml_models.zip` (contains `detector_v1.pkl`). Unzip here.
- **Locally** — `python training/train_pipeline.py --ai-csv <ai>.csv --human-csv <human>.csv`

See `training/README.md` for details.
