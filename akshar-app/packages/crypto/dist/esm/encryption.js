/**
 * Symmetric Encryption — AES-256-GCM encrypt/decrypt.
 *
 * Every call to encrypt() generates a fresh 12-byte nonce (CSPRNG).
 * Decryption returns null on failure (fail-closed, no information leakage).
 */
import { getCryptoProvider } from './provider.js';
import { toHex, fromHex } from './utils.js';
/**
 * Encrypt plaintext with AES-256-GCM.
 *
 * @param key - 32-byte AES key (from deriveSharedKey)
 * @param plaintext - UTF-8 string to encrypt
 * @returns EncryptedBlob with hex-encoded nonce, tag, and ciphertext
 */
export function encrypt(key, plaintext) {
    if (key.length !== 32) {
        throw new Error('encrypt: key must be exactly 32 bytes');
    }
    const provider = getCryptoProvider();
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const { nonce, tag, ciphertext } = provider.aesGcmEncrypt(key, plaintextBytes);
    return {
        nonce: toHex(nonce),
        tag: toHex(tag),
        val: toHex(ciphertext),
    };
}
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
export function decrypt(key, nonce, tag, val) {
    if (key.length !== 32) {
        return null;
    }
    try {
        const nonceBytes = fromHex(nonce);
        const tagBytes = fromHex(tag);
        const ciphertextBytes = fromHex(val);
        if (nonceBytes.length !== 12 || tagBytes.length !== 16) {
            return null;
        }
        const provider = getCryptoProvider();
        const plainBytes = provider.aesGcmDecrypt(key, nonceBytes, tagBytes, ciphertextBytes);
        if (plainBytes === null) {
            return null;
        }
        return new TextDecoder().decode(plainBytes);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=encryption.js.map