"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ratchetKey = exports.decrypt = exports.encrypt = void 0;
/**
 * Symmetric Encryption — AES-256-GCM encrypt/decrypt.
 *
 * Every call to encrypt() generates a fresh 12-byte nonce (CSPRNG).
 * Decryption returns null on failure (fail-closed, no information leakage).
 */
const provider_js_1 = require("./provider.js");
const utils_js_1 = require("./utils.js");
/**
 * Encrypt plaintext with AES-256-GCM.
 *
 * @param key - 32-byte AES key (from deriveSharedKey)
 * @param plaintext - UTF-8 string to encrypt
 * @returns EncryptedBlob with hex-encoded nonce, tag, and ciphertext
 */
function encrypt(key, plaintext) {
    if (key.length !== 32) {
        throw new Error('encrypt: key must be exactly 32 bytes');
    }
    const provider = (0, provider_js_1.getCryptoProvider)();
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const { nonce, tag, ciphertext } = provider.aesGcmEncrypt(key, plaintextBytes);
    return {
        nonce: (0, utils_js_1.toHex)(nonce),
        tag: (0, utils_js_1.toHex)(tag),
        val: (0, utils_js_1.toHex)(ciphertext),
    };
}
exports.encrypt = encrypt;
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
function decrypt(key, nonce, tag, val) {
    if (key.length !== 32) {
        return null;
    }
    try {
        const nonceBytes = (0, utils_js_1.fromHex)(nonce);
        const tagBytes = (0, utils_js_1.fromHex)(tag);
        const ciphertextBytes = (0, utils_js_1.fromHex)(val);
        if (nonceBytes.length !== 12 || tagBytes.length !== 16) {
            return null;
        }
        const provider = (0, provider_js_1.getCryptoProvider)();
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
exports.decrypt = decrypt;
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
function ratchetKey(currentKey) {
    if (currentKey.length !== 32) {
        throw new Error('ratchetKey: key must be exactly 32 bytes');
    }
    const provider = (0, provider_js_1.getCryptoProvider)();
    return provider.sha256(currentKey);
}
exports.ratchetKey = ratchetKey;
//# sourceMappingURL=encryption.js.map