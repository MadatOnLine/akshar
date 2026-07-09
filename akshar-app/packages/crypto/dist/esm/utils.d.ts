/**
 * Convert a Uint8Array to a lowercase hex string.
 */
export declare function toHex(bytes: Uint8Array): string;
/**
 * Convert a hex string to a Uint8Array.
 * @throws Error if hex string has odd length or invalid characters
 */
export declare function fromHex(hex: string): Uint8Array;
/**
 * Generate a unique message ID (UUID v4).
 * Uses cryptographically secure randomness.
 */
export declare function generateMsgId(): string;
/**
 * Robust UTF-8 Encoding for React Native / Hermes (avoids TextEncoder)
 */
export declare function stringToBytes(str: string): Uint8Array;
/**
 * Robust UTF-8 Decoding for React Native / Hermes (avoids TextDecoder)
 */
export declare function bytesToString(bytes: Uint8Array): string;
//# sourceMappingURL=utils.d.ts.map