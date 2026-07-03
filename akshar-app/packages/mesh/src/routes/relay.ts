/**
 * Onion routing relay endpoint — POST /mesh/relay
 * No JWT auth required (implicit onion authentication).
 */
import { Router, Request, Response } from 'express';
import { handleRelay } from '../services/recovery.js';

export const relayRouter = Router();

relayRouter.post('/mesh/relay', async (req: Request, res: Response) => {
  const { encryptedPayload } = req.body;

  if (!encryptedPayload?.nonce || !encryptedPayload?.tag || !encryptedPayload?.val) {
    res.status(400).json({ ok: false, error: 'Invalid onion payload' });
    return;
  }

  const io = (req as any).io;
  const userId = (req as any).meshUserId || 'node';

  const result = await handleRelay(encryptedPayload, userId, io);

  if (result.status === 'cannot_decrypt') {
    res.status(403).json({ ok: false, error: 'Cannot decrypt layer' });
    return;
  }

  res.json({ ok: true, ...result });
});
