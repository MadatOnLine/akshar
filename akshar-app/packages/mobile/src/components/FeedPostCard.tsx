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
    backgroundColor: '#1C1C1E',
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0A84FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  sharerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  attribution: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 10,
  },
  content: {
    fontSize: 17,
    lineHeight: 24,
    color: '#EBEBF5',
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  reactions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  reactionButton: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#2C2C2E',
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EBEBF5',
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
