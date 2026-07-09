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
export declare class MobileCryptoProvider implements CryptoProvider {
    randomBytes(length: number): Uint8Array;
    sha256(data: Uint8Array): Uint8Array;
    ecdhGenerateKeys(): {
        publicKey: Uint8Array;
        privateKey: Uint8Array;
    };
    ecdhComputeSecret(privateKey: Uint8Array, peerPublicKey: Uint8Array): Uint8Array;
    aesGcmEncrypt(key: Uint8Array, plaintext: Uint8Array): {
        nonce: Uint8Array;
        tag: Uint8Array;
        ciphertext: Uint8Array;
    };
    aesGcmDecrypt(key: Uint8Array, nonce: Uint8Array, tag: Uint8Array, ciphertext: Uint8Array): Uint8Array | null;
}
//# sourceMappingURL=mobile-provider.d.ts.map