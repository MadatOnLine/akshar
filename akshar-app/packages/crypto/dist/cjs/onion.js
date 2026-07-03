"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapReturnOnion = exports.peelOnion = exports.wrapOnion = void 0;
/**
 * Onion Router — Multi-hop AES-256-GCM onion encryption.
 *
 * Provides 1-3 layer wrapping where each layer encrypts the next-hop address.
 * Intermediate relays only learn the immediate next hop — never origin or destination.
 */
const encryption_js_1 = require("./encryption.js");
/**
 * Wrap a payload in 1-3 layers of onion encryption.
 * Builds from the inside out: innermost layer (final destination) encrypted first.
 *
 * @param payload - The cleartext object to deliver to the final hop
 * @param hops - 1-3 hop configurations ordered [first relay, ..., final destination]
 * @returns The outermost encrypted blob + the first hop address to send it to
 */
function wrapOnion(payload, hops) {
    if (hops.length < 1 || hops.length > 3) {
        throw new Error(`wrapOnion requires 1-3 hops, got ${hops.length}`);
    }
    // Build from the inside out
    // Layer N (innermost): payload, next = null (final destination)
    let current = (0, encryption_js_1.encrypt)(hops[hops.length - 1].key, JSON.stringify({ inner: payload, next: null }));
    // Work outward: each layer wraps the previous, adding next-hop address
    for (let i = hops.length - 2; i >= 0; i--) {
        current = (0, encryption_js_1.encrypt)(hops[i].key, JSON.stringify({ inner: current, next: hops[i + 1].nextAddr }));
    }
    return {
        ciphertext: current,
        firstHop: hops[0].nextAddr,
    };
}
exports.wrapOnion = wrapOnion;
/**
 * Peel one layer of onion encryption.
 *
 * @param encryptedPayload - The encrypted blob received at this hop
 * @param key - The AES-256-GCM key for this layer (our shared key with the sender)
 * @returns The inner blob + next hop address (null if this is the final destination), or null on decrypt failure
 */
function peelOnion(encryptedPayload, key) {
    const plaintext = (0, encryption_js_1.decrypt)(key, encryptedPayload.nonce, encryptedPayload.tag, encryptedPayload.val);
    if (plaintext === null) {
        return null;
    }
    try {
        const parsed = JSON.parse(plaintext);
        return {
            inner: parsed.inner,
            next: parsed.next,
        };
    }
    catch {
        return null;
    }
}
exports.peelOnion = peelOnion;
/**
 * Build a return-path onion (reverse route).
 * Semantically identical to wrapOnion but used for recovery responses.
 *
 * @param payload - The response payload to send back
 * @param reverseHops - Hops in reverse order (destination → origin)
 * @returns OnionPacket for the return path
 */
function wrapReturnOnion(payload, reverseHops) {
    return wrapOnion(payload, reverseHops);
}
exports.wrapReturnOnion = wrapReturnOnion;
//# sourceMappingURL=onion.js.map