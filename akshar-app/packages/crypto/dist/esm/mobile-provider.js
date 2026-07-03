/**
 * Placeholder — will be implemented with @noble/* libraries in akshar-mobile.
 * For now, this serves as the type contract that the mobile build must satisfy.
 */
export class MobileCryptoProvider {
    randomBytes(_length) {
        throw new Error('MobileCryptoProvider: not yet implemented. Use NodeCryptoProvider for server/testing.');
    }
    sha256(_data) {
        throw new Error('MobileCryptoProvider: not yet implemented.');
    }
    ecdhGenerateKeys() {
        throw new Error('MobileCryptoProvider: not yet implemented.');
    }
    ecdhComputeSecret(_privateKey, _peerPublicKey) {
        throw new Error('MobileCryptoProvider: not yet implemented.');
    }
    aesGcmEncrypt(_key, _plaintext) {
        throw new Error('MobileCryptoProvider: not yet implemented.');
    }
    aesGcmDecrypt(_key, _nonce, _tag, _ciphertext) {
        throw new Error('MobileCryptoProvider: not yet implemented.');
    }
}
//# sourceMappingURL=mobile-provider.js.map