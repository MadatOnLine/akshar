import { config } from '../config.js';
import * as messaging from './messaging.js';
import { initiateRecovery } from './recovery.js';
let knownMyWorkIds = new Set();
let knownLockerIds = new Set();
let replicationFactor = config.initialReplicationFactor;
let timer = null;
let _io = null;
let _userId = '';
/**
 * Get current replication factor.
 */
export function getReplicationFactor() {
    return replicationFactor;
}
/**
 * Track a new message ID in the appropriate set.
 */
export function trackMyWork(msgId) {
    knownMyWorkIds.add(msgId);
}
export function trackLocker(msgId) {
    knownLockerIds.add(msgId);
}
/**
 * Seed the known sets from current CouchDB state.
 */
export async function seedFromDb(userId) {
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
export function startDetector(userId, io) {
    _io = io;
    _userId = userId;
    timer = setInterval(async () => {
        try {
            await pollForAnomalies();
        }
        catch (err) {
            console.error('[Anomaly] Poll error:', err.message);
        }
    }, config.anomalyPollInterval);
}
/**
 * Stop the polling loop.
 */
export function stopDetector() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}
/**
 * Single poll cycle — check for missing documents.
 */
async function pollForAnomalies() {
    // Check My Work
    const currentMyWork = await messaging.getMyWorkMessages(_userId);
    const currentMyWorkIds = new Set(currentMyWork.map(m => m.msgId));
    const missingMyWork = [];
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
        for (const id of missingMyWork)
            knownMyWorkIds.delete(id);
        // Initiate recovery
        await initiateRecovery(missingMyWork, 'mywork', _userId, _io);
    }
    // Check Locker
    const currentLocker = await messaging.getLockerMessages(_userId);
    const currentLockerIds = new Set(currentLocker.map(m => m.msgId));
    const missingLocker = [];
    for (const id of knownLockerIds) {
        if (!currentLockerIds.has(id)) {
            missingLocker.push(id);
        }
    }
    if (missingLocker.length > 0) {
        console.log(`[Anomaly] DETECTED: ${missingLocker.length} Locker missing`);
        _io?.emit('LOCKER_ANOMALY', { missing: missingLocker, count: missingLocker.length, type: 'locker' });
        for (const id of missingLocker)
            knownLockerIds.delete(id);
        await initiateRecovery(missingLocker, 'locker', _userId, _io);
    }
}
/**
 * Get anomaly detector status.
 */
export function getStatus() {
    return {
        myWorkCount: knownMyWorkIds.size,
        lockerCount: knownLockerIds.size,
        replicationFactor,
        running: timer !== null,
    };
}
//# sourceMappingURL=anomaly.js.map