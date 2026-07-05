# Nomadic Parity Swarm — True P2P Messenger
## Complete Project Documentation

---

## 1. Vision & Research Foundation

The Nomadic Parity Swarm is a research project exploring **serverless, zero-knowledge mesh networking**. The core thesis: can sovereign edge devices communicate, replicate, and recover data without ever trusting a central authority — and can cryptography alone enforce access control instead of server-side permissions?

This prototype proves that thesis by building a fully functional E2EE P2P messenger where:
- Every node is a sovereign daemon (no central server exists)
- Data at rest is always encrypted ciphertext
- Nodes that relay messages they're not party to can never decrypt them (blind vault)
- The mesh is self-healing — nodes detect unsigned deletions, route recovery requests through onion-encrypted hops, and rehydrate lost data autonomously

---

## 2. Research Lineage — How We Got Here

This final prototype is the result of **7 iterative prototypes**, each solving a specific technical challenge. Below is the complete evolution:

### Prototype 1: Tor ECDH PoC (`/prototypes/tor-ecdh-poc/`)
**Goal:** Prove that two Node.js processes can derive a shared AES key over a raw TCP socket using Elliptic Curve Diffie-Hellman.

**What was built:**
- `node-a.js`: Connects to Node B, sends its ECDH `secp256k1` public key, receives B's public key, derives a shared AES-256-GCM secret, encrypts a payload, and transmits the ciphertext.
- `node-b.js`: Listens on TCP port 8080, receives A's public key, sends its own, derives the same shared secret, and decrypts the incoming ciphertext.

**Key Discovery:** ECDH `secp256k1` key exchange works flawlessly over raw `net.connect()` TCP sockets. The shared secret is mathematically identical on both sides without ever transmitting the private key.

---

### Prototype 2: WebRTC Hybrid P2P (`/prototypes/super-node-poc/`)
**Goal:** Prove that WebRTC Data Channels can replace raw UDP for P2P syncing to bypass Tor latency.

**What was built:**
- `signaling.js`: A Socket.IO server acting as the signaling relay for WebRTC SDP offers/answers and ICE candidates.
- `edge-node.js`: A client using `node-datachannel` that connects to the signaling server, discovers peers, and opens direct WebRTC Data Channels.

**Key Discovery:** WebRTC works for P2P, but introduces a mandatory signaling dependency. The "Glare Condition" (both nodes sending offers simultaneously) was solved by enforcing alphabetical sorting — the node with the higher ID always initiates.

---

### Prototype 3: CR-SQLite Database Validation (`/prototypes/crsqlite-poc/`)
**Goal:** Prove that Conflict-Free Replicated SQLite can extract and deterministically merge binary deltas (O(delta)) for the database engine pivot.

**What was built:**
- `db-test.js`: Spins up two in-memory databases using `@vlcn.io/crsqlite-allinone`, upgrades relational schemas to CRRs (Conflict-Free Replicated Relations), inserts diverging offline data, and cross-applies binary deltas.

**Key Discoveries:**
- Node 24 breaks `better-sqlite3` v9.6.0 C++ compilation. Fixed with `"overrides": {"better-sqlite3": "^11.1.2"}` in `package.json`.
- CR-SQLite v0.16.x added `cl` (causal length) and `seq` (sequence number) columns to `crsql_changes`. Initial sync silently failed until the INSERT statement was expanded to include all 9 columns.
- Deterministic merge requires `db.transaction()` wrapping for ACID guarantees during changeset ingestion.

---

### Prototype 4: Parity Notes — Hybrid P2P + E2EE Application (`/prototypes/parity-notes/`)
**Goal:** Prove that the P2P and CR-SQLite concepts can be combined into a functional application with local-first, zero-knowledge sync.

