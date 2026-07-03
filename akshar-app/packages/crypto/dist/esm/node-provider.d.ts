import type { CryptoProvider } from './provider.js';
export declare class NodeCryptoProvider implements CryptoProvider {
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
//# sourceMappingURL=node-provider.d.ts.map