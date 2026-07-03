/**
 * Utilities — Hex encoding, UUID generation, and shared helpers.
 */
import { v4 as uuidv4 } from 'uuid';
/**
 * Convert a Uint8Array to a lowercase hex string.
 */
export function toHex(bytes) {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
/**
 * Convert a hex string to a Uint8Array.
 * @throws Error if hex string has odd length or invalid characters
 */
export function fromHex(hex) {
    const clean = hex.toLowerCase();
    if (clean.length % 2 !== 0) {
        throw new Error('fromHex: hex string must have even length');
    }
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        const byte = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
        if (isNaN(byte)) {
            throw new Error(`fromHex: invalid hex character at position ${i * 2}`);
        }
        bytes[i] = byte;
    }
    return bytes;
}
/**
 * Generate a unique message ID (UUID v4).
 * Uses cryptographically secure randomness.
 */
export function generateMsgId() {
    return uuidv4();
}
//# sourceMappingURL=utils.js.map