**What was built:**
- Edge Daemons with persistent local CR-SQLite databases
- A React/Vite Glassmorphism frontend for notes
- A Super-Node with its own `cloud.db` CR-SQLite instance for always-online backup
- Dual-Transport Sync: deltas broadcast simultaneously over WebRTC (P2P zero-latency) and Socket.IO (cloud backup)
- Zero-Knowledge Encryption: AES-256-GCM encryption of the `c.val` column before sending payloads to the Super-Node

**Key Discovery:** CR-SQLite can mathematically merge and compact encrypted metadata on a cloud server without ever decrypting or knowing the plaintext values inside the SQLite table.

---

### Prototype 5: Mesh Proof — Single-File Daemon (`/prototypes/mesh-proof.js`)
**Goal:** Collapse the entire mesh network into a single executable file proving ECDH key exchange, AES-256-GCM encryption, blind vault replication, and data recovery — all in 31 lines.

**What was built:**
A single `mesh-proof.js` script that:
1. Creates 3 in-memory SQLite databases (A, B, C)
2. A and B perform ECDH `secp256k1` key exchange and derive a shared AES-256-GCM key
3. A encrypts `TOP_SECRET_DB_RECORD`, saves it locally, sends ciphertext to B (who decrypts) and C (who stores blindly)
4. A wipes its own database
5. A connects to C's vault, retrieves the ciphertext, decrypts it with its AES key, and recovers the original record

**Key Discovery:** A blind vault node (C) that never participates in ECDH can still serve as a disaster recovery backup. The data owner (A) can always recover from C by re-deriving the AES key.

---

### Prototype 6: Centralized Chat Attempt (`/prototypes/server-routed-chat/`)
**Goal:** Build a multi-window chat interface.

**What was built:**
- A central server that routes messages between node clients
- Individual node-client processes with their own UIs

**Critical Failure:** This design violated the core principle of the Nomadic Parity Swarm. A central routing server is a single point of failure and trust. It was abandoned in favor of the true P2P architecture.

---

### Prototype 7 → Final: True P2P Messenger with Onion-Routed Recovery

This is the prototype contained in this folder. Zero centralization. Every node is sovereign. Upgraded with a complete self-healing protocol in the final iteration, featuring a 4-node mesh, dual anomaly detection, and exponential vault replication.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NO CENTRAL SERVER                         │
│                    NO SHARED DATABASE                        │
│                    NO ROUTING PROXY                          │
└─────────────────────────────────────────────────────────────┘

  Node A       Node B       Node C       Node D
  (4001)       (4002)       (4003)       (4004)
  ┌────┐       ┌────┐       ┌────┐       ┌────┐
  │ UI │       │ UI │       │ UI │       │ UI │
  ├────┤       ├────┤       ├────┤       ├────┤
  │ TCP│◄─────►│ TCP│◄─────►│ TCP│◄─────►│ TCP│
  ├────┤       ├────┤       ├────┤       ├────┤
  │ DB │       │ DB │       │ DB │       │ DB │
  ├────┤       ├────┤       ├────┤       ├────┤
  │HTTP│◄─────►│HTTP│◄─────►│HTTP│◄─────►│HTTP│
  └────┘       └────┘       └────┘       └────┘
