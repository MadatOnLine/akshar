/**
 * Anomaly Detection — background polling for unauthorized deletions.
 */
import { Server as SocketServer } from 'socket.io';
import { config } from '../config.js';
import * as messaging from './messaging.js';
import { initiateRecovery, replicateVault } from './recovery.js';

let knownMyWorkIds = new Set<string>();
let knownLockerIds = new Set<string>();
let replicationFactor: number = config.initialReplicationFactor;
let timer: ReturnType<typeof setInterval> | null = null;
let _io: SocketServer | null = null;
let _userId: string = '';

/**
 * Get current replication factor.
 */
export function getReplicationFactor(): number {
  return replicationFactor;
}

/**
 * Track a new message ID in the appropriate set.
 */
export function trackMyWork(msgId: string): void {
  knownMyWorkIds.add(msgId);
}

export function trackLocker(msgId: string): void {
  knownLockerIds.add(msgId);
}

/**
 * Seed the known sets from current CouchDB state.
 */
export async function seedFromDb(userId: string): Promise<void> {
  const myWork = await messaging.getMyWorkMessages(userId);
  for (const msg of myWork) {
    knownMyWorkIds.add(msg.msgId);
  }

  const locker = await messaging.getLockerMessages(userId);
  for (const msg of locker) {
    knownLockerIds.add(msg.msgId);
  }

  console.log(`[Anomaly] Seeded: ${knownMyWorkIds.size} My Work + ${knownLockerIds.size} Locker`);
}

/**
 * Start the anomaly detection polling loop.
 */
export function startDetector(userId: string, io: SocketServer): void {
  _io = io;
  _userId = userId;

  timer = setInterval(async () => {
    try {
      await pollForAnomalies();
    } catch (err: any) {
      console.error('[Anomaly] Poll error:', err.message);
    }
  }, config.anomalyPollInterval);
}

/**
 * Stop the polling loop.
 */
export function stopDetector(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * Single poll cycle — check for missing documents.
 */
async function pollForAnomalies(): Promise<void> {
  // Check My Work
  const currentMyWork = await messaging.getMyWorkMessages(_userId);
  const currentMyWorkIds = new Set(currentMyWork.map(m => m.msgId));

  const missingMyWork: string[] = [];
  for (const id of knownMyWorkIds) {
    if (!currentMyWorkIds.has(id)) {
      missingMyWork.push(id);
    }
  }

  if (missingMyWork.length > 0) {
    console.log(`[Anomaly] DETECTED: ${missingMyWork.length} My Work missing`);
    _io?.emit('ANOMALY_DETECTED', { missing: missingMyWork, count: missingMyWork.length, type: 'mywork' });

    // Double replication factor
    replicationFactor = Math.min(replicationFactor * 2, config.maxReplicationFactor);

    // Remove from known set to prevent re-firing
    for (const id of missingMyWork) knownMyWorkIds.delete(id);

    // Initiate recovery, then spread vault copies to all peers
    await initiateRecovery(missingMyWork, 'mywork', _userId, _io!);

    // After recovery, spread entire vault across peer lockers (exponential replication)
    setTimeout(async () => {
      try {
        await replicateVault(_userId, _io!);
      } catch (err: any) {
        console.error('[Anomaly] Vault replication failed:', err.message);
      }
    }, 5000);
  }

  // Check Locker
  const currentLocker = await messaging.getLockerMessages(_userId);
  const currentLockerIds = new Set(currentLocker.map(m => m.msgId));

  const missingLocker: string[] = [];
  for (const id of knownLockerIds) {
    if (!currentLockerIds.has(id)) {
      missingLocker.push(id);
    }
  }

  if (missingLocker.length > 0) {
    console.log(`[Anomaly] DETECTED: ${missingLocker.length} Locker missing`);
    _io?.emit('LOCKER_ANOMALY', { missing: missingLocker, count: missingLocker.length, type: 'locker' });

    for (const id of missingLocker) knownLockerIds.delete(id);

    await initiateRecovery(missingLocker, 'locker', _userId, _io!);
  }
}

/**
 * Get anomaly detector status.
 */
export function getStatus(): object {
  return {
    myWorkCount: knownMyWorkIds.size,
    lockerCount: knownLockerIds.size,
    replicationFactor,
    running: timer !== null,
  };
}
