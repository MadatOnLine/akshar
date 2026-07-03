/**
 * Onion routing relay endpoint — POST /mesh/relay
 * No JWT auth required (implicit onion authentication).
 */
import { Router } from 'express';
import { handleRelay } from '../services/recovery.js';
export const relayRouter = Router();
relayRouter.post('/mesh/relay', async (req, res) => {
    const { encryptedPayload } = req.body;
    if (!encryptedPayload?.nonce || !encryptedPayload?.tag || !encryptedPayload?.val) {
        res.status(400).json({ ok: false, error: 'Invalid onion payload' });
        return;
    }
    const io = req.io;
    const userId = req.meshUserId || 'node';
    const result = await handleRelay(encryptedPayload, userId, io);
    if (result.status === 'cannot_decrypt') {
        res.status(403).json({ ok: false, error: 'Cannot decrypt layer' });
        return;
    }
    res.json({ ok: true, ...result });
});
//# sourceMappingURL=relay.js.map