/**
 * Group REST endpoints.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as groupService from '../services/groups.js';
export const groupsRouter = Router();
groupsRouter.post('/mesh/groups', requireAuth, async (req, res) => {
    const { name, memberIds, sealed } = req.body;
    const userId = req.userId;
    if (!name || !Array.isArray(memberIds)) {
        res.status(400).json({ ok: false, error: 'name and memberIds are required' });
        return;
    }
    const group = await groupService.createGroup(name, userId, memberIds, sealed || false);
    res.status(201).json({ ok: true, group });
});
groupsRouter.get('/mesh/groups', requireAuth, async (req, res) => {
    const userId = req.userId;
    const groups = await groupService.getUserGroups(userId);
    res.json({ ok: true, groups });
});
groupsRouter.get('/mesh/groups/:groupId', requireAuth, async (req, res) => {
    const userId = req.userId;
    const group = await groupService.getGroup(req.params.groupId);
    if (!group) {
        res.status(404).json({ ok: false, error: 'Group not found' });
        return;
    }
    if (!group.memberIds.includes(userId)) {
        res.status(403).json({ ok: false, error: 'Not a member of this group' });
        return;
    }
    res.json({ ok: true, group });
});
//# sourceMappingURL=groups.js.map