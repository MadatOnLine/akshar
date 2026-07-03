/**
 * FeedScreen — public shared posts (Layer 2).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import { FeedPostCard } from '../components/FeedPostCard';
import { mesh } from '../services/api';
import type { FeedPost } from '../types';

export function FeedScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    try {
      const result = await mesh.getFeed(20, 0);
      setPosts(result.posts || []);
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  const handleLike = async (postId: string) => {
    try {
      await mesh.react(postId, 'like');
      setPosts(prev => prev.map(p => p.postId === postId ? { ...p, likes: p.likes + 1 } : p));
    } catch {}
  };

  const handleDislike = async (postId: string) => {
    try {
      await mesh.react(postId, 'dislike');
      setPosts(prev => prev.map(p => p.postId === postId ? { ...p, dislikes: p.dislikes + 1 } : p));
    } catch {}
  };

  const handleShare = async (postId: string) => {
    try {
      await mesh.react(postId, 'share');
      setPosts(prev => prev.map(p => p.postId === postId ? { ...p, shares: p.shares + 1 } : p));
    } catch {}
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} data-testid="feed-screen">
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
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No posts yet. Share something from a group!</Text>
          </View>
        }
        data-testid="feed-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { fontSize: 16, color: '#666' },
  emptyText: { fontSize: 16, color: '#999', textAlign: 'center' },
});
