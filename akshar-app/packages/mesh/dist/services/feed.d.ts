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
export declare function shareToFeed(sharerId: string, originalAuthorId: string, sourceGroupId: string, sourceMessageId: string, content: string): Promise<FeedPost>;
/**
 * Get recent feed posts (paginated).
 */
export declare function getFeed(limit?: number, skip?: number): Promise<FeedPost[]>;
/**
 * React to a feed post (like/dislike/share).
 */
export declare function reactToPost(postId: string, userId: string, reactionType: 'like' | 'dislike' | 'share'): Promise<boolean>;
