import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import {
  setCryptoProvider,
  NodeCryptoProvider,
  generateKeyPair,
  deriveSharedKey,
  wrapOnion,
  peelOnion,
  wrapReturnOnion,
} from '../src/index.js';
import type { OnionHop } from '../src/types.js';

beforeAll(() => {
  setCryptoProvider(new NodeCryptoProvider());
});

function makeHop(addr: string): OnionHop {
  const a = generateKeyPair();
  const b = generateKeyPair();
  return {
    key: deriveSharedKey(a.privateKey, b.publicKey),
    nextAddr: addr,
  };
}

describe('wrapOnion / peelOnion', () => {
  it('1-hop: wrap and peel returns original payload', () => {
    const hop1 = makeHop('http://localhost:3001');
    const payload = { type: 'RECOVERY_REQUEST', data: 'hello' };
    const packet = wrapOnion(payload, [hop1]);

    expect(packet.firstHop).toBe('http://localhost:3001');

    const peeled = peelOnion(packet.ciphertext, hop1.key);
    expect(peeled).not.toBeNull();
    expect(peeled!.next).toBeNull(); // final destination
    expect(peeled!.inner).toEqual(payload);
  });

  it('2-hop: wrap and peel through two layers', () => {
    const hop1 = makeHop('http://localhost:3001');
    const hop2 = makeHop('http://localhost:3002');
    const payload = { message: 'secret' };
    const packet = wrapOnion(payload, [hop1, hop2]);

    expect(packet.firstHop).toBe('http://localhost:3001');

    // Peel layer 1
    const l1 = peelOnion(packet.ciphertext, hop1.key);
    expect(l1).not.toBeNull();
    expect(l1!.next).toBe('http://localhost:3002');

    // Peel layer 2
    const l2 = peelOnion(l1!.inner as any, hop2.key);
    expect(l2).not.toBeNull();
    expect(l2!.next).toBeNull();
    expect(l2!.inner).toEqual(payload);
  });

  it('3-hop: wrap and peel through three layers', () => {
    const hop1 = makeHop('http://localhost:3001');
    const hop2 = makeHop('http://localhost:3002');
    const hop3 = makeHop('http://localhost:3003');
    const payload = { type: 'RECOVERY_REQUEST', missingIds: ['abc', 'def'] };
    const packet = wrapOnion(payload, [hop1, hop2, hop3]);

    expect(packet.firstHop).toBe('http://localhost:3001');

    const l1 = peelOnion(packet.ciphertext, hop1.key);
    expect(l1!.next).toBe('http://localhost:3002');

    const l2 = peelOnion(l1!.inner as any, hop2.key);
    expect(l2!.next).toBe('http://localhost:3003');

    const l3 = peelOnion(l2!.inner as any, hop3.key);
    expect(l3!.next).toBeNull();
    expect(l3!.inner).toEqual(payload);
  });

  it('wrong key returns null', () => {
    const hop1 = makeHop('http://localhost:3001');
    const wrongKey = makeHop('http://wrong').key;
    const packet = wrapOnion({ data: 'test' }, [hop1]);
    const result = peelOnion(packet.ciphertext, wrongKey);
    expect(result).toBeNull();
  });

  it('throws on 0 hops', () => {
    expect(() => wrapOnion({}, [])).toThrow('requires 1-3 hops');
  });

  it('throws on 4 hops', () => {
    const hops = Array.from({ length: 4 }, (_, i) => makeHop(`http://hop${i}`));
    expect(() => wrapOnion({}, hops)).toThrow('requires 1-3 hops');
  });
});

describe('wrapReturnOnion', () => {
  it('works identically to wrapOnion', () => {
    const hop1 = makeHop('http://localhost:3001');
    const payload = { type: 'RECOVERY_RESPONSE', rows: [] };
    const packet = wrapReturnOnion(payload, [hop1]);

    const peeled = peelOnion(packet.ciphertext, hop1.key);
    expect(peeled!.inner).toEqual(payload);
  });
});

describe('PBT: onion round-trip', () => {
  it('1-hop round-trip for arbitrary payloads', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (payload) => {
        const hop = makeHop('http://test:3000');
        const packet = wrapOnion(payload, [hop]);
        const peeled = peelOnion(packet.ciphertext, hop.key);
        expect(peeled).not.toBeNull();
        expect(peeled!.inner).toEqual(payload);
        expect(peeled!.next).toBeNull();
      }),
      { numRuns: 30 }
    );
  });

  it('3-hop round-trip for arbitrary payloads', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (payload) => {
        const hops = [
          makeHop('http://a:3001'),
          makeHop('http://b:3002'),
          makeHop('http://c:3003'),
        ];
        const packet = wrapOnion(payload, hops);

        const l1 = peelOnion(packet.ciphertext, hops[0].key);
        const l2 = peelOnion(l1!.inner as any, hops[1].key);
        const l3 = peelOnion(l2!.inner as any, hops[2].key);

        expect(l3).not.toBeNull();
        expect(l3!.inner).toEqual(payload);
        expect(l3!.next).toBeNull();
      }),
      { numRuns: 20 }
    );
  });
});
