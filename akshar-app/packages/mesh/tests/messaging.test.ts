import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock CouchDB before importing services
vi.mock('../src/db/couch.js', () => ({
  vaultDb: {
    insert: vi.fn().mockResolvedValue({ ok: true }),
    find: vi.fn().mockResolvedValue({ docs: [] }),
    get: vi.fn().mockResolvedValue(null),
  },
  groupsDb: {
    insert: vi.fn().mockResolvedValue({ ok: true }),
    find: vi.fn().mockResolvedValue({ docs: [] }),
    get: vi.fn().mockResolvedValue(null),
  },
  feedDb: {
    insert: vi.fn().mockResolvedValue({ ok: true }),
    find: vi.fn().mockResolvedValue({ docs: [] }),
    get: vi.fn().mockResolvedValue(null),
  },
  keysDb: {
    insert: vi.fn().mockResolvedValue({ ok: true }),
  },
  initDatabases: vi.fn().mockResolvedValue(undefined),
  safeGet: vi.fn().mockResolvedValue(null),
}));

import { storeMessage, getBacklog } from '../src/services/messaging.js';
import { createGroup, isMember } from '../src/services/groups.js';
import { shareToFeed, getFeed, reactToPost } from '../src/services/feed.js';
import { vaultDb, groupsDb, feedDb, safeGet } from '../src/db/couch.js';

describe('messaging service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('storeMessage creates a vault document with correct structure', async () => {
    const result = await storeMessage('alice', 'group-1', {
      nonce: 'a'.repeat(24),
      tag: 'b'.repeat(32),
      val: 'c'.repeat(64),
    });

    expect(result.fromNode).toBe('alice');
    expect(result.toNode).toBe('group-1');
    expect(result.nonce).toBe('a'.repeat(24));
    expect(result.tag).toBe('b'.repeat(32));
    expect(result.val).toBe('c'.repeat(64));
    expect(result.msgId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.ts).toBeGreaterThan(0);
    expect(vaultDb.insert).toHaveBeenCalledOnce();
  });

  it('getBacklog queries CouchDB with group filter', async () => {
    await getBacklog('group-1');
    expect(vaultDb.find).toHaveBeenCalledWith(expect.objectContaining({
      selector: { toNode: 'group-1', type: 'message' },
    }));
  });
});

describe('groups service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createGroup includes admin in members', async () => {
    const group = await createGroup('Test Group', 'admin-user', ['user-1', 'user-2']);
    expect(group.memberIds).toContain('admin-user');
    expect(group.memberIds).toContain('user-1');
    expect(group.memberIds).toContain('user-2');
    expect(group.adminId).toBe('admin-user');
    expect(group.sealed).toBe(false);
    expect(groupsDb.insert).toHaveBeenCalledOnce();
  });

  it('isMember returns false when group not found', async () => {
    const result = await isMember('nonexistent', 'user-1');
    expect(result).toBe(false);
  });
});

describe('feed service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shareToFeed creates a post with attribution', async () => {
    const post = await shareToFeed('sharer', 'author', 'group-1', 'msg-1', 'Hello world');
    expect(post.sharerId).toBe('sharer');
    expect(post.originalAuthorId).toBe('author');
    expect(post.content).toBe('Hello world');
    expect(post.likes).toBe(0);
    expect(feedDb.insert).toHaveBeenCalledOnce();
  });

  it('getFeed queries posts sorted by ts descending', async () => {
    await getFeed();
    expect(feedDb.find).toHaveBeenCalledWith(expect.objectContaining({
      selector: { type: 'post' },
      sort: [{ ts: 'desc' }],
    }));
  });

  it('reactToPost prevents duplicate reactions', async () => {
    // Mock: reaction already exists
    (safeGet as any).mockResolvedValueOnce({ _id: 'exists' });
    const result = await reactToPost('post-1', 'user-1', 'like');
    expect(result).toBe(false);
  });
});
