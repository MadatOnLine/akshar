/**
 * Shared type definitions for @akshar/crypto.
 */

/** ECDH secp256k1 key pair (hex-encoded). */
export interface KeyPair {
  /** Uncompressed public key (130 hex chars = 65 bytes). */
  publicKey: string;
  /** Private key (64 hex chars = 32 bytes). */
  privateKey: string;
}

/** AES-256-GCM encrypted payload (hex-encoded fields). */
export interface EncryptedBlob {
  /** 12-byte random initialization vector (24 hex chars). */
  nonce: string;
  /** 16-byte GCM authentication tag (32 hex chars). */
  tag: string;
  /** Ciphertext (variable length, hex-encoded). */
  val: string;
}

/** Configuration for one hop in an onion route. */
export interface OnionHop {
  /** 32-byte AES key shared with this hop's node. */
  key: Uint8Array;
  /** HTTP address of this hop (e.g., 'http://localhost:3002'). */
  nextAddr: string;
}

/** Result of wrapping a payload in onion layers. */
export interface OnionPacket {
  /** The outermost encrypted blob to send. */
  ciphertext: EncryptedBlob;
  /** The address to send the ciphertext to (first hop). */
  firstHop: string;
}

/** Result of peeling one onion layer. */
export interface PeeledLayer {
  /** The inner payload (next encrypted blob or final cleartext). */
  inner: unknown;
  /** Next hop address to forward to, or null if this is the final destination. */
  next: string | null;
}
