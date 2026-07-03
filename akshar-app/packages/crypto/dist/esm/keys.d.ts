import type { KeyPair } from './types.js';
/**
 * Generate a new ECDH secp256k1 key pair.
 * @returns KeyPair with hex-encoded public and private keys.
 */
export declare function generateKeyPair(): KeyPair;
/**
 * Derive a shared 32-byte AES key from ECDH key agreement.
 *
 * Mathematical guarantee:
 *   deriveSharedKey(A.privateKey, B.publicKey) === deriveSharedKey(B.privateKey, A.publicKey)
 *
 * @param privateKey - Our private key (hex-encoded)
 * @param peerPublicKey - Peer's public key (hex-encoded)
 * @returns 32-byte shared key as Uint8Array (suitable for AES-256-GCM)
 */
export declare function deriveSharedKey(privateKey: string, peerPublicKey: string): Uint8Array;
//# sourceMappingURL=keys.d.ts.map