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
export declare function createGroup(name: string, adminId: string, memberIds: string[], sealed?: boolean): Promise<Group>;
/**
 * Get a group by ID.
 */
export declare function getGroup(groupId: string): Promise<Group | null>;
/**
 * Check if a user is a member of a group.
 */
export declare function isMember(groupId: string, userId: string): Promise<boolean>;
/**
 * Get all groups a user belongs to.
 */
export declare function getUserGroups(userId: string): Promise<Group[]>;
