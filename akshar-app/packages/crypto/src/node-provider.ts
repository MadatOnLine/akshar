/**
 * NodeCryptoProvider — CryptoProvider implementation using Node.js built-in crypto.
 */
import crypto from 'node:crypto';
import type { CryptoProvider } from './provider.js';

export class NodeCryptoProvider implements CryptoProvider {
  randomBytes(length: number): Uint8Array {
    return new Uint8Array(crypto.randomBytes(length));
  }

  sha256(data: Uint8Array): Uint8Array {
    return new Uint8Array(
      crypto.createHash('sha256').update(data).digest()
    );
  }

  ecdhGenerateKeys(): { publicKey: Uint8Array; privateKey: Uint8Array } {
    const ecdh = crypto.createECDH('secp256k1');
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

  ecdhComputeSecret(privateKey: Uint8Array, peerPublicKey: Uint8Array): Uint8Array {
    const ecdh = crypto.createECDH('secp256k1');
    ecdh.setPrivateKey(Buffer.from(privateKey));
    const raw = ecdh.computeSecret(Buffer.from(peerPublicKey));
    return this.sha256(new Uint8Array(raw));
  }

  aesGcmEncrypt(
    key: Uint8Array,
    plaintext: Uint8Array
  ): { nonce: Uint8Array; tag: Uint8Array; ciphertext: Uint8Array } {
    const nonce = this.randomBytes(12);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(key),
      Buffer.from(nonce)
    );
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

  aesGcmDecrypt(
    key: Uint8Array,
    nonce: Uint8Array,
    tag: Uint8Array,
    ciphertext: Uint8Array
  ): Uint8Array | null {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(key),
        Buffer.from(nonce)
      );
      decipher.setAuthTag(Buffer.from(tag));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(ciphertext)),
        decipher.final(),
      ]);
      return new Uint8Array(decrypted);
    } catch {
      return null;
    }
  }
}
