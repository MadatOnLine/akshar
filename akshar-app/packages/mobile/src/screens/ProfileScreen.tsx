/**
 * ProfileScreen — user profile with trust score and Account Studio link.
 * Redesigned to feel like iOS Settings profile.
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { TrustBadge } from '../components/TrustBadge';
import { auth, ai } from '../services/api';
import { useAuth } from '../providers/AuthProvider';
import type { UserProfile, TrustState, Tier2State, RootStackParamList } from '../types';

const TIER_COLORS: Record<string, string> = {
  Colony: '#30D158',
  Drone: '#0A84FF',
  Larva: '#FFD60A',
  Suspect: '#FF453A',
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
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

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
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>Force Logout</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.loading}>Loading profile…</Text>
        )}
      </View>
    );
  }

  const trustPercent = trust ? Math.round((trust.trust / 10000) * 100) : 0;
  const tierColor = TIER_COLORS[trust?.tier ?? ''] || '#0A84FF';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} testID="profile-screen" showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>

        {/* ── Avatar section ─────────────────────────────── */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarRing, { borderColor: tierColor }]}>
            <View style={styles.avatar}>
              <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
            </View>
          </View>
          <Text style={styles.name} testID="profile-name">{profile.name}</Text>
          {trust && <TrustBadge tier={trust.tier} size="medium" />}
        </View>

        {/* ── Trust Score ─────────────────────────────────── */}
        <Text style={styles.sectionHeader}>TRUST</Text>
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

        {/* ── Account Integrity ───────────────────────────── */}
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Account integrity</Text>
          <Text style={styles.tier2Summary}>
            {tier2
              ? `${tier2.verdict || tier2.status} · ${Math.round((tier2.humanness || 0) * 100)}%`
              : 'Establishing…'}
          </Text>
          <Text style={[styles.cardLabel, { marginTop: 14 }]}>Person binding</Text>
          <Text style={styles.tier2Summary}>
            {tier2b
              ? `${tier2b.verdict || tier2b.status}${tier2b.requiresRiskCheck ? ' · verification required' : ''}`
              : 'Risk-based verification only'}
          </Text>
          <TouchableOpacity
            style={styles.studioButton}
            onPress={() => navigation.navigate('AccountStudio')}
            activeOpacity={0.7}
            accessibilityLabel="Open Account Studio"
          >
            <Text style={styles.studioButtonText}>Open Account Studio</Text>
            <Text style={styles.studioButtonArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* ── Security Status ─────────────────────────────── */}
        <Text style={styles.sectionHeader}>SECURITY</Text>
        <View style={styles.card} testID="security-status-card">
          {SECURITY_ROWS.map((row, index) => (
            <View
              style={[
                styles.securityRow,
                index === SECURITY_ROWS.length - 1 && { borderBottomWidth: 0 },
              ]}
              key={row.label}
            >
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.securityLabel}>{row.label}</Text>
              <Text style={styles.securityValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* ── Account Info ────────────────────────────────── */}
        <Text style={styles.sectionHeader}>DETAILS</Text>
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

        {/* ── Logout ──────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.6}
          testID="profile-logout-button"
          accessibilityLabel="Logout"
        >
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Akshar Protocol v1.0.0</Text>
      </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loading: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 48,
  },
  errorContainer: {
    marginTop: 48,
    alignItems: 'center',
  },
  errorText: {
    color: '#FF453A',
    marginBottom: 20,
    fontSize: 15,
    textAlign: 'center',
  },

  /* ── Avatar ─────────────────────────────────────────── */
  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 16,
  },
  avatarRing: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 110,
    height: 110,
    resizeMode: 'cover',
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },

  /* ── Section header ─────────────────────────────────── */
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
    marginLeft: 4,
  },

  /* ── Cards (iOS Settings style) ─────────────────────── */
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    padding: 18,
    marginBottom: 20,
  },
  cardLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  /* ── Trust ──────────────────────────────────────────── */
  trustScore: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#2C2C2E',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  trustTier: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* ── Account integrity ──────────────────────────────── */
  tier2Summary: {
    fontSize: 15,
    color: '#EBEBF5',
    lineHeight: 22,
    marginBottom: 2,
  },
  studioButton: {
    flexDirection: 'row',
    backgroundColor: '#0A84FF',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  studioButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  studioButtonArrow: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 6,
  },

  /* ── Security ───────────────────────────────────────── */
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  checkmark: {
    fontSize: 14,
    color: '#30D158',
    fontWeight: '700',
    marginRight: 10,
    width: 20,
  },
  securityLabel: {
    fontSize: 15,
    color: '#8E8E93',
    flex: 1,
  },
  securityValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },

  /* ── Info rows ──────────────────────────────────────── */
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  infoLabel: {
    fontSize: 15,
    color: '#8E8E93',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },

  /* ── Logout ─────────────────────────────────────────── */
  logoutButton: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 44,
    marginBottom: 20,
    marginTop: 4,
  },
  logoutText: {
    color: '#FF453A',
    fontSize: 17,
    fontWeight: '400',
  },

  /* ── Footer ─────────────────────────────────────────── */
  footer: {
    textAlign: 'center',
    color: '#48484A',
    fontSize: 13,
    marginBottom: 32,
  },
});
