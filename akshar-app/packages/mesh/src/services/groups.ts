/**
 * Group management — create, membership, sealed status.
 */
import { v4 as uuidv4 } from 'uuid';
import { groupsDb, safeGet } from '../db/couch.js';

export interface Group {
  groupId: string;
  name: string;
  adminId: string;
  memberIds: string[];
  sealed: boolean;
  createdAt: string;
}

/**
 * Create a new group.
 */
export async function createGroup(
  name: string,
  adminId: string,
  memberIds: string[],
  sealed: boolean = false
): Promise<Group> {
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
  return doc as Group;
}

/**
 * Get a group by ID.
 */
export async function getGroup(groupId: string): Promise<Group | null> {
  return await safeGet(groupsDb, `group:${groupId}`);
}

/**
 * Check if a user is a member of a group.
 */
export async function isMember(groupId: string, userId: string): Promise<boolean> {
  const group = await getGroup(groupId);
  if (!group) return false;
  return group.memberIds.includes(userId);
}

/**
 * Get all groups a user belongs to.
 */
export async function getUserGroups(userId: string): Promise<Group[]> {
  const result = await groupsDb.find({
    selector: { type: 'group', memberIds: { $elemMatch: { $eq: userId } } },
    limit: 100,
  });
  return result.docs as unknown as Group[];
}
