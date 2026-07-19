import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ai } from '../services/api';
import type { DashboardMetrics } from '../types';
import { TrustBadge } from '../components/TrustBadge';

export function ModeratorScreen() {
  const [dashboard, setDashboard] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      setError(null);
      const data = await ai.getDashboard();
      setDashboard(data);
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text style={styles.loadingText}>Establishing Secure Link...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        testID="moderator-screen"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E5FF" />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerIconContainer}>
            <Image source={require('../../assets/logo.jpg')} style={styles.headerLogo} />
          </View>
          <Text style={styles.title}>Moderator Node</Text>
          <Text style={styles.subtitle}>AI Threat & Trust Intelligence</Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <View style={styles.errorIconBox}>
              <Text style={styles.errorIcon}>⚠️</Text>
            </View>
            <Text style={styles.errorTitle}>Access Denied</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh} activeOpacity={0.8}>
              <Text style={styles.retryText}>RETRY CONNECTION</Text>
            </TouchableOpacity>
          </View>
        ) : dashboard ? (
          <>
            {/* Network Overview Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.indicator, { backgroundColor: '#00E5FF' }]} />
                <Text style={styles.cardTitle}>Global Network Status</Text>
              </View>
              <View style={styles.statRow}>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: '#E8EDF6' }]}>{dashboard.totalUsers}</Text>
                  <Text style={styles.statLabel}>Total Nodes</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: '#00E5FF', textShadowColor: 'rgba(0, 229, 255, 0.5)', textShadowRadius: 8 }]}>{dashboard.humanCount}</Text>
                  <Text style={styles.statLabel}>Verified Humans</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: '#FF4B8B', textShadowColor: 'rgba(255, 75, 139, 0.5)', textShadowRadius: 8 }]}>{dashboard.botCount}</Text>
                  <Text style={styles.statLabel}>Threats Blocked</Text>
                </View>
              </View>
            </View>

            {/* Trust Distribution Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.indicator, { backgroundColor: '#4A90E2' }]} />
                <Text style={styles.cardTitle}>Node Authorization Tiers</Text>
              </View>
              
              <View style={styles.tierContainer}>
                <View style={styles.tierRow}>
                  <View style={styles.tierInfo}>
                    <TrustBadge tier="colony" size="small" />
                    <Text style={styles.tierName}>Colony (Level 3)</Text>
                  </View>
                  <Text style={styles.tierCount}>{dashboard.usersByTier.colony}</Text>
                </View>
                
                <View style={styles.tierRow}>
                  <View style={styles.tierInfo}>
                    <TrustBadge tier="drone" size="small" />
                    <Text style={styles.tierName}>Drone (Level 2)</Text>
                  </View>
                  <Text style={styles.tierCount}>{dashboard.usersByTier.drone}</Text>
                </View>

                <View style={[styles.tierRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                  <View style={styles.tierInfo}>
                    <TrustBadge tier="larva" size="small" />
                    <Text style={styles.tierName}>Larva (Level 1)</Text>
                  </View>
                  <Text style={styles.tierCount}>{dashboard.usersByTier.larva}</Text>
                </View>
              </View>
            </View>

            {/* Flagged Accounts */}
            <View style={[styles.card, styles.alertCard]}>
              <View style={styles.cardHeader}>
                <View style={[styles.indicator, { backgroundColor: '#FFB84C' }]} />
                <Text style={styles.cardTitle}>High-Risk Accounts</Text>
              </View>
              
              {dashboard.flaggedAccounts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateIcon}>✨</Text>
                  <Text style={styles.emptyText}>Network is secure. No flagged accounts.</Text>
                </View>
              ) : (
                dashboard.flaggedAccounts.map((account, idx) => (
                  <View key={account.userId} style={[styles.flaggedRow, idx === dashboard.flaggedAccounts.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 }]}>
                    <View style={styles.flaggedInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={[styles.flaggedId, { marginBottom: 0 }]}>{account.userId.slice(0, 6)}...{account.userId.slice(-6)}</Text>
                        {account.riskHold && (
                          <View style={styles.riskHoldBadge}>
                            <Text style={styles.riskHoldText}>RISK HOLD</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: account.riskReason ? 4 : 0 }}>
                        <View style={styles.scoreBadge}>
                          <Text style={styles.flaggedScore}>Trust: {Math.round(account.trust)}</Text>
                        </View>
                      </View>
                      {account.riskReason ? (
                        <Text style={styles.riskReasonText}>{account.riskReason}</Text>
                      ) : null}
                    </View>
                    <TrustBadge tier={account.tier} size="small" />
                  </View>
                ))
              )}
            </View>
            
            {/* Drift Policy Flags */}
            <View style={[styles.card, styles.dangerCard]}>
              <View style={styles.cardHeader}>
                <View style={[styles.indicator, { backgroundColor: '#FF4B8B' }]} />
                <Text style={styles.cardTitle}>AI Policy Drift</Text>
              </View>

              {dashboard.flaggedConversations.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateIcon}>✓</Text>
                  <Text style={styles.emptyText}>No drift signatures detected in network.</Text>
                </View>
              ) : (
                dashboard.flaggedConversations.map((convoId, idx) => (
                  <View key={convoId} style={[styles.flaggedRow, idx === dashboard.flaggedConversations.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 }]}>
                    <View style={styles.flaggedInfo}>
                      <Text style={styles.flaggedId}>Room: {convoId}</Text>
                    </View>
                    <View style={styles.dangerBadge}>
                      <Text style={styles.dangerBadgeText}>DRIFT DETECTED</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}
        
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A10', // Deep space black
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 20,
  },
  loadingText: {
    color: '#00E5FF',
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerIconContainer: {
    marginBottom: 16,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    padding: 2,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  headerLogo: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
    borderRadius: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#00E5FF',
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  errorContainer: {
    backgroundColor: '#1A0B10',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 139, 0.3)',
    shadowColor: '#FF4B8B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  errorIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 75, 139, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 20,
  },
  errorTitle: {
    color: '#FF4B8B',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  errorText: {
    color: '#E8EDF6',
    marginBottom: 24,
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.8,
  },
  retryButton: {
    backgroundColor: '#FF4B8B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#FF4B8B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: '#111622',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1C2333',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  alertCard: {
    borderColor: 'rgba(255, 184, 76, 0.2)',
  },
  dangerCard: {
    borderColor: 'rgba(255, 75, 139, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B97AD',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#1C2333',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#8B97AD',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tierContainer: {
    backgroundColor: '#0C0F17',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#151B27',
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2130',
  },
  tierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierName: {
    fontSize: 14,
    color: '#E8EDF6',
    fontWeight: '500',
    marginLeft: 12,
  },
  tierCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyStateIcon: {
    fontSize: 24,
    marginBottom: 8,
    opacity: 0.5,
  },
  emptyText: {
    color: '#566178',
    fontSize: 13,
    fontWeight: '500',
  },
  flaggedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2130',
  },
  flaggedInfo: {
    flex: 1,
  },
  flaggedId: {
    fontSize: 14,
    color: '#E8EDF6',
    fontFamily: 'Courier',
    fontWeight: '600',
    marginBottom: 6,
  },
  riskHoldBadge: {
    backgroundColor: 'rgba(255, 75, 139, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 139, 0.3)',
    marginLeft: 8,
  },
  riskHoldText: {
    fontSize: 9,
    color: '#FF4B8B',
    fontWeight: '800',
    letterSpacing: 1,
  },
  riskReasonText: {
    fontSize: 11,
    color: '#FFB84C',
    fontStyle: 'italic',
    marginTop: 4,
  },
  scoreBadge: {
    backgroundColor: 'rgba(255, 184, 76, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  flaggedScore: {
    fontSize: 11,
    color: '#FFB84C',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dangerBadge: {
    backgroundColor: 'rgba(255, 75, 139, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 139, 0.3)',
  },
  dangerBadgeText: {
    fontSize: 10,
    color: '#FF4B8B',
    fontWeight: '800',
    letterSpacing: 1,
  },
});
