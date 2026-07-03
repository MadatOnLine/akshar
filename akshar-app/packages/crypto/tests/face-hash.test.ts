import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { setCryptoProvider, NodeCryptoProvider, computeFaceHash, hammingDistance } from '../src/index.js';

beforeAll(() => {
  setCryptoProvider(new NodeCryptoProvider());
});

describe('computeFaceHash', () => {
  it('produces a 16-character hex string', () => {
    const pixels = Array.from({ length: 64 }, (_, i) => i * 4); // gradient
    const hash = computeFaceHash(pixels);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('same input produces same hash (deterministic)', () => {
    const pixels = Array.from({ length: 64 }, () => 128);
    const h1 = computeFaceHash(pixels);
    const h2 = computeFaceHash(pixels);
    expect(h1).toBe(h2);
  });

  it('different inputs produce different hashes', () => {
    const pixels1 = Array.from({ length: 64 }, (_, i) => i * 4);
    const pixels2 = Array.from({ length: 64 }, (_, i) => 255 - i * 4);
    const h1 = computeFaceHash(pixels1);
    const h2 = computeFaceHash(pixels2);
    expect(h1).not.toBe(h2);
  });

  it('throws on wrong pixel count', () => {
    expect(() => computeFaceHash([1, 2, 3])).toThrow('expected 64 pixels');
    expect(() => computeFaceHash([])).toThrow('expected 64 pixels');
  });
});

describe('hammingDistance', () => {
  it('identity: distance to self is 0', () => {
    expect(hammingDistance('abcdef0123456789', 'abcdef0123456789')).toBe(0);
  });

  it('symmetry: d(a,b) === d(b,a)', () => {
    const a = 'abcdef0123456789';
    const b = '1234567890abcdef';
    expect(hammingDistance(a, b)).toBe(hammingDistance(b, a));
  });

  it('maximum distance between 0x0 and 0xf...f is 64', () => {
    expect(hammingDistance('0000000000000000', 'ffffffffffffffff')).toBe(64);
  });

  it('single bit difference = distance 1', () => {
    // 0x0000000000000001 vs 0x0000000000000000 → 1 bit
    expect(hammingDistance('0000000000000001', '0000000000000000')).toBe(1);
  });

  it('returns 64 (max) on invalid hex input', () => {
    expect(hammingDistance('invalid', 'hex')).toBe(64);
    expect(hammingDistance('', '')).toBe(64);
  });

  it('PBT: bounds are always 0-64', () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 16, maxLength: 16 }),
        fc.hexaString({ minLength: 16, maxLength: 16 }),
        (a, b) => {
          const d = hammingDistance(a, b);
          expect(d).toBeGreaterThanOrEqual(0);
          expect(d).toBeLessThanOrEqual(64);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('PBT: symmetry holds for random hashes', () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 16, maxLength: 16 }),
        fc.hexaString({ minLength: 16, maxLength: 16 }),
        (a, b) => {
          expect(hammingDistance(a, b)).toBe(hammingDistance(b, a));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('PBT: identity holds for random hashes', () => {
    fc.assert(
      fc.property(fc.hexaString({ minLength: 16, maxLength: 16 }), (h) => {
        expect(hammingDistance(h, h)).toBe(0);
      }),
      { numRuns: 50 }
    );
  });
});
