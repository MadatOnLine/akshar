/**
 * CouchDB client using nano library.
 */
import Nano from 'nano';
import { config } from '../config.js';

const nano = Nano(config.couchdbUrl);

export const vaultDb = nano.db.use(config.vaultDb);
export const groupsDb = nano.db.use(config.groupsDb);
export const feedDb = nano.db.use(config.feedDb);
export const keysDb = nano.db.use(config.keysDb);

/**
 * Ensure all required databases exist.
 */
export async function initDatabases(): Promise<void> {
  const dbs = [config.vaultDb, config.groupsDb, config.feedDb, config.keysDb];
  for (const dbName of dbs) {
    try {
      await nano.db.create(dbName);
    } catch (err: any) {
      if (err.statusCode !== 412) { // 412 = already exists
        console.error(`Failed to create database ${dbName}:`, err.message);
      }
    }
  }
}

/**
 * Safe get — returns null if document not found.
 */
export async function safeGet(db: any, id: string): Promise<any | null> {
  try {
    return await db.get(id);
  } catch (err: any) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}
