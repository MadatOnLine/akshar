/**
 * FeedPostCard — displays a public feed post with attribution and reactions.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TrustBadge } from './TrustBadge';
import type { FeedPost } from '../types';

interface FeedPostCardProps {
  post: FeedPost;
  sharerTier?: string;
  onLike?: () => void;
  onDislike?: () => void;
  onShare?: () => void;
}

export function FeedPostCard({ post, sharerTier, onLike, onDislike, onShare }: FeedPostCardProps) {
  return (
    <View style={styles.card} data-testid={`feed-post-${post.postId}`}>
      <View style={styles.header}>
        <Text style={styles.sharerName}>{post.sharerId}</Text>
        {sharerTier && <TrustBadge tier={sharerTier} size="small" />}
      </View>
      {post.originalAuthorId !== post.sharerId && (
        <Text style={styles.attribution}>
          Originally by @{post.originalAuthorId}
        </Text>
      )}
      <Text style={styles.content}>{post.content}</Text>
      <View style={styles.reactions}>
        <TouchableOpacity
          onPress={onLike}
          style={styles.reactionButton}
          accessibilityLabel="Like post"
          data-testid="feed-like-button"
        >
          <Text style={styles.reactionText}>👍 {post.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDislike}
          style={styles.reactionButton}
          accessibilityLabel="Dislike post"
          data-testid="feed-dislike-button"
        >
          <Text style={styles.reactionText}>👎 {post.dislikes}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onShare}
          style={styles.reactionButton}
          accessibilityLabel="Share post"
          data-testid="feed-share-button"
        >
          <Text style={styles.reactionText}>🔄 {post.shares}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.timestamp}>
        {new Date(post.ts).toLocaleDateString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sharerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  attribution: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1A1A1A',
    marginBottom: 12,
  },
  reactions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  reactionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionText: {
    fontSize: 14,
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
  },
});
