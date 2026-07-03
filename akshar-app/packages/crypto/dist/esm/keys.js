/**
 * Key Exchange — ECDH secp256k1 key pair generation and shared secret derivation.
 */
import { getCryptoProvider } from './provider.js';
import { toHex, fromHex } from './utils.js';
/**
 * Generate a new ECDH secp256k1 key pair.
 * @returns KeyPair with hex-encoded public and private keys.
 */
export function generateKeyPair() {
    const provider = getCryptoProvider();
    const { publicKey, privateKey } = provider.ecdhGenerateKeys();
    return {
        publicKey: toHex(publicKey),
        privateKey: toHex(privateKey),
    };
}
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
export function deriveSharedKey(privateKey, peerPublicKey) {
    const provider = getCryptoProvider();
    const privBytes = fromHex(privateKey);
    const pubBytes = fromHex(peerPublicKey);
    if (privBytes.length !== 32) {
        throw new Error('Invalid private key: expected 32 bytes (64 hex chars)');
    }
    if (pubBytes.length !== 65 && pubBytes.length !== 33) {
        throw new Error('Invalid public key: expected 65 bytes (uncompressed) or 33 bytes (compressed)');
    }
    return provider.ecdhComputeSecret(privBytes, pubBytes);
}
//# sourceMappingURL=keys.js.map