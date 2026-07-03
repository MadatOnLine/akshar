import type { EncryptedBlob, OnionHop, OnionPacket, PeeledLayer } from './types.js';
/**
 * Wrap a payload in 1-3 layers of onion encryption.
 * Builds from the inside out: innermost layer (final destination) encrypted first.
 *
 * @param payload - The cleartext object to deliver to the final hop
 * @param hops - 1-3 hop configurations ordered [first relay, ..., final destination]
 * @returns The outermost encrypted blob + the first hop address to send it to
 */
export declare function wrapOnion(payload: unknown, hops: OnionHop[]): OnionPacket;
/**
 * Peel one layer of onion encryption.
 *
 * @param encryptedPayload - The encrypted blob received at this hop
 * @param key - The AES-256-GCM key for this layer (our shared key with the sender)
 * @returns The inner blob + next hop address (null if this is the final destination), or null on decrypt failure
 */
export declare function peelOnion(encryptedPayload: EncryptedBlob, key: Uint8Array): PeeledLayer | null;
/**
 * Build a return-path onion (reverse route).
 * Semantically identical to wrapOnion but used for recovery responses.
 *
 * @param payload - The response payload to send back
 * @param reverseHops - Hops in reverse order (destination → origin)
 * @returns OnionPacket for the return path
 */
export declare function wrapReturnOnion(payload: unknown, reverseHops: OnionHop[]): OnionPacket;
//# sourceMappingURL=onion.d.ts.map