/**
 * FeedScreen — public shared posts (Layer 2).
 * Redesigned with clean social feed aesthetics.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FeedPostCard } from '../components/FeedPostCard';
import { mesh } from '../services/api';
import type { FeedPost } from '../types';
import { useFocusEffect } from '@react-navigation/native';

export function FeedScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const headerOpacity = useRef(new Animated.Value(0)).current;

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
      return () => {
        reactedRef.current.clear();
      };
    }, [loadFeed])
  );

  useEffect(() => {
    Animated.timing(headerOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [headerOpacity]);

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
        <ActivityIndicator size="large" color="#0A84FF" />
      </View>
    );
  }

  /* ── Main feed ─────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.container} testID="feed-screen">
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <Text style={styles.headerTitle}>Feed</Text>
      </Animated.View>

      <FlatList
        data={posts}
        keyExtractor={item => item.postId}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <FeedPostCard
              post={item}
              onLike={() => handleLike(item.postId)}
              onDislike={() => handleDislike(item.postId)}
              onShare={() => handleShare(item.postId)}
            />
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0A84FF"
            colors={['#0A84FF']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptySubtitle}>
              Share something from a group chat to see it here.
            </Text>
          </View>
        }
        contentContainerStyle={posts.length === 0 ? styles.listEmpty : styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        testID="feed-list"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  /* Loading */
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Header */
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },

  /* List */
  listEmpty: {
    flexGrow: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  /* Card wrapper — no longer needs styles as FeedPostCard is self-contained */
  cardWrapper: {},

  itemSeparator: {
    height: 14,
  },

  /* Empty state */
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
});
