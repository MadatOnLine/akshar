import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { env } from '../config.js';
import { authMiddleware } from '../middleware/auth.js';

export const reportRouter = Router();

reportRouter.post('/mesh/report', authMiddleware, async (req: Request, res: Response) => {
  const { reportedUserId, messageId, reason } = req.body;
  const reporterId = (req as any).user.userId;

  if (!reportedUserId || !messageId || !reason) {
    res.status(400).json({ ok: false, error: 'Missing required fields' });
    return;
  }

  try {
    const aiResp = await fetch(`${env.aiUrl}/ai/tier2/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-key': env.serviceKey,
      },
      body: JSON.stringify({
        reportedUserId,
        messageId,
        reason: `Reported by ${reporterId}: ${reason}`,
      }),
    });

    const aiData = await aiResp.json();
    if (!aiResp.ok) {
      res.status(aiResp.status).json({ ok: false, error: aiData.detail || 'AI Service Error' });
      return;
    }

    res.json({ ok: true, status: 'reported' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: 'Failed to contact AI service' });
  }
});
