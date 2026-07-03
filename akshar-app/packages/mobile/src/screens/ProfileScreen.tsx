/**
 * ProfileScreen — user profile with trust score display.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TrustBadge } from '../components/TrustBadge';
import { auth, ai } from '../services/api';
import { useAuth } from '../providers/AuthProvider';
import type { UserProfile, TrustState } from '../types';

export function ProfileScreen() {
  const { userId, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trust, setTrust] = useState<TrustState | null>(null);

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  }, [userId]);

  const loadProfile = async () => {
    try {
      const [profileResult, trustResult] = await Promise.all([
        auth.getProfile(userId!),
        ai.getTrust(userId!),
      ]);
      setProfile(profileResult);
      setTrust(trustResult);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading profile...</Text>
      </View>
    );
  }

  const trustPercent = trust ? Math.round((trust.trust / 10000) * 100) : 0;

  return (
    <View style={styles.container} data-testid="profile-screen">
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.name[0]?.toUpperCase()}</Text>
        </View>
        <Text style={styles.name} data-testid="profile-name">{profile.name}</Text>
        {trust && <TrustBadge tier={trust.tier} size="medium" />}
      </View>

      <View style={styles.trustCard}>
        <Text style={styles.trustLabel}>Trust Score</Text>
        <Text style={styles.trustScore} data-testid="profile-trust-score">
          {trust?.trust?.toLocaleString() || 0} / 10,000
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${trustPercent}%` }]} />
        </View>
        <Text style={styles.trustTier} data-testid="profile-tier-badge">
          {trust?.tier || 'Unknown'}
        </Text>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Member since</Text>
          <Text style={styles.infoValue}>{new Date(profile.createdAt).toLocaleDateString()}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status</Text>
          <Text style={styles.infoValue}>{profile.status}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        data-testid="profile-logout-button"
        accessibilityLabel="Logout"
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA', padding: 24 },
  loading: { fontSize: 16, color: '#999', textAlign: 'center', marginTop: 48 },
  avatarContainer: { alignItems: 'center', marginBottom: 32 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#6200EE', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#FFF' },
  name: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  trustCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 12, marginBottom: 24, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  trustLabel: { fontSize: 14, color: '#666', marginBottom: 4 },
  trustScore: { fontSize: 28, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  progressBar: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: '#6200EE', borderRadius: 4 },
  trustTier: { fontSize: 14, color: '#666', fontWeight: '500' },
  infoSection: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 24 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  logoutButton: { backgroundColor: '#F44336', paddingVertical: 14, borderRadius: 12, alignItems: 'center', minHeight: 44 },
  logoutText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
