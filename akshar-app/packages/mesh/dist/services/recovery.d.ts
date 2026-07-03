/**
 * Onion-routed recovery — request missing data via privacy-preserving multi-hop encryption.
 */
import { Server as SocketServer } from 'socket.io';
import type { EncryptedBlob } from '@akshar/crypto';
/**
 * Register a peer's ECDH-derived AES key and address.
 */
export declare function registerPeer(peerId: string, key: Uint8Array, addr: string): void;
/**
 * Get all registered peer IDs.
 */
export declare function getPeerIds(): string[];
/**
 * Initiate onion-routed recovery for missing message IDs.
 */
export declare function initiateRecovery(missingIds: string[], recoveryType: 'mywork' | 'locker', userId: string, io: SocketServer): Promise<void>;
/**
 * Handle a relay request — peel one layer and forward or process.
 */
export declare function handleRelay(encryptedPayload: EncryptedBlob, userId: string, io: SocketServer): Promise<{
    status: string;
    data?: any;
}>;
