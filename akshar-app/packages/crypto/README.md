# @akshar/crypto

Cryptographic primitives for the Akshar Protocol — ECDH key exchange, AES-256-GCM encryption, onion routing, and face hashing.

## Setup

```typescript
import { setCryptoProvider, NodeCryptoProvider } from '@akshar/crypto';

// Call once at app startup
setCryptoProvider(new NodeCryptoProvider());
```

## Key Exchange

```typescript
import { generateKeyPair, deriveSharedKey } from '@akshar/crypto';

const alice = generateKeyPair();
const bob = generateKeyPair();

// Both derive the same shared key (ECDH guarantee)
const sharedKey = deriveSharedKey(alice.privateKey, bob.publicKey);
```

## Encryption

```typescript
import { encrypt, decrypt } from '@akshar/crypto';

const blob = encrypt(sharedKey, 'Hello, World!');
// blob = { nonce: '...', tag: '...', val: '...' }

const plaintext = decrypt(sharedKey, blob.nonce, blob.tag, blob.val);
// plaintext = 'Hello, World!' (or null if tampered/wrong key)
```

## Onion Routing

```typescript
import { wrapOnion, peelOnion } from '@akshar/crypto';
import type { OnionHop } from '@akshar/crypto';

const hops: OnionHop[] = [
  { key: hop1Key, nextAddr: 'http://relay1:3001' },
  { key: hop2Key, nextAddr: 'http://relay2:3002' },
  { key: targetKey, nextAddr: 'http://target:3003' },
];

const packet = wrapOnion({ type: 'RECOVERY_REQUEST', ids: ['abc'] }, hops);
// Send packet.ciphertext to packet.firstHop

// At each relay:
const peeled = peelOnion(receivedBlob, myKey);
if (peeled.next) {
  // Forward peeled.inner to peeled.next
} else {
  // This is the final destination — peeled.inner is the payload
}
```

## Face Hashing

```typescript
import { computeFaceHash, hammingDistance } from '@akshar/crypto';

const hash = computeFaceHash(grayscale8x8Pixels); // 16 hex chars
const distance = hammingDistance(storedHash, capturedHash);
const isMatch = distance <= 14; // FACE_MATCH_THRESHOLD
```

## Testing

```bash
npm test           # Run all tests
npm run test:coverage  # With coverage report
```
