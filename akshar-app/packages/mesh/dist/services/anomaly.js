import { config } from '../config.js';
import * as messaging from './messaging.js';
import { initiateRecovery, replicateVault } from './recovery.js';
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
    const myWorkIds = await messaging.getMyWorkMessageIds(userId);
    for (const id of myWorkIds) {
        knownMyWorkIds.add(id);
    }
    const lockerIds = await messaging.getLockerMessageIds(userId);
    for (const id of lockerIds) {
        knownLockerIds.add(id);
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
    const currentMyWorkIdsArr = await messaging.getMyWorkMessageIds(_userId);
    const currentMyWorkIds = new Set(currentMyWorkIdsArr);
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
        // Initiate recovery, then spread vault copies to all peers
        await initiateRecovery(missingMyWork, 'mywork', _userId, _io);
        // After recovery, spread entire vault across peer lockers (exponential replication)
        setTimeout(async () => {
            try {
                await replicateVault(_userId, _io);
            }
            catch (err) {
                console.error('[Anomaly] Vault replication failed:', err.message);
            }
        }, 5000);
    }
    // Check Locker
    const currentLockerIdsArr = await messaging.getLockerMessageIds(_userId);
    const currentLockerIds = new Set(currentLockerIdsArr);
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