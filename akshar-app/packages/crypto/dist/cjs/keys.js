"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveSharedKey = exports.generateKeyPair = void 0;
/**
 * Key Exchange — ECDH secp256k1 key pair generation and shared secret derivation.
 */
const provider_js_1 = require("./provider.js");
const utils_js_1 = require("./utils.js");
/**
 * Generate a new ECDH secp256k1 key pair.
 * @returns KeyPair with hex-encoded public and private keys.
 */
function generateKeyPair() {
    const provider = (0, provider_js_1.getCryptoProvider)();
    const { publicKey, privateKey } = provider.ecdhGenerateKeys();
    return {
        publicKey: (0, utils_js_1.toHex)(publicKey),
        privateKey: (0, utils_js_1.toHex)(privateKey),
    };
}
exports.generateKeyPair = generateKeyPair;
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
function deriveSharedKey(privateKey, peerPublicKey) {
    const provider = (0, provider_js_1.getCryptoProvider)();
    const privBytes = (0, utils_js_1.fromHex)(privateKey);
    const pubBytes = (0, utils_js_1.fromHex)(peerPublicKey);
    if (privBytes.length !== 32) {
        throw new Error('Invalid private key: expected 32 bytes (64 hex chars)');
    }
    if (pubBytes.length !== 65 && pubBytes.length !== 33) {
        throw new Error('Invalid public key: expected 65 bytes (uncompressed) or 33 bytes (compressed)');
    }
    return provider.ecdhComputeSecret(privBytes, pubBytes);
}
exports.deriveSharedKey = deriveSharedKey;
//# sourceMappingURL=keys.js.map