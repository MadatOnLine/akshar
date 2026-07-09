/**
 * Feed REST endpoints — Layer 2 public sharing.
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as feedService from '../services/feed.js';
import * as groupService from '../services/groups.js';

export const feedRouter = Router();

feedRouter.post('/mesh/share', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { groupId, messageId, plaintext, originalAuthorId } = req.body;

    if (!groupId || !messageId || !plaintext) {
      res.status(400).json({ ok: false, error: 'groupId, messageId, and plaintext are required' });
      return;
    }

    // Check membership
    const isMember = await groupService.isMember(groupId, userId);
    if (!isMember) {
      res.status(403).json({ ok: false, error: 'Not a member of this group' });
      return;
    }

    // Check not sealed
    const group = await groupService.getGroup(groupId);
    if (group?.sealed) {
      res.status(403).json({ ok: false, error: 'This group does not allow sharing' });
      return;
    }

    const post = await feedService.shareToFeed(
      userId,
      originalAuthorId || userId,
      groupId,
      messageId,
      plaintext
    );

    res.status(201).json({ ok: true, post });
  } catch (err: any) {
    console.error('Share to feed error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error during share' });
  }
});

feedRouter.get('/mesh/feed', requireAuth, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || undefined;
  const skip = parseInt(req.query.skip as string) || undefined;
  const posts = await feedService.getFeed(limit, skip);
  res.json({ ok: true, posts });
});

feedRouter.post('/mesh/feed/:postId/react', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { type } = req.body;

  if (!['like', 'dislike', 'share'].includes(type)) {
    res.status(400).json({ ok: false, error: 'type must be like, dislike, or share' });
    return;
  }

  const success = await feedService.reactToPost(req.params.postId, userId, type);
  if (!success) {
    res.status(409).json({ ok: false, error: 'Already reacted' });
    return;
  }

  res.json({ ok: true });
});
