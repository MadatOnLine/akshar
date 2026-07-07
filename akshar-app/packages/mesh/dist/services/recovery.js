import { wrapOnion, peelOnion } from '@akshar/crypto';
import * as messaging from './messaging.js';
import * as anomaly from './anomaly.js';
import { config } from '../config.js';
// In-memory peer key store (loaded from CouchDB on startup)
const peerKeys = new Map();
/**
 * Register a peer's ECDH-derived AES key and address.
 */
export function registerPeer(peerId, key, addr) {
    peerKeys.set(peerId, { key, addr });
}
/**
 * Get all registered peer IDs.
 */
export function getPeerIds() {
    return Array.from(peerKeys.keys());
}
/**
 * Initiate onion-routed recovery for missing message IDs.
 */
export async function initiateRecovery(missingIds, recoveryType, userId, io) {
    const peers = Array.from(peerKeys.entries());
    if (peers.length === 0) {
        console.log('[Recovery] No peers available for recovery');
        io.emit('sys', 'Recovery failed: no peers connected');
        return;
    }
    console.log(`[Recovery] Initiating ${recoveryType} recovery for ${missingIds.length} msgId(s)`);
    const batchSize = 5;
    for (let i = 0; i < peers.length; i += batchSize) {
        const batch = peers.slice(i, i + batchSize);
        await Promise.allSettled(batch.map(async ([targetId, targetInfo]) => {
            const otherPeers = peers.filter(([id]) => id !== targetId);
            // Build hop list (max 3)
            const hops = [];
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
            }
            catch (err) {
                console.error(`[Recovery] Dispatch to ${targetId} failed:`, err.message);
            }
        }));
    }
}
/**
 * Handle a relay request — peel one layer and forward or process.
 */
export async function handleRelay(encryptedPayload, userId, io) {
    // Try each peer key to peel
    let peeled = null;
    for (const [, peerInfo] of peerKeys) {
        peeled = peelOnion(encryptedPayload, peerInfo.key);
        if (peeled)
            break;
    }
    if (!peeled) {
        return { status: 'cannot_decrypt' };
    }
    // If there's a next hop, forward asynchronously (fire-and-forget)
    if (peeled.next) {
        const nextHopUrl = peeled.next;
        const nextPayload = peeled.inner;
        // Fire asynchronously to avoid blocking the Express request pool
        fetch(`${nextHopUrl}/mesh/relay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedPayload: nextPayload }),
            signal: AbortSignal.timeout(10000),
        }).catch(err => {
            console.error(`[Relay] Forwarding to ${nextHopUrl} failed:`, err.message);
        });
        return { status: 'forwarded_async' };
    }
    // Final destination — process payload
    const payload = peeled.inner;
    if (payload?.type === 'RECOVERY_REQUEST') {
        const found = await messaging.getByIds(payload.missingIds);
        console.log(`[Relay] Found ${found.length}/${payload.missingIds.length} requested rows`);
        // Build return onion if return path exists
        if (payload.returnPath?.length > 0 && found.length > 0) {
            const returnHops = payload.returnPath
                .map((rp) => {
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
                }
                catch { }
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
/**
 * Exponential Vault Replication — spread vault data to all peer lockers.
 *
 * After a successful recovery, sends REPLICATE_VAULT onion payloads to all
 * peers, asking them to store copies in their blind vaults. This matches
 * the research TrueP2PMessenger's behavior where each threat doubles the
 * replication factor and the recovered data is spread across the mesh.
 */
export async function replicateVault(userId, io) {
    const peers = Array.from(peerKeys.entries());
    if (peers.length === 0) {
        console.log('[Replication] No peers available for vault spread');
        return;
    }
    // Gather all vault data for replication
    const myWork = await messaging.getMyWorkMessages(userId);
    const locker = await messaging.getLockerMessages(userId);
    const allRows = [...myWork, ...locker];
    if (allRows.length === 0)
        return;
    const factor = anomaly.getReplicationFactor();
    console.log(`[Replication] Spreading ${allRows.length} row(s) to ${peers.length} peers (factor: ×${factor})`);
    io.emit('sys', `Spreading ${allRows.length} record(s) across ${peers.length} peer lockers (replication factor: ×${factor})`);
    const batchSize = 5;
    for (let i = 0; i < peers.length; i += batchSize) {
        const batch = peers.slice(i, i + batchSize);
        await Promise.allSettled(batch.map(async ([targetId, targetInfo]) => {
            const otherPeers = peers.filter(([id]) => id !== targetId);
            // Build hop list (max 3 hops via intermediates)
            const hops = [];
            for (const [, peerInfo] of otherPeers.slice(0, 2)) {
                hops.push({ key: peerInfo.key, nextAddr: peerInfo.addr });
            }
            hops.push({ key: targetInfo.key, nextAddr: targetInfo.addr });
            const payload = {
                type: 'REPLICATE_VAULT',
                rows: allRows.map(r => ({
                    msgId: r.msgId,
                    fromNode: r.fromNode,
                    toNode: r.toNode,
                    nonce: r.nonce,
                    tag: r.tag,
                    val: r.val,
                    ts: r.ts,
                })),
                originNode: userId,
                replicationFactor: factor,
            };
            try {
                const onion = wrapOnion(payload, hops.slice(0, 3));
                await fetch(`${onion.firstHop}/mesh/relay`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ encryptedPayload: onion.ciphertext }),
                    signal: AbortSignal.timeout(15000),
                });
                console.log(`[Replication] Vault replicated to ${targetId}`);
            }
            catch (err) {
                console.error(`[Replication] Dispatch to ${targetId} failed:`, err.message);
            }
        }));
    }
    io.emit('REPLICATION_SPREAD', {
        factor,
        rows: allRows.length,
        peers: peers.length,
        node: userId,
    });
}
//# sourceMappingURL=recovery.js.map