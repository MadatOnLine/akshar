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
export declare function storeMessage(fromNode: string, toNode: string, ciphertext: EncryptedMessage): Promise<StoredMessage>;
/**
 * Get message backlog for a group (most recent first).
 */
export declare function getBacklog(groupId: string, limit?: number): Promise<StoredMessage[]>;
/**
 * Get all messages where this user is a participant (for anomaly detection).
 */
export declare function getMyWorkMessages(userId: string): Promise<StoredMessage[]>;
/**
 * Get all messages where this user is NOT a participant (locker/blind vault).
 */
export declare function getLockerMessages(userId: string): Promise<StoredMessage[]>;
/**
 * Store a vault document blindly (for replication — we can't decrypt it).
 */
export declare function storeBlind(doc: StoredMessage): Promise<boolean>;
/**
 * Get specific messages by their IDs.
 */
export declare function getByIds(msgIds: string[]): Promise<StoredMessage[]>;
/**
 * Slim query: Get IDs of all messages where this user is a participant.
 */
export declare function getMyWorkMessageIds(userId: string): Promise<string[]>;
/**
 * Slim query: Get IDs of all messages where this user is NOT a participant.
 */
export declare function getLockerMessageIds(userId: string): Promise<string[]>;
