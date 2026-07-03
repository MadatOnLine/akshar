/**
 * Message storage, broadcast, and backlog retrieval.
 */
import { v4 as uuidv4 } from 'uuid';
import { vaultDb, safeGet } from '../db/couch.js';
import { config } from '../config.js';

export interface EncryptedMessage {
  nonce: string;
  tag: string;
  val: string;
}

export interface StoredMessage {
  msgId: string;
  fromNode: string;
  toNode: string;
  nonce: string;
  tag: string;
  val: string;
  ts: number;
}

/**
 * Store an encrypted message in the vault.
 */
export async function storeMessage(
  fromNode: string,
  toNode: string,
  ciphertext: EncryptedMessage
): Promise<StoredMessage> {
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
  return doc as StoredMessage;
}

/**
 * Get message backlog for a group (most recent first).
 */
export async function getBacklog(groupId: string, limit?: number): Promise<StoredMessage[]> {
  try {
    const result = await vaultDb.find({
      selector: { toNode: groupId, type: 'message' },
      sort: [{ ts: 'desc' as any }],
      limit: limit || config.messageBacklogLimit,
    });
    return result.docs as unknown as StoredMessage[];
  } catch {
    // Fallback without sort if index doesn't exist
    const result = await vaultDb.find({
      selector: { toNode: groupId, type: 'message' },
      limit: limit || config.messageBacklogLimit,
    });
    return result.docs as unknown as StoredMessage[];
  }
}

/**
 * Get all messages where this user is a participant (for anomaly detection).
 */
export async function getMyWorkMessages(userId: string): Promise<StoredMessage[]> {
  const result = await vaultDb.find({
    selector: {
      type: 'message',
      $or: [{ fromNode: userId }, { toNode: userId }],
    },
    limit: 10000,
  });
  return result.docs as unknown as StoredMessage[];
}

/**
 * Get all messages where this user is NOT a participant (locker/blind vault).
 */
export async function getLockerMessages(userId: string): Promise<StoredMessage[]> {
  const result = await vaultDb.find({
    selector: {
      type: 'message',
      fromNode: { $ne: userId },
      toNode: { $ne: userId },
    },
    limit: 10000,
  });
  return result.docs as unknown as StoredMessage[];
}

/**
 * Store a vault document blindly (for replication — we can't decrypt it).
 */
export async function storeBlind(doc: StoredMessage): Promise<boolean> {
  try {
    await vaultDb.insert({
      _id: `msg:${doc.msgId}`,
      ...doc,
      type: 'message',
    });
    return true;
  } catch (err: any) {
    if (err.statusCode === 409) return false; // already exists
    throw err;
  }
}

/**
 * Get specific messages by their IDs.
 */
export async function getByIds(msgIds: string[]): Promise<StoredMessage[]> {
  const docs: StoredMessage[] = [];
  for (const msgId of msgIds) {
    const doc = await safeGet(vaultDb, `msg:${msgId}`);
    if (doc) docs.push(doc);
  }
  return docs;
}
