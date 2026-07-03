import * as messaging from '../services/messaging.js';
import * as groups from '../services/groups.js';
import * as feed from '../services/feed.js';
import * as anomaly from '../services/anomaly.js';
import { config } from '../config.js';
/**
 * Register all Socket.IO event handlers for a connected client.
 */
export function registerHandlers(io, socket) {
    const userId = socket.data.userId;
    console.log(`[WS] User ${userId} connected`);
    // Join user's personal room for direct messages
    socket.join(`user:${userId}`);
    // --- Join Group Room ---
    socket.on('join-room', async (data) => {
        const { groupId } = data;
        const isMember = await groups.isMember(groupId, userId);
        if (!isMember) {
            socket.emit('error', { message: 'Not a member of this group' });
            return;
        }
        socket.join(`group:${groupId}`);
        // Send backlog
        const backlog = await messaging.getBacklog(groupId);
        socket.emit('backlog', { groupId, messages: backlog });
    });
    // --- Send Encrypted Message ---
    socket.on('send-message', async (data) => {
        const { groupId, ciphertext, typingMs, plaintext } = data;
        // Validate membership
        const isMember = await groups.isMember(groupId, userId);
        if (!isMember) {
            socket.emit('error', { message: 'Not a member of this group' });
            return;
        }
        // Validate ciphertext format
        if (!ciphertext?.nonce || !ciphertext?.tag || !ciphertext?.val) {
            socket.emit('error', { message: 'Invalid ciphertext format' });
            return;
        }
        // Store in vault
        const stored = await messaging.storeMessage(userId, groupId, ciphertext);
        anomaly.trackMyWork(stored.msgId);
        // Call AI classification (non-blocking, fire-and-forget with timeout)
        let classification = { verdict: 'Unknown' };
        if (plaintext) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), config.aiTimeout);
                const resp = await fetch(`${config.aiServiceUrl}/ai/classify-message`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Service-Key': config.serviceApiKey,
                    },
                    body: JSON.stringify({
                        room: groupId,
                        sender: userId,
                        text: plaintext,
                        typingMs: typingMs || 0,
                    }),
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                if (resp.ok) {
                    classification = await resp.json();
                }
            }
            catch {
                // AI unavailable — continue without classification (BR-14)
            }
        }
        // Broadcast to all group members
        io.to(`group:${groupId}`).emit('new-message', {
            msgId: stored.msgId,
            fromNode: userId,
            toNode: groupId,
            ciphertext,
            ts: stored.ts,
            classification,
        });
    });
    // --- Publish ECDH Public Key ---
    socket.on('publish-key', (data) => {
        // Broadcast to all connected users (they filter by who they need keys from)
        socket.broadcast.emit('peer-key', { userId, publicKey: data.publicKey });
    });
    // --- Share to Feed ---
    socket.on('share-to-feed', async (data) => {
        const { groupId, messageId, plaintext, originalAuthorId } = data;
        const isMember = await groups.isMember(groupId, userId);
        if (!isMember) {
            socket.emit('error', { message: 'Not a member of this group' });
            return;
        }
        const group = await groups.getGroup(groupId);
        if (group?.sealed) {
            socket.emit('error', { message: 'Group is sealed — sharing not allowed' });
            return;
        }
        const post = await feed.shareToFeed(userId, originalAuthorId || userId, groupId, messageId, plaintext);
        // Notify group members (accountability — they see who shared)
        io.to(`group:${groupId}`).emit('message-shared', {
            postId: post.postId,
            sharerId: userId,
            groupId,
            messageId,
        });
        // Confirm to sharer
        socket.emit('share-confirmed', { post });
    });
    // --- Disconnect ---
    socket.on('disconnect', () => {
        console.log(`[WS] User ${userId} disconnected`);
    });
}
//# sourceMappingURL=handlers.js.map