# akshar-ai

Akshar Protocol AI Detection & Trust Service — live bot detection, Tier-1 behavioural analysis, two-step StyleDistance + BGE AI-text detection, GRU drift scoring, and moderator dashboard.

## AI-Text Detection Pipeline

Detection uses a two-step ensemble over two **separate** embedding spaces
(never concatenated):

- **Step 1 — Human vs Bot (production model).** StyleDistance (768d) → RF and
  BGE (384d) → RF each predict `P(bot)`; a logistic-regression meta-learner
  combines them and compares against a trained threshold. Ships as the single
  bundle [`ml_models/detector_v1.pkl`](ml_models/detector_v1.pkl).
- **Step 2 — Which bot family (optional).** If a StyleDistance-only RF is present,
  flagged text is additionally labelled `ChatGPT / DeepSeek / Gemini / Grok`.

The model is loaded from [`ml_models/`](ml_models/) and produced by
[`training/`](training/) (notebook or `train_pipeline.py`). **If it is missing
the service still runs** — AI detection returns a neutral score and
`GET /ai/health` reports `"pipelineReady": false`. To enable real detection,
add `detector_v1.pkl` (see `training/README.md`) and restart.

## Integration & performance

The model runs **server-side** in this service — the mobile app never loads it. The
`mesh` service calls `POST /ai/classify-message` per message, asynchronously.

- The models are **warmed up at startup** (one throwaway inference) so the first
  real request isn't slow from a cold encode.
- The mesh aborts the classify call after `AI_TIMEOUT` ms (default **500**, which is
  too short for two transformer encodes). Set `AI_TIMEOUT=5000` for the mesh service
  — the compose file already does this. The call is non-blocking, so a longer budget
  doesn't delay message delivery; it just lets the model's answer actually arrive.

## Quick Start

```bash
cd akshar-app/packages/ai
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export SERVICE_API_KEY="your-internal-key"
export JWT_SECRET="your-secret-minimum-32-chars"
export COUCHDB_URL="http://127.0.0.1:5984"

uvicorn app.main:app --port 8002
```

## API Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/ai/classify-message` | Service Key | Real-time per-message classification (5 signals) |
| GET | `/ai/participants/{roomId}` | Service Key | Get participants with verdicts |
| GET | `/ai/trust/{userId}` | JWT | Get trust score and tier |
| POST | `/ai/analyze-profile/{userId}` | Service Key | Tier-1 batch analysis (8 checks) |
| POST | `/ai/drift-score` | Service Key | Score conversation turn for drift |
| GET | `/ai/drift/{conversationId}` | Service Key | Get conversation risk state |
| GET | `/ai/flagged-conversations` | Service Key | List flagged conversations |
| GET | `/ai/dashboard` | Admin | Moderator platform health |
| POST | `/ai/threshold` | Admin | Update detection thresholds |
| POST | `/ai/ban` | Admin | Ban a user |
| GET | `/ai/health` | None | Health check |

## Testing

```bash
source .venv/bin/activate
pip install pytest pytest-asyncio hypothesis
pytest tests/ -v
```
