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
export { setCryptoProvider, getCryptoProvider } from './provider.js';
export type { CryptoProvider } from './provider.js';
export { NodeCryptoProvider } from './node-provider.js';
export { MobileCryptoProvider } from './mobile-provider.js';
export { generateKeyPair, deriveSharedKey } from './keys.js';
export { encrypt, decrypt, ratchetKey } from './encryption.js';
export { wrapOnion, peelOnion, wrapReturnOnion } from './onion.js';
export { computeFaceHash, hammingDistance } from './face-hash.js';
export { generateMsgId, toHex, fromHex } from './utils.js';
export type { KeyPair, EncryptedBlob, OnionHop, OnionPacket, PeeledLayer, } from './types.js';
//# sourceMappingURL=index.d.ts.map