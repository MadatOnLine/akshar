import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import {
  setCryptoProvider,
  NodeCryptoProvider,
  generateKeyPair,
  deriveSharedKey,
  encrypt,
  decrypt,
  ratchetKey,
} from '../src/index.js';

beforeAll(() => {
  setCryptoProvider(new NodeCryptoProvider());
});

function makeKey(): Uint8Array {
  const a = generateKeyPair();
  const b = generateKeyPair();
  return deriveSharedKey(a.privateKey, b.publicKey);
}

describe('encrypt', () => {
  it('produces an EncryptedBlob with correct field lengths', () => {
    const key = makeKey();
    const blob = encrypt(key, 'hello world');
    expect(blob.nonce).toMatch(/^[0-9a-f]{24}$/); // 12 bytes = 24 hex
    expect(blob.tag).toMatch(/^[0-9a-f]{32}$/);   // 16 bytes = 32 hex
    expect(blob.val).toMatch(/^[0-9a-f]+$/);
    expect(blob.val.length).toBeGreaterThan(0);
  });

  it('generates unique nonces on each call', () => {
    const key = makeKey();
    const b1 = encrypt(key, 'same text');
    const b2 = encrypt(key, 'same text');
    expect(b1.nonce).not.toBe(b2.nonce);
  });

  it('throws on invalid key length', () => {
    const shortKey = new Uint8Array(16);
    expect(() => encrypt(shortKey, 'test')).toThrow();
  });
});

describe('decrypt', () => {
  it('round-trip: decrypt(encrypt(plaintext)) === plaintext', () => {
    const key = makeKey();
    const plaintext = 'The quick brown fox jumps over the lazy dog';
    const blob = encrypt(key, plaintext);
    const result = decrypt(key, blob.nonce, blob.tag, blob.val);
    expect(result).toBe(plaintext);
  });

  it('returns null on wrong key', () => {
    const key1 = makeKey();
    const key2 = makeKey();
    const blob = encrypt(key1, 'secret');
    const result = decrypt(key2, blob.nonce, blob.tag, blob.val);
    expect(result).toBeNull();
  });

  it('returns null on tampered ciphertext', () => {
    const key = makeKey();
    const blob = encrypt(key, 'secret');
    // Flip a character in the ciphertext
    const tampered = blob.val.slice(0, -1) + (blob.val.slice(-1) === '0' ? '1' : '0');
    const result = decrypt(key, blob.nonce, blob.tag, tampered);
    expect(result).toBeNull();
  });

  it('returns null on tampered tag', () => {
    const key = makeKey();
    const blob = encrypt(key, 'secret');
    const tamperedTag = '0'.repeat(32);
    const result = decrypt(key, blob.nonce, tamperedTag, blob.val);
    expect(result).toBeNull();
  });

  it('returns null on invalid hex input', () => {
    const key = makeKey();
    expect(decrypt(key, 'invalid', 'hex', 'data')).toBeNull();
  });

  it('returns null on wrong key length', () => {
    const shortKey = new Uint8Array(16);
    expect(decrypt(shortKey, '0'.repeat(24), '0'.repeat(32), '0'.repeat(10))).toBeNull();
  });

  it('handles empty string encryption', () => {
    const key = makeKey();
    const blob = encrypt(key, '');
    const result = decrypt(key, blob.nonce, blob.tag, blob.val);
    expect(result).toBe('');
  });

  it('handles unicode text', () => {
    const key = makeKey();
    const plaintext = 'अक्षर — That which does not perish 🔐';
    const blob = encrypt(key, plaintext);
    const result = decrypt(key, blob.nonce, blob.tag, blob.val);
    expect(result).toBe(plaintext);
  });
});

describe('PBT: encrypt/decrypt round-trip', () => {
  it('round-trip holds for arbitrary strings', () => {
    const key = makeKey();
    fc.assert(
      fc.property(fc.string(), (plaintext) => {
        const blob = encrypt(key, plaintext);
        const result = decrypt(key, blob.nonce, blob.tag, blob.val);
        expect(result).toBe(plaintext);
      }),
      { numRuns: 100 }
    );
  });

  it('round-trip holds for arbitrary keys and strings', () => {
    fc.assert(
      fc.property(fc.string(), () => {
        const key = makeKey();
        const plaintext = 'test-' + Math.random().toString(36);
        const blob = encrypt(key, plaintext);
        const result = decrypt(key, blob.nonce, blob.tag, blob.val);
        expect(result).toBe(plaintext);
      }),
      { numRuns: 50 }
    );
  });

  it('tamper detection: flipping any bit in val causes null return', () => {
    const key = makeKey();
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (plaintext, flipPos) => {
          const blob = encrypt(key, plaintext);
          if (blob.val.length === 0) return; // skip empty
          const idx = flipPos % blob.val.length;
          const chars = blob.val.split('');
          chars[idx] = chars[idx] === '0' ? '1' : '0';
          const tampered = chars.join('');
          const result = decrypt(key, blob.nonce, blob.tag, tampered);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('ratchetKey (Forward Secrecy)', () => {
  it('deterministically hashes the key to a new 32-byte key', () => {
    const key = makeKey();
    const nextKey = ratchetKey(key);
    expect(nextKey).toBeInstanceOf(Uint8Array);
    expect(nextKey.length).toBe(32);
    // It should not be the same key
    expect(nextKey).not.toEqual(key);
    // It should be deterministic
    const nextKeyAgain = ratchetKey(key);
    expect(nextKey).toEqual(nextKeyAgain);
  });

  it('throws on invalid key length', () => {
    const shortKey = new Uint8Array(16);
    expect(() => ratchetKey(shortKey)).toThrow();
  });
});

