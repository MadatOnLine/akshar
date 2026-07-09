/**
 * GroupListScreen — list of user's encrypted groups.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { mesh } from '../services/api';
import type { Group } from '../types';

interface GroupListScreenProps {
  navigation: any;
}

export function GroupListScreen({ navigation }: GroupListScreenProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const renderItem = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={styles.groupItem}
      onPress={() => navigateToChat(item)}
      testID={`group-item-${item.groupId}`}
      accessibilityLabel={`Open group ${item.name}`}
    >
      <View style={styles.groupIcon}>
        <Text style={styles.groupEmoji}>{item.sealed ? '🔒' : '💬'}</Text>
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupMeta}>
          {item.memberIds.length} members{item.sealed ? ' · Sealed' : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#6d8cff" />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🔐</Text>
        <Text style={styles.emptyTitle}>No encrypted groups yet</Text>
        <Text style={styles.emptySubtitle}>Tap + to create one</Text>
      </View>
    );
  };

  return (
    <View style={styles.container} testID="group-list-screen">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🔐</Text>
        <Text style={styles.headerTitle}>Encrypted Groups</Text>
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
            tintColor="#6d8cff"
            colors={['#6d8cff']}
          />
        }
        contentContainerStyle={groups.length === 0 ? styles.listEmpty : undefined}
        testID="group-list"
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateGroup}
        accessibilityLabel="Create new group"
        testID="group-create-fab"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1724',
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

  /* Group card */
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    backgroundColor: '#1c2433',
    borderWidth: 1,
    borderColor: '#283347',
    borderRadius: 14,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#283347',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupEmoji: {
    fontSize: 24,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e8ecf4',
  },
  groupMeta: {
    fontSize: 13,
    color: '#667a99',
    marginTop: 2,
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

  /* FAB */
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6d8cff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#6d8cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
});
