# Training — Two-Step AI Detection Pipeline

This directory holds the research notebook and a deployable training script for
the detector the `akshar-ai` service runs.

## Architecture

**Step 1 — Human vs Bot (binary ensemble).** Two *separate* embedding spaces,
never concatenated:

```
text ──> StyleDistance (768d) ──> RandomForest ──> P_style(bot) ┐
    └──> BGE           (384d) ──> RandomForest ──> P_sem(bot)  ┘──> LogReg meta-learner ──> P(bot)
```

**Step 2 — Which bot family (multiclass).** StyleDistance space only (bot
families differ in *how* they write): `RandomForest → {ChatGPT, DeepSeek,
Gemini, Grok}`.

## Files

- `AI_detection_new_pipeline.ipynb` — the Colab research notebook (plots + export).
- `train_pipeline.py` — standalone script that trains and exports artifacts.
- `requirements-train.txt` — extra deps for training (adds `pandas`).

## Input data

Two CSVs (the same ones used in Colab):

- **AI dataset** — columns `Model`, `Model_Version`, `Topic`, `Generated`.
  The `Generated` column (raw model output) is used as the bot text.
- **Human dataset** — columns `text`, `topic`.

## Produce the model artifacts

### Option A — Colab (recommended, your data is already there)

1. Open `AI_detection_new_pipeline.ipynb` in Colab.
2. Upload `AI_Generated.csv` and `human_wikipedia.csv` to `/content/`.
3. Run the pipeline cell (trains + shows plots), then the **export** cell.
4. It downloads `akshar_ml_models.zip` (the key file is **`detector_v1.pkl`**).
   Unzip it into `akshar-app/packages/ai/ml_models/` and commit the `.pkl` files.

The service loads `detector_v1.pkl` — a bundle of `{style_rf, sem_rf, meta_lr,
style_model, sem_model, threshold}`. That single file is all Step-1 detection
needs.

### Option B — Locally

```bash
cd akshar-app/packages/ai
pip install -r requirements.txt -r training/requirements-train.txt
python training/train_pipeline.py \
    --ai-csv path/to/AI_Generated.csv \
    --human-csv path/to/human_wikipedia.csv \
    --out ml_models
```

Either way, once `ml_models/` contains the artifacts, restart the service and
`GET /ai/health` reports `"pipelineReady": true`.

> **Note on scale:** the proof-of-concept dataset is ~48 rows (6 per model).
> Step 1 separates cleanly; Step 2 (bot family) is directional at this size.
> Add more rows per class to harden it.
