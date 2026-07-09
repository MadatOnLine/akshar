import * as secp from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { gcm } from '@noble/ciphers/aes';
export class MobileCryptoProvider {
    randomBytes(length) {
        return crypto.getRandomValues(new Uint8Array(length));
    }
    sha256(data) {
        return sha256(data);
    }
    ecdhGenerateKeys() {
        const priv = secp.utils.randomPrivateKey();
        const pub = secp.getPublicKey(priv);
        return { publicKey: pub, privateKey: priv };
    }
    ecdhComputeSecret(privateKey, peerPublicKey) {
        const raw = secp.getSharedSecret(privateKey, peerPublicKey);
        return this.sha256(raw);
    }
    aesGcmEncrypt(key, plaintext) {
        const nonce = this.randomBytes(12);
        const cipher = gcm(key, nonce);
        const encrypted = cipher.encrypt(plaintext);
        const ciphertextOnly = encrypted.slice(0, -16);
        const tag = encrypted.slice(-16);
        return { nonce, tag, ciphertext: ciphertextOnly };
    }
    aesGcmDecrypt(key, nonce, tag, ciphertext) {
        try {
            const cipher = gcm(key, nonce);
            const combined = new Uint8Array(ciphertext.length + 16);
            combined.set(ciphertext);
            combined.set(tag, ciphertext.length);
            return cipher.decrypt(combined);
        }
        catch (err) {
            console.error('MOBILE GCM DECRYPT ERROR:', err);
            return null;
        }
    }
}
//# sourceMappingURL=mobile-provider.js.map