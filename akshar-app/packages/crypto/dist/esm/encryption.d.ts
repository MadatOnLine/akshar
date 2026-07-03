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
//# sourceMappingURL=encryption.d.ts.map