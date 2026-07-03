# akshar-auth

Akshar Protocol Authentication & Identity Service — face enrollment, liveness verification, biometric login, and session management.

## Quick Start

```bash
cd akshar-app/packages/auth
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Set environment variables (or use .env)
export JWT_SECRET="your-secret-minimum-32-characters-long"
export COUCHDB_URL="http://127.0.0.1:5984"

# Run
uvicorn app.main:app --port 8001
```

## API Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/enroll` | None | Initiate face enrollment |
| POST | `/auth/liveness` | None | Submit liveness + complete enrollment |
| POST | `/auth/login` | None | Face hash login |
| POST | `/auth/biometric` | None | Device biometric login |
| POST | `/auth/refresh` | None | Refresh access token |
| POST | `/auth/logout` | Bearer JWT | Invalidate session |
| GET | `/auth/session/validate` | Bearer JWT | Validate token (inter-service) |
| GET | `/auth/profile/{userId}` | Bearer JWT | Get user profile |
| PATCH | `/auth/profile/{userId}` | Bearer JWT | Update profile |
| GET | `/auth/health` | None | Health check |

## Testing

```bash
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest tests/ -v
```

## Configuration

All via environment variables (see `app/config.py` for full list):

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | (change-me) | JWT signing secret |
| `COUCHDB_URL` | `http://127.0.0.1:5984` | CouchDB connection |
| `FACE_MATCH_THRESHOLD` | 14 | Max Hamming distance for face match |
| `SESSION_EXPIRY_HOURS` | 24 | Access token lifetime |
| `RATE_LIMIT_MAX_ATTEMPTS` | 5 | Failed attempts before lockout |
