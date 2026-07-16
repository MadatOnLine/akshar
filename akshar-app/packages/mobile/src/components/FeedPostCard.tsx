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
  const displayName = post.sharerName || post.sharerId.slice(0, 8) + '...';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <View style={styles.card} testID={`feed-post-${post.postId}`}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarLetter}</Text>
        </View>
        <Text style={styles.sharerName}>{displayName}</Text>
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
          testID="feed-like-button"
        >
          <Text style={styles.reactionText}>👍 {post.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDislike}
          style={styles.reactionButton}
          accessibilityLabel="Dislike post"
          testID="feed-dislike-button"
        >
          <Text style={styles.reactionText}>👎 {post.dislikes}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onShare}
          style={styles.reactionButton}
          accessibilityLabel="Share post"
          testID="feed-share-button"
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
    backgroundColor: '#1c2433',
    borderColor: '#283347',
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6d8cff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  sharerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e8edf6',
  },
  attribution: {
    fontSize: 12,
    color: '#566178',
    marginBottom: 8,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    color: '#e8edf6',
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
    backgroundColor: '#243044',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionText: {
    fontSize: 14,
    color: '#e8edf6',
  },
  timestamp: {
    fontSize: 11,
    color: '#566178',
  },
});
