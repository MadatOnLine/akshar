/**
 * Feed & sharing — Layer 2 public posts with attribution.
 */
import { v4 as uuidv4 } from 'uuid';
import { feedDb, safeGet } from '../db/couch.js';
import { config } from '../config.js';
/**
 * Create a new feed post (share a message publicly).
 */
export async function shareToFeed(sharerId, originalAuthorId, sourceGroupId, sourceMessageId, content) {
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
    return doc;
}
/**
 * Get recent feed posts (paginated).
 */
export async function getFeed(limit, skip) {
    const result = await feedDb.find({
        selector: { type: 'post' },
        sort: [{ ts: 'desc' }],
        limit: limit || config.feedPageSize,
        skip: skip || 0,
    });
    return result.docs;
}
/**
 * React to a feed post (like/dislike/share).
 */
export async function reactToPost(postId, userId, reactionType) {
    // Check for duplicate reaction
    const reactionId = `reaction:${postId}:${userId}`;
    const existing = await safeGet(feedDb, reactionId);
    if (existing)
        return false; // already reacted
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
//# sourceMappingURL=feed.js.map