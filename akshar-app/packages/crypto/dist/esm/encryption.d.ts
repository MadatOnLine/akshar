import type { EncryptedBlob } from './types.js';
/**
 * Encrypt plaintext with AES-256-GCM.
 *
 * @param key - 32-byte AES key (from deriveSharedKey)
 * @param plaintext - UTF-8 string to encrypt
 * @returns EncryptedBlob with hex-encoded nonce, tag, and ciphertext
 */
export declare function encrypt(key: Uint8Array, plaintext: string): EncryptedBlob;
/**
 * Decrypt an AES-256-GCM ciphertext back to plaintext.
 *
 * Returns null if:
 * - Authentication tag verification fails (tampered data)
 * - Key is wrong
 * - Any input format is invalid
 *
 * Never throws on decryption failure (fail-closed).
 *
 * @param key - 32-byte AES key
 * @param nonce - Hex-encoded 12-byte nonce
 * @param tag - Hex-encoded 16-byte authentication tag
 * @param val - Hex-encoded ciphertext
 * @returns Decrypted plaintext string, or null on failure
 */
export declare function decrypt(key: Uint8Array, nonce: string, tag: string, val: string): string | null;
/**
 * Hash Ratchet (Key Derivation Function) for Perfect Forward Secrecy.
 *
 * Runs the current AES key through SHA-256 to deterministically generate
 * the next 32-byte AES key. Because cryptographic hashes are one-way,
 * it is mathematically impossible to reverse this function. If an attacker
 * steals the 'currentKey', they cannot derive any past keys.
 *
 * @param currentKey - The current 32-byte AES key
 * @returns The next 32-byte AES key
 */
export declare function ratchetKey(currentKey: Uint8Array): Uint8Array;
//# sourceMappingURL=encryption.d.ts.map