```

Each node runs:
- **Express HTTP Server** — serves chat UI, server dashboard, and `POST /api/relay` for onion routing
- **Socket.IO WebSocket** — real-time UI updates (messages, threat alerts, recovery events)
- **TCP Mesh Socket** — raw `net.createServer()` / `net.connect()` for P2P message broadcast
- **SQLite Database** — isolated `better-sqlite3` instance per node
- **Dual Anomaly Detector** — background polling loop (5s interval) independently monitoring "My Work" and "Locker" (blind vault) deletions
- **Onion Router** — 3-layer AES-256-GCM wrapping/peeling for recovery requests and replication payloads
- **Rehydrator** — decrypts and re-inserts recovered rows, dynamically updating the chat UI

---

## 4. Cryptography — The State Machine

### Step 1: ECDH secp256k1 Key Exchange
On boot, each node generates an ephemeral ECDH keypair on the `secp256k1` curve (the same curve used by Bitcoin).

### Step 2: TCP Handshake
When a TCP connection is established between two nodes, both sides immediately send a `hello` message containing their public key.

### Step 3: Shared Secret Derivation
Each side computes the shared secret using their private key and the peer's public key, then hashes it into a 256-bit AES key. The mathematical property of ECDH guarantees that A's derived key equals B's derived key, without either side ever transmitting their private key. No node holds a key for a conversation it was not part of. This means Node C physically cannot decrypt A↔B messages — it is enforced by mathematics, not permissions.

### Step 4: AES-256-GCM Encryption
Every message is encrypted using AES-256-GCM (Galois/Counter Mode), which provides both confidentiality and authenticity.

### Step 5: UI Blocking
The frontend chat input and peer buttons remain **strictly disabled** until the backend confirms that the ECDH handshake with each specific peer is complete.

---

## 5. Message Flow

### Direct Message (A → B)
1. Node A encrypts plaintext with B's AES key → produces `{nonce, tag, val}`
2. A stores the ciphertext in its own local SQLite vault
3. A broadcasts the ciphertext to **ALL** peers via TCP (B, C, and D receive it)
4. **Node B:** Sees `toNode === 'B'`, has A's AES key → **decrypts and displays plaintext**
5. **Nodes C & D:** See `toNode !== 'C'` → **store raw ciphertext as blind backup, never decrypt**

### Blind Vault Replication
When a node receives a message that is NOT addressed to it, it writes the raw ciphertext to its local SQLite vault (the "Locker"). It does not decrypt it, and the Chat UI remains unaware.

---

## 6. Adaptive Vault Replication & Dual Self-Healing

The protocol features a highly advanced, resilient self-healing mechanism that responds dynamically to threats.

### Dual Anomaly Detection
Every node monitors its own database for unsigned deletions every 5 seconds. It maintains two distinct sets:
1. **My Work** — Messages this node participated in.
2. **Locker** — Blind vault copies stored for other nodes.

If a "Smart Attacker" wipes BOTH the My Work data and the Locker data, the system detects this simultaneously and fires independent threat events (`ANOMALY_DETECTED` and `LOCKER_ANOMALY`).

### Onion-Routed Recovery
When a threat is detected, missing IDs are wrapped in a **3-layer AES-256-GCM onion**.
- **My Work Recovery**: The origin node sends requests through the mesh to retrieve the blind vault copies stored by peers.
- **Locker Recovery**: The node sends requests to the originators of the conversations, asking them to resupply the blind vault ciphertext.

### Exponential Vault Replication
To prevent future data loss, the mesh adapts to attacks:
- On every successful threat recovery, the **Replication Factor doubles** (1 → 2 → 4 → 8).
- The node then dispatches `REPLICATE_VAULT` onion payloads across the mesh, forcefully spreading copies of the recovered data into ALL peer lockers simultaneously, maximizing redundancy.

---

## 7. The Server Dashboard

Each node serves a dashboard at `/server.html` with three tabs:

### My Work Tab
Messages where `fromNode === thisNode OR toNode === thisNode`. The node holds the AES key so it displays **decrypted plaintext**.

### Locker Tab
Messages where `fromNode !== thisNode AND toNode !== thisNode`. These are blind replications from conversations the node was NOT part of. Displays **raw encrypted ciphertext**.

### Threat Monitor Tab
Real-time health dashboard showing:
- **Vault Records** — Total owned messages.
- **Locker Records** — Total blind vault copies.
- **Replication Factor** — Current global redundancy factor (e.g., ×4).
- **Threat Status** — Health status / active threats.
- **Simulate Smart Wipe** — Deletes random records from BOTH My Work and the Locker without cryptographic signature, simulating a sophisticated attack.
- **Live Event Timeline** — Human-readable logs of detections, onion routing, and exponential spread operations.

*(Note: Threat alerts and recovery events are entirely hidden from the Chat UI (`index.html`) to ensure a clean user experience, as requested. Rehydrated messages simply reappear in the background.)*

---

## 8. SQLite Vault Schema

```sql
CREATE TABLE vault (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  msgId     TEXT UNIQUE,    -- UUID preventing duplicate ingestion
  fromNode  TEXT,           -- sender node name
  toNode    TEXT,           -- intended recipient node name
  nonce     TEXT,           -- 12-byte random IV (hex)
  tag       TEXT,           -- 16-byte GCM auth tag (hex)
  val       TEXT,           -- AES-256-GCM ciphertext (hex)
  ts        INTEGER         -- Unix timestamp
);
```

---

## 9. File Reference

| File | Purpose |
|------|---------|
| `node-daemon.js` | Sovereign node daemon: Express + Socket.IO + TCP mesh + SQLite + Onion relay + Exponential replication logic |
| `anomaly-detector.js` | Background worker: 5s poll, dual in-memory diffs (My Work + Locker) |
| `onion-router.js` | `wrapOnion()` / `peelOnion()` / `wrapReturnOnion()` using AES-256-GCM per layer |
| `rehydrator.js` | Decrypts recovered rows, restores locker rows, re-registers with anomaly detector |
| `public/index.html` | Chat UI: ECDH wait overlay, peer contacts, message bubbles, phantom UI injection |
| `public/server.html` | Server dashboard: My Work, Locker, Threat Monitor, Timeline, Smart Wipe |
| `launcher.js` | Spawns 4 isolated node processes, opens 8 browser tabs |
| `test-recovery.js` | Automated E2E test verifying dual detection, recovery, and exponential replication |

---

## 10. How to Run

```bash
node launcher.js
```

This will:
1. Delete any stale `.db` files from previous runs
2. Spawn 4 nodes (A, B, C, D) binding to TCP ports 4001-4004
3. Open 8 browser tabs (chat + server dashboard per node)

The nodes will automatically connect, exchange ECDH keys, and unlock the UI.

To run the automated recovery test (requires the mesh to be running):
```bash
node test-recovery.js
```

---

## 11. Verified Test Results

### Adaptive Vault Replication E2E Test (Verified)
```
=== Adaptive Vault Replication E2E Test ===

