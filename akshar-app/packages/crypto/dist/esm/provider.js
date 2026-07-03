/** Global provider instance. Set once at startup. */
let _provider = null;
/** Set the crypto provider for the current runtime. */
export function setCryptoProvider(provider) {
    _provider = provider;
}
/** Get the active crypto provider. Throws if not initialized. */
export function getCryptoProvider() {
    if (!_provider) {
        throw new Error('CryptoProvider not initialized. Call setCryptoProvider() at startup.');
    }
    return _provider;
}
//# sourceMappingURL=provider.js.map