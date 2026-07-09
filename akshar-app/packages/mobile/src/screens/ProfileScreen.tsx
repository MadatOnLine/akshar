/**
 * ProfileScreen — user profile with trust score display.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { TrustBadge } from '../components/TrustBadge';
import { auth, ai } from '../services/api';
import { useAuth } from '../providers/AuthProvider';
import type { UserProfile, TrustState } from '../types';

const TIER_COLORS: Record<string, string> = {
  Colony: '#43d17a',
  Drone: '#6d8cff',
  Larva: '#ffc66b',
  Suspect: '#ff6b6b',
};

const SECURITY_ROWS = [
  { label: 'Encryption', value: 'AES-256-GCM' },
  { label: 'Key Exchange', value: 'ECDH secp256k1' },
  { label: 'Forward Secrecy', value: 'Hash Ratchet' },
  { label: 'Routing', value: 'Onion (3-hop)' },
  { label: 'Self-Healing', value: 'Hydra Protocol' },
];

export function ProfileScreen() {
  const { userId, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trust, setTrust] = useState<TrustState | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  }, [userId]);

  const loadProfile = async () => {
    try {
      setError(null);
      const [profileResult, trustResult] = await Promise.all([
        auth.getProfile(userId!),
        ai.getTrust(userId!),
      ]);
      setProfile(profileResult);
      setTrust(trustResult);
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      setError(err.message || 'Failed to load profile');
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        {error ? (
          <View style={{ marginTop: 48, alignItems: 'center' }}>
            <Text style={{ color: '#ff6b6b', marginBottom: 20 }}>{error}</Text>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>Force Logout</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.loading}>Loading profile...</Text>
        )}
      </View>
    );
  }

  const trustPercent = trust ? Math.round((trust.trust / 10000) * 100) : 0;
  const tierColor = TIER_COLORS[trust?.tier ?? ''] || '#6d8cff';

  return (
    <ScrollView style={styles.container} testID="profile-screen">
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.name[0]?.toUpperCase()}</Text>
        </View>
        <Text style={styles.name} testID="profile-name">{profile.name}</Text>
        {trust && <TrustBadge tier={trust.tier} size="medium" />}
      </View>

      {/* Trust Score Card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Trust Score</Text>
        <Text style={styles.trustScore} testID="profile-trust-score">
          {trust?.trust?.toLocaleString() || 0} / 10,000
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${trustPercent}%`, backgroundColor: tierColor },
            ]}
          />
        </View>
        <Text
          style={[styles.trustTier, { color: tierColor }]}
          testID="profile-tier-badge"
        >
          {trust?.tier || 'Unknown'}
        </Text>
      </View>

      {/* Security Status Card */}
      <View style={styles.card} testID="security-status-card">
        <Text style={styles.securityHeader}>🛡️ Security Status</Text>
        {SECURITY_ROWS.map((row) => (
          <View style={styles.securityRow} key={row.label}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.securityLabel}>{row.label}</Text>
            <Text style={styles.securityValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      {/* Info Section */}
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Member since</Text>
          <Text style={styles.infoValue}>
            {new Date(profile.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status</Text>
          <Text style={styles.infoValue}>{profile.status}</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>Node ID</Text>
          <Text style={styles.infoValue}>
            {userId ? `${userId.slice(0, 8)}…${userId.slice(-6)}` : '—'}
          </Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        testID="profile-logout-button"
        accessibilityLabel="Logout"
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* Footer */}
      <Text style={styles.footer}>Akshar Protocol v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /* Layout */
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
    padding: 24,
  },
  loading: {
    fontSize: 16,
    color: '#566178',
    textAlign: 'center',
    marginTop: 48,
  },

  /* Avatar */
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#6d8cff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#6d8cff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 12,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#ffffff',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e6edf3',
    marginBottom: 8,
  },

  /* Shared dark card */
  card: {
    backgroundColor: '#1c2433',
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
  },
  cardLabel: {
    fontSize: 13,
    color: '#566178',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  /* Trust Score */
  trustScore: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e6edf3',
    marginBottom: 14,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#283040',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  trustTier: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* Security Status */
  securityHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e6edf3',
    marginBottom: 14,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#283040',
  },
  checkmark: {
    fontSize: 15,
    color: '#43d17a',
    fontWeight: '700',
    marginRight: 10,
    width: 20,
  },
  securityLabel: {
    fontSize: 14,
    color: '#8b949e',
    flex: 1,
  },
  securityValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e6edf3',
  },

  /* Info Section */
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#283040',
  },
  infoLabel: {
    fontSize: 14,
    color: '#8b949e',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e6edf3',
  },

  /* Logout */
  logoutButton: {
    borderWidth: 1.5,
    borderColor: '#ff6b6b',
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 44,
    marginBottom: 20,
  },
  logoutText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
  },

  /* Footer */
  footer: {
    textAlign: 'center',
    color: '#566178',
    fontSize: 13,
    marginBottom: 32,
  },
});
