"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bytesToString = exports.stringToBytes = exports.generateMsgId = exports.fromHex = exports.toHex = void 0;
/**
 * Utilities — Hex encoding, UUID generation, and shared helpers.
 */
const uuid_1 = require("uuid");
/**
 * Convert a Uint8Array to a lowercase hex string.
 */
function toHex(bytes) {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
exports.toHex = toHex;
/**
 * Convert a hex string to a Uint8Array.
 * @throws Error if hex string has odd length or invalid characters
 */
function fromHex(hex) {
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
exports.fromHex = fromHex;
/**
 * Generate a unique message ID (UUID v4).
 * Uses cryptographically secure randomness.
 */
function generateMsgId() {
    return (0, uuid_1.v4)();
}
exports.generateMsgId = generateMsgId;
/**
 * Robust UTF-8 Encoding for React Native / Hermes (avoids TextEncoder)
 */
function stringToBytes(str) {
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(str);
    }
    const utf8 = unescape(encodeURIComponent(str));
    const result = new Uint8Array(utf8.length);
    for (let i = 0; i < utf8.length; i++) {
        result[i] = utf8.charCodeAt(i);
    }
    return result;
}
exports.stringToBytes = stringToBytes;
/**
 * Robust UTF-8 Decoding for React Native / Hermes (avoids TextDecoder)
 */
function bytesToString(bytes) {
    if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder().decode(bytes);
    }
    let utf8 = '';
    for (let i = 0; i < bytes.length; i++) {
        utf8 += String.fromCharCode(bytes[i]);
    }
    try {
        return decodeURIComponent(escape(utf8));
    }
    catch (err) {
        return utf8; // Fallback if invalid
    }
}
exports.bytesToString = bytesToString;
//# sourceMappingURL=utils.js.map