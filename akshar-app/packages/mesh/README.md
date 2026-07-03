# akshar-mesh

Akshar Protocol P2P Messaging & Data Resilience Service — real-time encrypted messaging, groups, feed, blind vaults, anomaly detection, onion-routed recovery, and exponential Hydra replication.

## Quick Start

```bash
cd akshar-app/packages/mesh
npm install
npm run dev   # uses tsx for development

# Or build + run
npm run build
npm start
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MESH_PORT` | 8003 | Server port |
| `COUCHDB_URL` | `http://admin:admin@127.0.0.1:5984` | CouchDB connection |
| `JWT_SECRET` | (change-me) | Must match akshar-auth |
| `SERVICE_API_KEY` | (change-me) | For akshar-ai calls |
| `AI_SERVICE_URL` | `http://127.0.0.1:8002` | akshar-ai endpoint |
| `NODE_ID` | `mesh-node-1` | This node's identifier |

## API Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/mesh/relay` | Onion (implicit) | Onion routing relay |
| POST | `/mesh/groups` | JWT | Create group |
| GET | `/mesh/groups` | JWT | List user's groups |
| GET | `/mesh/groups/:id` | JWT | Get group details |
| POST | `/mesh/share` | JWT | Share to feed |
| GET | `/mesh/feed` | JWT | Get feed posts |
| POST | `/mesh/feed/:id/react` | JWT | Like/dislike/share |
| GET | `/mesh/health` | None | Health check |

## WebSocket Events

Connect with Socket.IO: `io('ws://localhost:8003', { auth: { token: 'jwt...' } })`

**Client → Server:** `join-room`, `send-message`, `publish-key`, `share-to-feed`
**Server → Client:** `new-message`, `peer-key`, `backlog`, `ANOMALY_DETECTED`, `RECOVERY_COMPLETE`

## Testing

```bash
npm test
```
