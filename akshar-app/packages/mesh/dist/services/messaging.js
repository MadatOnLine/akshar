/**
 * Message storage, broadcast, and backlog retrieval.
 */
import { v4 as uuidv4 } from 'uuid';
import { vaultDb, safeGet } from '../db/couch.js';
import { config } from '../config.js';
/**
 * Store an encrypted message in the vault.
 */
export async function storeMessage(fromNode, toNode, ciphertext) {
    const msgId = uuidv4();
    const doc = {
        _id: `msg:${msgId}`,
        msgId,
        fromNode,
        toNode,
        nonce: ciphertext.nonce,
        tag: ciphertext.tag,
        val: ciphertext.val,
        ts: Date.now(),
        type: 'message',
    };
    await vaultDb.insert(doc);
    return doc;
}
/**
 * Get message backlog for a group (most recent first).
 */
export async function getBacklog(groupId, limit) {
    try {
        const result = await vaultDb.find({
            selector: { toNode: groupId, type: 'message' },
            sort: [{ ts: 'desc' }],
            limit: limit || config.messageBacklogLimit,
        });
        return result.docs;
    }
    catch {
        // Fallback without sort if index doesn't exist
        const result = await vaultDb.find({
            selector: { toNode: groupId, type: 'message' },
            limit: limit || config.messageBacklogLimit,
        });
        return result.docs;
    }
}
/**
 * Get all messages where this user is a participant (for anomaly detection).
 */
export async function getMyWorkMessages(userId) {
    const result = await vaultDb.find({
        selector: {
            type: 'message',
            $or: [{ fromNode: userId }, { toNode: userId }],
        },
        limit: 10000,
    });
    return result.docs;
}
/**
 * Get all messages where this user is NOT a participant (locker/blind vault).
 */
export async function getLockerMessages(userId) {
    const result = await vaultDb.find({
        selector: {
            type: 'message',
            fromNode: { $ne: userId },
            toNode: { $ne: userId },
        },
        limit: 10000,
    });
    return result.docs;
}
/**
 * Store a vault document blindly (for replication — we can't decrypt it).
 */
export async function storeBlind(doc) {
    try {
        await vaultDb.insert({
            _id: `msg:${doc.msgId}`,
            ...doc,
            type: 'message',
        });
        return true;
    }
    catch (err) {
        if (err.statusCode === 409)
            return false; // already exists
        throw err;
    }
}
/**
 * Get specific messages by their IDs.
 */
export async function getByIds(msgIds) {
    const docs = [];
    for (const msgId of msgIds) {
        const doc = await safeGet(vaultDb, `msg:${msgId}`);
        if (doc)
            docs.push(doc);
    }
    return docs;
}
/**
 * Slim query: Get IDs of all messages where this user is a participant.
 */
export async function getMyWorkMessageIds(userId) {
    const result = await vaultDb.find({
        selector: {
            type: 'message',
            $or: [{ fromNode: userId }, { toNode: userId }],
        },
        fields: ['msgId'],
        limit: 50000,
    });
    return result.docs.map((d) => d.msgId);
}
/**
 * Slim query: Get IDs of all messages where this user is NOT a participant.
 */
export async function getLockerMessageIds(userId) {
    const result = await vaultDb.find({
        selector: {
            type: 'message',
            fromNode: { $ne: userId },
            toNode: { $ne: userId },
        },
        fields: ['msgId'],
        limit: 50000,
    });
    return result.docs.map((d) => d.msgId);
}
//# sourceMappingURL=messaging.js.map