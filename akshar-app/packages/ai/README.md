# akshar-ai

Akshar Protocol AI Detection & Trust Service — live bot detection, Tier-1 behavioural analysis, StyleDistance AI-text detection, GRU drift scoring, and moderator dashboard.

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
