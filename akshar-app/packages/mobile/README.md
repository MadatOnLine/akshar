# akshar-mobile

Akshar Protocol Mobile App — React Native (iOS + Android). Face enrollment, biometric login, encrypted chat, public feed, trust badges, and offline-first data sync.

## Quick Start

```bash
cd akshar-app/packages/mobile
npm install

# iOS
npx pod-install ios
npx react-native run-ios

# Android
npx react-native run-android
```

## Screens

| Screen | Purpose |
|---|---|
| Enrollment | Face capture + liveness challenge + account creation |
| Login | Biometric (Face ID/Touch ID) + PIN fallback |
| Group List | User's encrypted conversation groups |
| Chat | E2EE messaging with trust badges and bot indicators |
| Feed | Public shared posts with likes/dislikes/shares |
| Profile | Trust score, tier badge, settings, logout |

## Architecture

- **Navigation**: React Navigation (stack + tabs)
- **Auth**: AuthProvider context (JWT in memory, auto-refresh)
- **Crypto**: @akshar/crypto with MobileCryptoProvider (@noble/*)
- **Storage**: PouchDB (encrypted vault, offline-first)
- **Real-time**: Socket.IO client → akshar-mesh WebSocket
- **API**: fetch wrapper with automatic auth headers

## Testing

```bash
npm test                    # Unit tests (Jest)
npx detox test -c ios      # E2E tests (Detox)
```
