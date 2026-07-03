import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { setCryptoProvider, NodeCryptoProvider, generateKeyPair, deriveSharedKey } from '../src/index.js';

beforeAll(() => {
  setCryptoProvider(new NodeCryptoProvider());
});

describe('generateKeyPair', () => {
  it('produces a valid key pair with hex-encoded keys', () => {
    const kp = generateKeyPair();
    expect(kp.publicKey).toMatch(/^[0-9a-f]+$/);
    expect(kp.privateKey).toMatch(/^[0-9a-f]{64}$/);
    // Uncompressed secp256k1 public key = 65 bytes = 130 hex chars
    expect(kp.publicKey.length).toBe(130);
  });

  it('generates different keys each time', () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    expect(kp1.privateKey).not.toBe(kp2.privateKey);
    expect(kp1.publicKey).not.toBe(kp2.publicKey);
  });
});

describe('deriveSharedKey', () => {
  it('derives a 32-byte key', () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    const shared = deriveSharedKey(a.privateKey, b.publicKey);
    expect(shared).toBeInstanceOf(Uint8Array);
    expect(shared.length).toBe(32);
  });

  it('ECDH symmetry: A→B equals B→A', () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    const sharedAB = deriveSharedKey(a.privateKey, b.publicKey);
    const sharedBA = deriveSharedKey(b.privateKey, a.publicKey);
    expect(sharedAB).toEqual(sharedBA);
  });

  it('PBT: shared key symmetry holds for random key pairs', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const a = generateKeyPair();
        const b = generateKeyPair();
        const sharedAB = deriveSharedKey(a.privateKey, b.publicKey);
        const sharedBA = deriveSharedKey(b.privateKey, a.publicKey);
        expect(sharedAB).toEqual(sharedBA);
      }),
      { numRuns: 20 }
    );
  });

  it('throws on invalid private key', () => {
    const b = generateKeyPair();
    expect(() => deriveSharedKey('abcd', b.publicKey)).toThrow();
  });

  it('throws on invalid public key', () => {
    const a = generateKeyPair();
    expect(() => deriveSharedKey(a.privateKey, 'xyz')).toThrow();
  });
});
