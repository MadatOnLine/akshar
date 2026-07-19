/**
 * GroupListScreen — list of user's encrypted groups.
 * Redesigned to feel like Apple Messages / WhatsApp group list.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mesh } from '../services/api';
import type { Group } from '../types';

/* ── Avatar color palette (Apple-inspired pastels on dark) ──── */
const AVATAR_COLORS = [
  '#5E5CE6', // Indigo
  '#BF5AF2', // Purple
  '#FF375F', // Red
  '#FF9F0A', // Orange
  '#30D158', // Green
  '#64D2FF', // Cyan
  '#FF6482', // Pink
  '#AC8E68', // Tan
  '#0A84FF', // Blue
  '#FFD60A', // Yellow
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface GroupListScreenProps {
  navigation: any;
}

export function GroupListScreen({ navigation }: GroupListScreenProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const animatedValues = useRef<Animated.Value[]>([]).current;

  const loadGroups = useCallback(async () => {
    try {
      const result = await mesh.getGroups();
      setGroups(result.groups || []);
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  /* Staggered fade-in when groups load */
  useEffect(() => {
    if (groups.length > 0) {
      // Ensure we have enough animated values
      while (animatedValues.length < groups.length) {
        animatedValues.push(new Animated.Value(0));
      }
      const animations = groups.map((_, i) =>
        Animated.timing(animatedValues[i], {
          toValue: 1,
          duration: 350,
          delay: i * 60,
          useNativeDriver: true,
        }),
      );
      Animated.stagger(60, animations).start();
    }
  }, [groups, animatedValues]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadGroups();
  };

  const navigateToChat = (group: Group) => {
    navigation.navigate('Chat', { groupId: group.groupId, groupName: group.name });
  };

  const handleCreateGroup = () => {
    Alert.prompt(
      'New Encrypted Group',
      'Enter a name for the group:',
      async (name: string) => {
        if (!name?.trim()) return;
        try {
          await mesh.createGroup(name.trim(), []);
          await loadGroups();
        } catch (err) {
          console.error('Failed to create group:', err);
          Alert.alert('Error', 'Could not create group. Please try again.');
        }
      },
      'plain-text',
      '',
      'default',
    );
  };

  const renderItem = ({ item, index }: { item: Group; index: number }) => {
    const avatarBg = getAvatarColor(item.name);
    const initial = item.name.charAt(0).toUpperCase();
    const anim = animatedValues[index] || new Animated.Value(1);

    return (
      <Animated.View
        style={{
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
        }}
      >
        <TouchableOpacity
          style={styles.groupCard}
          onPress={() => navigateToChat(item)}
          activeOpacity={0.6}
          testID={`group-item-${item.groupId}`}
          accessibilityLabel={`Open group ${item.name}`}
        >
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>

          {/* Content */}
          <View style={styles.groupInfo}>
            <Text style={styles.groupName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.groupSubtitle} numberOfLines={1}>
              {item.memberIds.length} member{item.memberIds.length !== 1 ? 's' : ''} · E2E encrypted
            </Text>
          </View>

          {/* Chevron */}
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#0A84FF" />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No conversations yet</Text>
        <Text style={styles.emptySubtitle}>
          Tap the compose button to start a new encrypted group.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} testID="group-list-screen">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {/* Search bar (visual only) */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search</Text>
        </View>
      </View>

      <FlatList
        data={groups}
        keyExtractor={item => item.groupId}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0A84FF"
            colors={['#0A84FF']}
          />
        }
        contentContainerStyle={groups.length === 0 ? styles.listEmpty : styles.listContent}
        showsVerticalScrollIndicator={false}
        testID="group-list"
      />

      {/* FAB — subtle compose button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateGroup}
        activeOpacity={0.7}
        accessibilityLabel="Create new group"
        testID="group-create-fab"
      >
        <Text style={styles.fabIcon}>✏️</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  /* ── Header ─────────────────────────────────────────── */
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },

  /* ── Search bar ─────────────────────────────────────── */
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchPlaceholder: {
    fontSize: 16,
    color: '#636366',
    fontWeight: '400',
  },

  /* ── List ────────────────────────────────────────────── */
  listEmpty: {
    flexGrow: 1,
  },
  listContent: {
    paddingBottom: 100,
  },

  /* ── Group Card (Bento-style) ──────────────────────────── */
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  groupInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  groupName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  groupSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  chevron: {
    fontSize: 20,
    color: '#48484A',
    fontWeight: '400',
    marginLeft: 8,
  },

  /* ── Empty state ────────────────────────────────────── */
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

  /* ── FAB ─────────────────────────────────────────────── */
  fab: {
    position: 'absolute',
    bottom: 36,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0A84FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  fabIcon: {
    fontSize: 20,
  },
});
