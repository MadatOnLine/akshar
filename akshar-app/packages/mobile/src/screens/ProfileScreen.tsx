/**
 * ProfileScreen — user profile with trust score and Account Studio link.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { TrustBadge } from '../components/TrustBadge';
import { auth, ai } from '../services/api';
import { useAuth } from '../providers/AuthProvider';
import type { UserProfile, TrustState, Tier2State, RootStackParamList } from '../types';

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
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { userId, logout, checkRisk } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trust, setTrust] = useState<TrustState | null>(null);
  const [tier2, setTier2] = useState<Tier2State | null>(null);
  const [tier2b, setTier2b] = useState<Tier2State | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  }, [userId]);

  const loadProfile = async () => {
    try {
      setError(null);
      const [profileResult, trustResult, tier2Result] = await Promise.all([
        auth.getProfile(userId!),
        ai.getTrust(userId!),
        auth.getTier2(userId!).catch(() => null),
      ]);
      setProfile(profileResult);
      setTrust(trustResult);
      setTier2(tier2Result?.tier2 ?? null);
      setTier2b(tier2Result?.tier2b ?? null);
      if (tier2Result?.tier2b?.requiresRiskCheck) {
        await checkRisk({
          requiresRiskCheck: true,
          riskReason: tier2Result.tier2b.riskReason,
        });
      }
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
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.name[0]?.toUpperCase()}</Text>
        </View>
        <Text style={styles.name} testID="profile-name">{profile.name}</Text>
        {trust && <TrustBadge tier={trust.tier} size="medium" />}
      </View>

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

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Account integrity</Text>
        <Text style={styles.tier2Summary}>
          {tier2
            ? `${tier2.verdict || tier2.status} · ${Math.round((tier2.humanness || 0) * 100)}%`
            : 'Establishing...'}
        </Text>
        <Text style={[styles.cardLabel, { marginTop: 12 }]}>Person binding</Text>
        <Text style={styles.tier2Summary}>
          {tier2b
            ? `${tier2b.verdict || tier2b.status}${tier2b.requiresRiskCheck ? ' · verification required' : ''}`
            : 'Risk-based verification only'}
        </Text>
        <TouchableOpacity
          style={styles.tier2Button}
          onPress={() => navigation.navigate('AccountStudio')}
          accessibilityLabel="Open Account Studio"
        >
          <Text style={styles.tier2ButtonText}>Open Account Studio →</Text>
        </TouchableOpacity>
      </View>

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

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        testID="profile-logout-button"
        accessibilityLabel="Logout"
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Akshar Protocol v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  tier2Summary: {
    fontSize: 14,
    color: '#8b949e',
    lineHeight: 20,
  },
  tier2Button: {
    backgroundColor: '#6d8cff',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  tier2ButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
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
  footer: {
    textAlign: 'center',
    color: '#566178',
    fontSize: 13,
    marginBottom: 32,
  },
});
