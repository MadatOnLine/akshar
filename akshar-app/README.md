# Akshar Protocol

Akshar is a resilient, offline-first, decentralized messaging and data synchronization protocol. This repository contains the complete monorepo for the Akshar Protocol ecosystem, including backend microservices, cryptographic utilities, and a React Native mobile application.

## 🏗 Repository Structure

The project is structured as a monorepo containing multiple packages under the `packages/` directory:

| Package | Description | Stack |
|---------|-------------|-------|
| [`auth`](./packages/auth) | Authentication service handling biometric enrollment, login, and trust scoring. | Python, FastAPI |
| [`ai`](./packages/ai) | AI Engine for Liveness checks, face embedding, and message classification. | Python, FastAPI, HuggingFace |
| [`mesh`](./packages/mesh) | P2P Messaging service providing WebSocket relays, anomaly detection, and routing. | Node.js, Express, Socket.IO |
| [`crypto`](./packages/crypto) | Core cryptographic primitives (AES-GCM, ECDH) shared across mobile and server. | TypeScript, Node.js/React Native |
| [`mobile`](./packages/mobile) | The primary user-facing React Native mobile application. | React Native, iOS, Android |

## 🚀 Getting Started

The backend infrastructure is fully containerized with Docker, allowing you to spin up the entire ecosystem with a single command.

### 1. Start the Backend Infrastructure

Ensure you have Docker and Docker Compose installed.

```bash
cd akshar-app
docker-compose up --build -d
```

This will spin up:
- **CouchDB** (Database on port 5984)
- **Auth Service** (Port 8001)
- **AI Service** (Port 8002)
- **Mesh Service** (Port 8003)

### 2. Run the Mobile App

Once the backend is running, you can start the mobile application.

```bash
cd packages/mobile

# Install dependencies
npm install

# For iOS
npx pod-install ios
npm start
# In a new terminal window:
npx react-native run-ios

# For Android
npm start
# In a new terminal window:
npx react-native run-android
```

## 🧪 Testing

Every package in this monorepo includes its own test suite.

```bash
# Test Python Microservices
cd packages/auth && source .venv/bin/activate && pytest
cd packages/ai && source .venv/bin/activate && pytest

# Test TypeScript/Node.js Packages
cd packages/crypto && npm test
cd packages/mesh && npm test
```

## 🛡 Architecture Highlights

- **Decentralized & Resilience**: Features anomaly detection, Onion-routed recovery, and exponential Hydra replication.
- **Biometrics & AI**: Real-time liveness detection and facial embedding matching.
- **End-to-End Encryption**: Secure ECDH key exchange with AES-GCM encrypted payloads via `@akshar/crypto`.
- **Offline-First**: Mobile data is stored in a local PouchDB vault.
