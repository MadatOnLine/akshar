/**
 * FeedScreen — public shared posts (Layer 2).
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  ActivityIndicator,
} from 'react-native';
import { FeedPostCard } from '../components/FeedPostCard';
import { mesh } from '../services/api';
import type { FeedPost } from '../types';
import { useFocusEffect } from '@react-navigation/native';

export function FeedScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  /** Track reacted posts to prevent duplicate / spam reactions. */
  const reactedRef = useRef<Set<string>>(new Set());

  const loadFeed = useCallback(async () => {
    try {
      const result = await mesh.getFeed(20, 0);
      // Sort on client side to guarantee order in case DB index fallback fired
      const sorted = (result.posts || []).sort((a: FeedPost, b: FeedPost) => b.ts - a.ts);
      setPosts(sorted);
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [loadFeed])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  /** Guard every reaction type with a composite key so each kind fires at most once per post. */
  const guardReaction = (postId: string, kind: string): boolean => {
    const key = `${postId}:${kind}`;
    if (reactedRef.current.has(key)) return false;
    reactedRef.current.add(key);
    return true;
  };

  const handleLike = async (postId: string) => {
    if (!guardReaction(postId, 'like')) return;
    try {
      await mesh.react(postId, 'like');
      setPosts(prev => prev.map(p => p.postId === postId ? { ...p, likes: p.likes + 1 } : p));
    } catch {}
  };

  const handleDislike = async (postId: string) => {
    if (!guardReaction(postId, 'dislike')) return;
    try {
      await mesh.react(postId, 'dislike');
      setPosts(prev => prev.map(p => p.postId === postId ? { ...p, dislikes: p.dislikes + 1 } : p));
    } catch {}
  };

  const handleShare = async (postId: string) => {
    if (!guardReaction(postId, 'share')) return;
    try {
      await mesh.react(postId, 'share');
      setPosts(prev => prev.map(p => p.postId === postId ? { ...p, shares: p.shares + 1 } : p));
    } catch {}
  };

  /* ── Loading state ─────────────────────────────────────── */
  if (loading) {
    return (
      <View style={styles.loadingContainer} testID="feed-loading">
        <ActivityIndicator size="large" color="#6d8cff" />
      </View>
    );
  }

  /* ── Main feed ─────────────────────────────────────────── */
  return (
    <View style={styles.container} testID="feed-screen">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>📡</Text>
        <Text style={styles.headerTitle}>Public Feed</Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={item => item.postId}
        renderItem={({ item }) => (
          <FeedPostCard
            post={item}
            onLike={() => handleLike(item.postId)}
            onDislike={() => handleDislike(item.postId)}
            onShare={() => handleShare(item.postId)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6d8cff"
            colors={['#6d8cff']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📡</Text>
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptySubtitle}>Share something from a group chat!</Text>
          </View>
        }
        contentContainerStyle={posts.length === 0 ? styles.listEmpty : undefined}
        testID="feed-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1724',
  },

  /* Loading */
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f1724',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerEmoji: {
    fontSize: 22,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e8ecf4',
  },

  /* List */
  listEmpty: {
    flexGrow: 1,
  },

  /* Empty state */
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#e8ecf4',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#667a99',
  },
});
