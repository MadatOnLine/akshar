/**
 * MobileCryptoProvider — CryptoProvider implementation for React Native.
 *
 * Uses:
 * - @noble/secp256k1 for ECDH
 * - @noble/hashes for SHA-256
 * - react-native-get-random-values for CSPRNG
 * - Pure JS AES-GCM (or native module at scale)
 *
 * NOTE: This file is a placeholder for the React Native build.
 * The actual implementation will be completed in Unit 5 (akshar-mobile)
 * when the React Native environment is set up.
 */
import type { CryptoProvider } from './provider.js';
import * as secp from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { gcm } from '@noble/ciphers/aes';

export class MobileCryptoProvider implements CryptoProvider {
  randomBytes(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  sha256(data: Uint8Array): Uint8Array {
    return sha256(data);
  }

  ecdhGenerateKeys(): { publicKey: Uint8Array; privateKey: Uint8Array } {
    const priv = secp.utils.randomPrivateKey();
    const pub = secp.getPublicKey(priv);
    return { publicKey: pub, privateKey: priv };
  }

  ecdhComputeSecret(privateKey: Uint8Array, peerPublicKey: Uint8Array): Uint8Array {
    const raw = secp.getSharedSecret(privateKey, peerPublicKey);
    return this.sha256(raw);
  }

  aesGcmEncrypt(
    key: Uint8Array,
    plaintext: Uint8Array
  ): { nonce: Uint8Array; tag: Uint8Array; ciphertext: Uint8Array } {
    const nonce = this.randomBytes(12);
    const cipher = gcm(key, nonce);
    const encrypted = cipher.encrypt(plaintext);
    const ciphertextOnly = encrypted.slice(0, -16);
    const tag = encrypted.slice(-16);
    return { nonce, tag, ciphertext: ciphertextOnly };
  }

  aesGcmDecrypt(
    key: Uint8Array,
    nonce: Uint8Array,
    tag: Uint8Array,
    ciphertext: Uint8Array
  ): Uint8Array | null {
    try {
      const cipher = gcm(key, nonce);
      const combined = new Uint8Array(ciphertext.length + 16);
      combined.set(ciphertext);
      combined.set(tag, ciphertext.length);
      return cipher.decrypt(combined);
    } catch (err) {
      console.error('MOBILE GCM DECRYPT ERROR:', err);
      return null;
    }
  }
}
