"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileCryptoProvider = void 0;
const secp = __importStar(require("@noble/secp256k1"));
const sha256_1 = require("@noble/hashes/sha256");
const aes_1 = require("@noble/ciphers/aes");
class MobileCryptoProvider {
    randomBytes(length) {
        return crypto.getRandomValues(new Uint8Array(length));
    }
    sha256(data) {
        return (0, sha256_1.sha256)(data);
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
        const cipher = (0, aes_1.gcm)(key, nonce);
        const encrypted = cipher.encrypt(plaintext);
        const ciphertextOnly = encrypted.slice(0, -16);
        const tag = encrypted.slice(-16);
        return { nonce, tag, ciphertext: ciphertextOnly };
    }
    aesGcmDecrypt(key, nonce, tag, ciphertext) {
        try {
            const cipher = (0, aes_1.gcm)(key, nonce);
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
exports.MobileCryptoProvider = MobileCryptoProvider;
//# sourceMappingURL=mobile-provider.js.map