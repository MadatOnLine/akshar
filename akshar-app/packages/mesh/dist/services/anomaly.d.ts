/**
 * Anomaly Detection — background polling for unauthorized deletions.
 */
import { Server as SocketServer } from 'socket.io';
/**
 * Get current replication factor.
 */
export declare function getReplicationFactor(): number;
/**
 * Track a new message ID in the appropriate set.
 */
export declare function trackMyWork(msgId: string): void;
export declare function trackLocker(msgId: string): void;
/**
 * Seed the known sets from current CouchDB state.
 */
export declare function seedFromDb(userId: string): Promise<void>;
/**
 * Start the anomaly detection polling loop.
 */
export declare function startDetector(userId: string, io: SocketServer): void;
/**
 * Stop the polling loop.
 */
export declare function stopDetector(): void;
/**
 * Get anomaly detector status.
 */
export declare function getStatus(): object;
