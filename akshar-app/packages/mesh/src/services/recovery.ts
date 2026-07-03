/**
 * Onion-routed recovery — request missing data via privacy-preserving multi-hop encryption.
 */
import { Server as SocketServer } from 'socket.io';
import { wrapOnion, peelOnion } from '@akshar/crypto';
import type { OnionHop, EncryptedBlob } from '@akshar/crypto';
import * as messaging from './messaging.js';
import * as anomaly from './anomaly.js';
import { keysDb } from '../db/couch.js';
import { config } from '../config.js';

// In-memory peer key store (loaded from CouchDB on startup)
const peerKeys: Map<string, { key: Uint8Array; addr: string }> = new Map();

/**
 * Register a peer's ECDH-derived AES key and address.
 */
export function registerPeer(peerId: string, key: Uint8Array, addr: string): void {
  peerKeys.set(peerId, { key, addr });
}

/**
 * Get all registered peer IDs.
 */
export function getPeerIds(): string[] {
  return Array.from(peerKeys.keys());
}

/**
 * Initiate onion-routed recovery for missing message IDs.
 */
export async function initiateRecovery(
  missingIds: string[],
  recoveryType: 'mywork' | 'locker',
  userId: string,
  io: SocketServer
): Promise<void> {
  const peers = Array.from(peerKeys.entries());
  if (peers.length === 0) {
    console.log('[Recovery] No peers available for recovery');
    io.emit('sys', 'Recovery failed: no peers connected');
    return;
  }

  console.log(`[Recovery] Initiating ${recoveryType} recovery for ${missingIds.length} msgId(s)`);

  for (const [targetId, targetInfo] of peers) {
    const otherPeers = peers.filter(([id]) => id !== targetId);

    // Build hop list (max 3)
    const hops: OnionHop[] = [];
    for (const [, peerInfo] of otherPeers.slice(0, 2)) {
      hops.push({ key: peerInfo.key, nextAddr: peerInfo.addr });
    }
    hops.push({ key: targetInfo.key, nextAddr: targetInfo.addr });

    // Build return path
    const returnPath = [
      ...otherPeers.slice(0, 2).map(([id]) => ({ node: id })).reverse(),
      { node: userId },
    ];

    const payload = {
      type: 'RECOVERY_REQUEST',
      missingIds,
      originNode: userId,
      returnPath,
      recoveryType,
    };

    try {
      const onion = wrapOnion(payload, hops.slice(0, 3));
      const resp = await fetch(`${onion.firstHop}/mesh/relay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedPayload: onion.ciphertext }),
        signal: AbortSignal.timeout(config.aiTimeout * 2),
      });
      if (resp.ok) {
        console.log(`[Recovery] Onion dispatched to ${targetId}`);
      }
    } catch (err: any) {
      console.error(`[Recovery] Dispatch to ${targetId} failed:`, err.message);
    }
  }
}

/**
 * Handle a relay request — peel one layer and forward or process.
 */
export async function handleRelay(
  encryptedPayload: EncryptedBlob,
  userId: string,
  io: SocketServer
): Promise<{ status: string; data?: any }> {
  // Try each peer key to peel
  let peeled: any = null;

  for (const [, peerInfo] of peerKeys) {
    peeled = peelOnion(encryptedPayload, peerInfo.key);
    if (peeled) break;
  }

  if (!peeled) {
    return { status: 'cannot_decrypt' };
  }

  // If there's a next hop, forward
  if (peeled.next) {
    try {
      const resp = await fetch(`${peeled.next}/mesh/relay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedPayload: peeled.inner }),
        signal: AbortSignal.timeout(10000),
      });
      return await resp.json();
    } catch (err: any) {
      return { status: 'forward_failed' };
    }
  }

  // Final destination — process payload
  const payload = peeled.inner as any;

  if (payload?.type === 'RECOVERY_REQUEST') {
    const found = await messaging.getByIds(payload.missingIds);
    console.log(`[Relay] Found ${found.length}/${payload.missingIds.length} requested rows`);

    // Build return onion if return path exists
    if (payload.returnPath?.length > 0 && found.length > 0) {
      const returnHops: OnionHop[] = payload.returnPath
        .map((rp: any) => {
          const peer = peerKeys.get(rp.node);
          return peer ? { key: peer.key, nextAddr: peer.addr } : null;
        })
        .filter(Boolean);

      if (returnHops.length > 0) {
        const responsePayload = {
          type: 'RECOVERY_RESPONSE',
          rows: found,
          originNode: payload.originNode,
          recoveryType: payload.recoveryType,
        };

        const returnOnion = wrapOnion(responsePayload, returnHops.slice(0, 3));
        try {
          await fetch(`${returnOnion.firstHop}/mesh/relay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedPayload: returnOnion.ciphertext }),
          });
        } catch {}
      }
    }

    return { status: 'recovery_dispatched', data: { found: found.length } };
  }

  if (payload?.type === 'RECOVERY_RESPONSE') {
    // Rehydrate — re-insert recovered rows
    let recovered = 0;
    for (const row of payload.rows || []) {
      const stored = await messaging.storeBlind(row);
      if (stored) {
        anomaly.trackMyWork(row.msgId);
        recovered++;
      }
    }

    io.emit('RECOVERY_COMPLETE', { recovered, total: payload.rows?.length || 0 });
    console.log(`[Relay] Rehydrated ${recovered} rows`);
    return { status: 'rehydrated', data: { recovered } };
  }

  if (payload?.type === 'REPLICATE_VAULT') {
    let stored = 0;
    for (const row of payload.rows || []) {
      const ok = await messaging.storeBlind(row);
      if (ok) {
        anomaly.trackLocker(row.msgId);
        stored++;
      }
    }

    io.emit('REPLICATION_RECEIVED', { stored, from: payload.originNode });
    return { status: 'replicated', data: { stored } };
  }

  return { status: 'unknown_payload' };
}
