/**
 * @akshar/crypto — Akshar Protocol cryptographic primitives.
 *
 * Provides ECDH key exchange, AES-256-GCM encryption, onion routing,
 * face hashing, and utility functions. Platform-agnostic via CryptoProvider.
 *
 * Usage:
 *   import { setCryptoProvider, NodeCryptoProvider, generateKeyPair, encrypt, decrypt } from '@akshar/crypto';
 *   setCryptoProvider(new NodeCryptoProvider());
 *   const keys = generateKeyPair();
 */

// Provider
export { setCryptoProvider, getCryptoProvider } from './provider.js';
export type { CryptoProvider } from './provider.js';
export { NodeCryptoProvider } from './node-provider.js';
export { MobileCryptoProvider } from './mobile-provider.js';

// Key exchange
export { generateKeyPair, deriveSharedKey } from './keys.js';

// Encryption
export { encrypt, decrypt } from './encryption.js';

// Onion routing
export { wrapOnion, peelOnion, wrapReturnOnion } from './onion.js';

// Face hashing
export { computeFaceHash, hammingDistance } from './face-hash.js';

// Utilities
export { generateMsgId, toHex, fromHex } from './utils.js';

// Types
export type {
  KeyPair,
  EncryptedBlob,
  OnionHop,
  OnionPacket,
  PeeledLayer,
} from './types.js';
