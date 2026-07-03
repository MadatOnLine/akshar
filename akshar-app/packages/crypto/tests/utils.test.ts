import { describe, it, expect, beforeAll } from 'vitest';
import { setCryptoProvider, NodeCryptoProvider, generateMsgId, toHex, fromHex } from '../src/index.js';

beforeAll(() => {
  setCryptoProvider(new NodeCryptoProvider());
});

describe('generateMsgId', () => {
  it('produces a valid UUID v4 format', () => {
    const id = generateMsgId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateMsgId()));
    expect(ids.size).toBe(1000);
  });
});

describe('toHex / fromHex', () => {
  it('round-trip: fromHex(toHex(bytes)) === bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    const hex = toHex(bytes);
    const result = fromHex(hex);
    expect(result).toEqual(bytes);
  });

  it('toHex produces lowercase', () => {
    const bytes = new Uint8Array([171, 205, 239]); // 0xab, 0xcd, 0xef
    expect(toHex(bytes)).toBe('abcdef');
  });

  it('toHex zero-pads single digit bytes', () => {
    const bytes = new Uint8Array([0, 15]); // 0x00, 0x0f
    expect(toHex(bytes)).toBe('000f');
  });

  it('fromHex handles uppercase input', () => {
    const result = fromHex('ABCDEF');
    expect(result).toEqual(new Uint8Array([171, 205, 239]));
  });

  it('fromHex throws on odd-length string', () => {
    expect(() => fromHex('abc')).toThrow('even length');
  });

  it('fromHex throws on invalid hex characters', () => {
    expect(() => fromHex('zzzz')).toThrow('invalid hex');
  });

  it('empty input round-trip', () => {
    const empty = new Uint8Array(0);
    expect(fromHex(toHex(empty))).toEqual(empty);
  });
});
