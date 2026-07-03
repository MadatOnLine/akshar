/**
 * CouchDB client using nano library.
 */
import Nano from 'nano';
export declare const vaultDb: Nano.DocumentScope<unknown>;
export declare const groupsDb: Nano.DocumentScope<unknown>;
export declare const feedDb: Nano.DocumentScope<unknown>;
export declare const keysDb: Nano.DocumentScope<unknown>;
/**
 * Ensure all required databases exist.
 */
export declare function initDatabases(): Promise<void>;
/**
 * Safe get — returns null if document not found.
 */
export declare function safeGet(db: any, id: string): Promise<any | null>;