1. Waiting for mesh-ready on Node A...
  PASS: Mesh is ready (A has 3 peers)

2. Sending messages: A→B, A→C, B→C...
  PASS: A My Work has at least 2 rows
  PASS: A→B message found in A My Work
  PASS: A Locker has at least 1 row (B→C)
  PASS: D Locker has rows (blind vault)

3. Simulating SMART wipe on Node A (My Work + Locker)...
  Pre-wipe: 2 My Work, 1 Locker
  [A Sys] 🗑️ SMART WIPE: 2 My Work + 1 Locker record(s) deleted without signature
  Post-wipe: 0 My Work, 0 Locker
  PASS: My Work or Locker reduced after wipe

4. Waiting for anomaly detection (My Work + Locker)...
  [A Event] ANOMALY_DETECTED: 2 My Work missing
  [A Sys] ⚠️ ANOMALY: 2 My Work record(s) deleted without cryptographic signature
  [A Sys] ⚡ Replication factor doubled to ×2
  [A Sys] 🧅 Initiating onion-routed mywork recovery for 2 record(s)...
  [A Event] LOCKER_ANOMALY: 1 Locker missing
  [A Sys] ⚠️ LOCKER ANOMALY: 1 blind vault record(s) deleted without cryptographic signature
  [A Sys] 🧅 Initiating onion-routed locker recovery for 1 record(s)...
  [A Sys] ✅ Locker recovery complete: 1 blind vault record(s) restored
  [A Event] RECOVERY_COMPLETE: 2 message(s)
  [A Sys] ✅ Recovery complete: 2 record(s) restored via onion routing
  PASS: My Work anomaly detected
  PASS: Locker anomaly detected

