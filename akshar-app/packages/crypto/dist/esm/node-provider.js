/**
 * NodeCryptoProvider — CryptoProvider implementation using Node.js built-in crypto.
 */
import crypto from 'node:crypto';
export class NodeCryptoProvider {
    randomBytes(length) {
        return new Uint8Array(crypto.randomBytes(length));
    }
    sha256(data) {
        return new Uint8Array(crypto.createHash('sha256').update(data).digest());
    }
    ecdhGenerateKeys() {
        const ecdh = crypto.createECDH('secp256k1');
        ecdh.generateKeys();
        return {
            publicKey: new Uint8Array(ecdh.getPublicKey()),
            privateKey: new Uint8Array(ecdh.getPrivateKey()),
        };
    }
    ecdhComputeSecret(privateKey, peerPublicKey) {
        const ecdh = crypto.createECDH('secp256k1');
        ecdh.setPrivateKey(Buffer.from(privateKey));
        const raw = ecdh.computeSecret(Buffer.from(peerPublicKey));
        return this.sha256(new Uint8Array(raw));
    }
    aesGcmEncrypt(key, plaintext) {
        const nonce = this.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(nonce));
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
            const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(nonce));
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
//# sourceMappingURL=node-provider.js.map