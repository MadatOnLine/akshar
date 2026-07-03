/**
 * Group management — create, membership, sealed status.
 */
import { v4 as uuidv4 } from 'uuid';
import { groupsDb, safeGet } from '../db/couch.js';
/**
 * Create a new group.
 */
export async function createGroup(name, adminId, memberIds, sealed = false) {
    const groupId = uuidv4();
    const allMembers = Array.from(new Set([adminId, ...memberIds]));
    const doc = {
        _id: `group:${groupId}`,
        groupId,
        name,
        adminId,
        memberIds: allMembers,
        sealed,
        createdAt: new Date().toISOString(),
        type: 'group',
    };
    await groupsDb.insert(doc);
    return doc;
}
/**
 * Get a group by ID.
 */
export async function getGroup(groupId) {
    return await safeGet(groupsDb, `group:${groupId}`);
}
/**
 * Check if a user is a member of a group.
 */
export async function isMember(groupId, userId) {
    const group = await getGroup(groupId);
    if (!group)
        return false;
    return group.memberIds.includes(userId);
}
/**
 * Get all groups a user belongs to.
 */
export async function getUserGroups(userId) {
    const result = await groupsDb.find({
        selector: { type: 'group', memberIds: { $elemMatch: { $eq: userId } } },
        limit: 100,
    });
    return result.docs;
}
//# sourceMappingURL=groups.js.map