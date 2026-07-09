/**
 * Utilities — Hex encoding, UUID generation, and shared helpers.
 */
import { v4 as uuidv4 } from 'uuid';

/**
 * Convert a Uint8Array to a lowercase hex string.
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a hex string to a Uint8Array.
 * @throws Error if hex string has odd length or invalid characters
 */
export function fromHex(hex: string): Uint8Array {
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
export function generateMsgId(): string {
  return uuidv4();
}

/**
 * Robust UTF-8 Encoding for React Native / Hermes (avoids TextEncoder)
 */
export function stringToBytes(str: string): Uint8Array {
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

/**
 * Robust UTF-8 Decoding for React Native / Hermes (avoids TextDecoder)
 */
export function bytesToString(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }
  let utf8 = '';
  for (let i = 0; i < bytes.length; i++) {
    utf8 += String.fromCharCode(bytes[i]);
  }
  try {
    return decodeURIComponent(escape(utf8));
  } catch (err) {
    return utf8; // Fallback if invalid
  }
}
