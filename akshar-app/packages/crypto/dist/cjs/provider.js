"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCryptoProvider = exports.setCryptoProvider = void 0;
/** Global provider instance. Set once at startup. */
let _provider = null;
/** Set the crypto provider for the current runtime. */
function setCryptoProvider(provider) {
    _provider = provider;
}
exports.setCryptoProvider = setCryptoProvider;
/** Get the active crypto provider. Throws if not initialized. */
function getCryptoProvider() {
    if (!_provider) {
        throw new Error('CryptoProvider not initialized. Call setCryptoProvider() at startup.');
    }
    return _provider;
}
exports.getCryptoProvider = getCryptoProvider;
//# sourceMappingURL=provider.js.map