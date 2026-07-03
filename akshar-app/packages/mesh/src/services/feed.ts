/**
 * Feed & sharing — Layer 2 public posts with attribution.
 */
import { v4 as uuidv4 } from 'uuid';
import { feedDb, safeGet } from '../db/couch.js';
import { config } from '../config.js';

export interface FeedPost {
  postId: string;
  sharerId: string;
  originalAuthorId: string;
  sourceGroupId: string;
  sourceMessageId: string;
  content: string;
  likes: number;
  dislikes: number;
  shares: number;
  ts: number;
}

/**
 * Create a new feed post (share a message publicly).
 */
export async function shareToFeed(
  sharerId: string,
  originalAuthorId: string,
  sourceGroupId: string,
  sourceMessageId: string,
  content: string
): Promise<FeedPost> {
  const postId = uuidv4();
  const doc = {
    _id: `post:${postId}`,
    postId,
    sharerId,
    originalAuthorId,
    sourceGroupId,
    sourceMessageId,
    content,
    likes: 0,
    dislikes: 0,
    shares: 0,
    ts: Date.now(),
    type: 'post',
  };

  await feedDb.insert(doc);
  return doc as FeedPost;
}

/**
 * Get recent feed posts (paginated).
 */
export async function getFeed(limit?: number, skip?: number): Promise<FeedPost[]> {
  try {
    const result = await feedDb.find({
      selector: { type: 'post' },
      sort: [{ ts: 'desc' as any }],
      limit: limit || config.feedPageSize,
      skip: skip || 0,
    });
    return result.docs as unknown as FeedPost[];
  } catch {
    const result = await feedDb.find({
      selector: { type: 'post' },
      limit: limit || config.feedPageSize,
      skip: skip || 0,
    });
    return result.docs as unknown as FeedPost[];
  }
}

/**
 * React to a feed post (like/dislike/share).
 */
export async function reactToPost(
  postId: string,
  userId: string,
  reactionType: 'like' | 'dislike' | 'share'
): Promise<boolean> {
  // Check for duplicate reaction
  const reactionId = `reaction:${postId}:${userId}`;
  const existing = await safeGet(feedDb, reactionId);
  if (existing) return false; // already reacted

  // Store reaction
  await feedDb.insert({
    _id: reactionId,
    postId,
    userId,
    type: reactionType,
    ts: Date.now(),
  });

  // Increment counter on the post
  const post = await safeGet(feedDb, `post:${postId}`);
  if (post) {
    const field = reactionType === 'like' ? 'likes' : reactionType === 'dislike' ? 'dislikes' : 'shares';
    post[field] = (post[field] || 0) + 1;
    await feedDb.insert(post);
  }

  return true;
}
