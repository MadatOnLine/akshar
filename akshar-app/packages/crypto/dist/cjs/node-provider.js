"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeCryptoProvider = void 0;
/**
 * NodeCryptoProvider — CryptoProvider implementation using Node.js built-in crypto.
 */
const node_crypto_1 = __importDefault(require("node:crypto"));
class NodeCryptoProvider {
    randomBytes(length) {
        return new Uint8Array(node_crypto_1.default.randomBytes(length));
    }
    sha256(data) {
        return new Uint8Array(node_crypto_1.default.createHash('sha256').update(data).digest());
    }
    ecdhGenerateKeys() {
        const ecdh = node_crypto_1.default.createECDH('secp256k1');
        ecdh.generateKeys();
        let priv = ecdh.getPrivateKey();
        // Node.js crypto sometimes strips leading zeros; ensure it's 32 bytes
        if (priv.length < 32) {
            const padded = Buffer.alloc(32, 0);
            priv.copy(padded, 32 - priv.length);
            priv = padded;
        }
        return {
            publicKey: new Uint8Array(ecdh.getPublicKey()),
            privateKey: new Uint8Array(priv),
        };
    }
    ecdhComputeSecret(privateKey, peerPublicKey) {
        const ecdh = node_crypto_1.default.createECDH('secp256k1');
        ecdh.setPrivateKey(Buffer.from(privateKey));
        const raw = ecdh.computeSecret(Buffer.from(peerPublicKey));
        return this.sha256(new Uint8Array(raw));
    }
    aesGcmEncrypt(key, plaintext) {
        const nonce = this.randomBytes(12);
        const cipher = node_crypto_1.default.createCipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(nonce));
        const encrypted = Buffer.concat([
            cipher.update(Buffer.from(plaintext)),
            cipher.final(),
        ]);
        const tag = new Uint8Array(cipher.getAuthTag());
        return {
            nonce,
            tag,
            ciphertext: new Uint8Array(encrypted),
        };
    }
    aesGcmDecrypt(key, nonce, tag, ciphertext) {
        try {
            const decipher = node_crypto_1.default.createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(nonce));
            decipher.setAuthTag(Buffer.from(tag));
            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(ciphertext)),
                decipher.final(),
            ]);
            return new Uint8Array(decrypted);
        }
        catch {
            return null;
        }
    }
}
exports.NodeCryptoProvider = NodeCryptoProvider;
//# sourceMappingURL=node-provider.js.map