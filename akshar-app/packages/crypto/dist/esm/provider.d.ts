/**
 * CryptoProvider — Platform abstraction for cryptographic primitives.
 *
 * Node.js uses built-in `crypto` module. React Native uses @noble/* libraries.
 * All implementations must produce identical output for the same inputs.
 */
export interface CryptoProvider {
    /** Generate cryptographically secure random bytes. */
    randomBytes(length: number): Uint8Array;
    /** SHA-256 hash of input data. */
    sha256(data: Uint8Array): Uint8Array;
    /** Generate an ECDH secp256k1 keypair. */
    ecdhGenerateKeys(): {
        publicKey: Uint8Array;
        privateKey: Uint8Array;
    };
    /** Compute ECDH shared secret from our private key and peer's public key. */
    ecdhComputeSecret(privateKey: Uint8Array, peerPublicKey: Uint8Array): Uint8Array;
    /** AES-256-GCM encrypt. Nonce is generated internally (12 bytes random). */
    aesGcmEncrypt(key: Uint8Array, plaintext: Uint8Array): {
        nonce: Uint8Array;
        tag: Uint8Array;
        ciphertext: Uint8Array;
    };
    /** AES-256-GCM decrypt. Returns null if authentication fails. */
    aesGcmDecrypt(key: Uint8Array, nonce: Uint8Array, tag: Uint8Array, ciphertext: Uint8Array): Uint8Array | null;
}
/** Set the crypto provider for the current runtime. */
export declare function setCryptoProvider(provider: CryptoProvider): void;
/** Get the active crypto provider. Throws if not initialized. */
export declare function getCryptoProvider(): CryptoProvider;
//# sourceMappingURL=provider.d.ts.map