5. Recovery already completed via auto-trigger
  PASS: Recovery complete event received
  PASS: At least 1 My Work message recovered
  PASS: Correct message text recovered (A→B)
  PASS: Rehydration stats received
  PASS: Rehydration recovered > 0
  PASS: Rehydration failed === 0

6. Checking replication factor...
  PASS: Replication status received
  PASS: Replication factor >= 2 after threat
  Replication factor: ×2

7. Waiting for vault replication to spread...
  [A Sys] 📡 Spreading 2 record(s) across 3 peer lockers (replication factor: ×2)
  [A Event] REPLICATION_SPREAD: factor ×2, 2 rows to 3 peers
  PASS: Replication spread event received on A
  PASS: Node D received replicated data

8. Verifying restored data on Node A...
  PASS: A→B message restored in A My Work
  PASS: A→C message restored in A My Work

=============================
Passed: 20 | Failed: 0
=============================
```

---

## 12. Security Properties

1. **No Central Authority:** Every node is a sovereign daemon. There is no server, no routing proxy, no shared database.
2. **Zero-Knowledge at Rest:** Every row in every node's SQLite database contains only encrypted ciphertext, nonces, and auth tags. Plaintext never touches disk.
3. **Cryptographic Access Control:** Only the intended recipient can decrypt a message. Access is enforced by mathematics (ECDH key derivation), not by server-side permissions.
4. **Blind Vault Replication:** Nodes faithfully store and replicate ciphertexts from conversations they're not party to, enabling distributed backup without compromising confidentiality.
5. **Dual Self-Healing Mesh:** Anomaly detection fires independently on unsigned deletions from both My Work and Locker. Onion-routed recovery wraps requests in 3-layer AES-256-GCM encryption, routes them through the peer mesh, retrieves blind vault backups, and rehydrates the origin node — all within ~5 seconds, automatically.
6. **Exponential Vault Replication:** Each threat doubles the replication factor, spreading recovered data across all peer lockers via onion routing for maximum redundancy.
7. **Onion Routing Privacy:** Intermediate relay nodes never see the recovery payload or final destination. Each node only knows the next hop, identical in principle to Tor circuit construction.

---

## 13. Addendum: Evolution to Hybrid CouchDB + Mesh Architecture

The latest iteration of the TrueP2PMessenger embedded in the `akshar` protocol incorporates several major architectural upgrades to handle high-concurrency routing and AI integrations while retaining the Zero-Knowledge philosophy:

1. **CouchDB Clustering instead of SQLite**: The mesh now leverages CouchDB (via `nano`) for resilient, master-master data synchronization, replacing local `better-sqlite3` instances.
2. **Socket.IO Over Express**: Message routing handles UI connections using Socket.IO, creating an easier integration path for web and mobile clients compared to raw TCP sockets.
3. **Optimized Anomaly Detection**: The background anomaly detector uses slim ID-only queries (`fields: ['msgId']`) to check for missing rows in My Work and the Locker, preventing massive memory overhead from pulling full message blobs.
4. **Bounded Concurrent Onion Dispatching**: Recovery and exponential replication (`replicateVault`) dispatch onion-routed packets to all peers concurrently using `Promise.allSettled` in bounded batches (e.g., 5 peers at a time). Downstream relay hops are handled asynchronously (fire-and-forget), preventing HTTP connection pool exhaustion during massive mesh operations.
5. **Asynchronous ML Feeding**: Plaintext UI messages trigger non-blocking ML vector analysis on the mesh backend. To prevent blocking the critical P2P routing path (and avoid perceptible latency for the sender), messages are broadcast instantly with a `{ verdict: 'Pending' }` state. The AI classification resolves asynchronously and emits a `message-classified` event for optimistic UI merging, seamlessly bridging Zero-Knowledge routing with advanced AI heuristics.
