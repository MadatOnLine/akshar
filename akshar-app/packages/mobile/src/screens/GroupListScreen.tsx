/**
 * GroupListScreen — list of user's encrypted groups.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { mesh } from '../services/api';
import type { Group } from '../types';

interface GroupListScreenProps {
  navigation: any;
}

export function GroupListScreen({ navigation }: GroupListScreenProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const result = await mesh.getGroups();
      setGroups(result.groups || []);
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const navigateToChat = (group: Group) => {
    navigation.navigate('Chat', { groupId: group.groupId, groupName: group.name });
  };

  return (
    <View style={styles.container} data-testid="group-list-screen">
      <FlatList
        data={groups}
        keyExtractor={item => item.groupId}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.groupItem}
            onPress={() => navigateToChat(item)}
            data-testid={`group-item-${item.groupId}`}
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
        )}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.emptyText}>Loading...</Text>
          ) : (
            <Text style={styles.emptyText}>No groups yet. Create one!</Text>
          )
        }
        data-testid="group-list"
      />

      <TouchableOpacity
        style={styles.fab}
        accessibilityLabel="Create new group"
        data-testid="group-create-fab"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  groupItem: { flexDirection: 'row', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', alignItems: 'center' },
  groupIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  groupEmoji: { fontSize: 24 },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  groupMeta: { fontSize: 13, color: '#999', marginTop: 2 },
  emptyText: { textAlign: 'center', padding: 48, color: '#999', fontSize: 16 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#6200EE', justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  fabText: { color: '#FFF', fontSize: 28, fontWeight: '300' },
});
