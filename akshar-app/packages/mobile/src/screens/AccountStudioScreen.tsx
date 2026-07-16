/**
 * AccountStudioScreen — trust snapshot, post analytics, reports & appeals.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../services/api';
import { useAuth } from '../providers/AuthProvider';
import { RiskVerificationScreen } from './RiskVerificationScreen';
import type { AccountReport, StudioDashboard, Tier2Check } from '../types';

interface Props {
  navigation: { goBack: () => void };
}

function CheckList({ checks }: { checks: Tier2Check[] }) {
  if (!checks?.length) return <Text style={styles.muted}>—</Text>;
  return (
    <>
      {checks.map(c => (
        <View key={c.id} style={styles.checkRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkLabel}>{c.label}</Text>
            <Text style={styles.checkDetail}>{c.detail}</Text>
          </View>
          <Text style={[styles.checkResult, c.pass ? styles.pass : styles.fail]}>
            {c.pass ? 'OK' : '—'} {Math.round((c.score || 0) * 100)}%
          </Text>
        </View>
      ))}
    </>
  );
}

export function AccountStudioScreen({ navigation }: Props) {
  const { userId, checkRisk } = useAuth();
  const [data, setData] = useState<StudioDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [appealTexts, setAppealTexts] = useState<Record<string, string>>({});
  const [appealStatus, setAppealStatus] = useState<Record<string, string>>({});
  const [showRisk, setShowRisk] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const loadStudio = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const dash = await auth.getStudio(userId);
      setData(dash);
      setShowRisk(dash.requiresRiskCheck);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadStudio();
  }, [loadStudio]);

  const submitAppeal = async (reportId: string) => {
    const text = (appealTexts[reportId] || '').trim();
    if (text.length < 10) {
      setAppealStatus(s => ({ ...s, [reportId]: 'Appeal must be at least 10 characters' }));
      return;
    }
    try {
      setAppealStatus(s => ({ ...s, [reportId]: 'Submitting...' }));
      await auth.submitAppeal(reportId, text);
      setAppealStatus(s => ({ ...s, [reportId]: 'Appeal reviewed' }));
      await loadStudio();
      await checkRisk();
    } catch (err: any) {
      setAppealStatus(s => ({ ...s, [reportId]: err.message || 'Appeal failed' }));
    }
  };

  const renderReport = (r: AccountReport) => {
    const ap = r.appeal || { status: 'none' };
    const canAppeal = r.status === 'upheld' && ap.status !== 'approved' && ap.status !== 'pending';
    return (
      <View key={r.reportId} style={styles.report}>
        <Text style={styles.reportTitle}>
          {r.category} · <Text style={r.status === 'upheld' ? styles.fail : styles.pass}>{r.status}</Text>
        </Text>
        <Text style={styles.reportReason}>{r.reason}</Text>
        {ap.reviewNotes ? <Text style={styles.muted}>Review: {ap.reviewNotes}</Text> : null}
        {canAppeal && (
          <>
            <TextInput
              style={styles.appealInput}
              placeholder="Explain why this report is incorrect..."
              placeholderTextColor="#667"
              multiline
              value={appealTexts[r.reportId] || ''}
              onChangeText={t => setAppealTexts(s => ({ ...s, [r.reportId]: t }))}
            />
            <TouchableOpacity style={styles.appealBtn} onPress={() => submitAppeal(r.reportId)}>
              <Text style={styles.appealBtnText}>Submit appeal</Text>
            </TouchableOpacity>
            {appealStatus[r.reportId] ? (
              <Text style={styles.muted}>{appealStatus[r.reportId]}</Text>
            ) : null}
          </>
        )}
        {ap.status === 'approved' && <Text style={styles.pass}>Appeal approved — report dismissed</Text>}
        {ap.status === 'rejected' && <Text style={styles.fail}>Appeal rejected — report upheld</Text>}
      </View>
    );
  };

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6d8cff" />
      </View>
    );
  }

  const t = data?.trust;
  const a = data?.analytics?.totals;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#090b10' }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.headerContainer}>
          <View style={styles.headerTitleRow}>
            <Image source={require('../../assets/logo.png')} style={styles.headerLogo} />
            <View>
              <Text style={styles.title}>Account Studio</Text>
              <Text style={styles.sub}>Trust snapshot, analytics, and reports</Text>
            </View>
          </View>
        </View>

        <Animated.View style={[styles.card, styles.heroCard, { opacity: fadeAnim, transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }]}>
          <Text style={styles.heroLabel}>Trust score</Text>
          <Text style={styles.trustBig}>{(t?.score || 0).toLocaleString()} / 10,000</Text>
          <Text style={styles.heroTier}>{t?.tier || '—'}</Text>
          <Text style={styles.heroMuted}>
            {(t?.integrity?.verdict || '—')} · {(t?.binding?.verdict || '—')}
          </Text>
        </Animated.View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Account integrity</Text>
          <CheckList checks={t?.integrity?.checks || []} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Person binding</Text>
          <CheckList checks={t?.binding?.checks || []} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Post analytics</Text>
          <View style={styles.statRow}>
            {[
              ['Posts', a?.posts],
              ['Likes', a?.likes],
              ['Dislikes', a?.dislikes],
              ['Shares', a?.shares],
            ].map(([label, n]) => (
              <View key={String(label)} style={styles.stat}>
                <Text style={styles.statN}>{n ?? 0}</Text>
                <Text style={styles.statL}>{label}</Text>
              </View>
            ))}
          </View>
          {(data?.analytics?.posts || []).slice(0, 8).map(p => (
            <View key={p.postId} style={styles.postRow}>
              <Text style={styles.postContent} numberOfLines={2}>{p.content || '(no text)'}</Text>
              <Text style={styles.muted}>👍 {p.likes} · 👎 {p.dislikes} · 🔄 {p.shares}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Reports against your account</Text>
          <Text style={styles.muted}>Submit an appeal for upheld reports you believe are incorrect.</Text>
          {(data?.reports || []).length ? data!.reports.map(renderReport) : (
            <Text style={styles.muted}>No reports on your account.</Text>
          )}
        </View>
      </ScrollView>

      <RiskVerificationScreen
        visible={showRisk}
        reason={data?.riskReason || ''}
        onVerified={async () => {
          setShowRisk(false);
          await loadStudio();
          await checkRisk();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#090b10' },
  container: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#090b10', alignItems: 'center', justifyContent: 'center' },
  back: { marginBottom: 16 },
  backText: { color: '#6d8cff', fontSize: 16, fontWeight: '600' },
  headerContainer: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1c2433',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerLogo: {
    width: 52,
    height: 52,
    resizeMode: 'contain',
    borderRadius: 12,
  },
  title: { fontSize: 26, fontWeight: '900', color: '#ffffff', letterSpacing: 0.5 },
  sub: { fontSize: 13, color: '#8b97ad', marginTop: 4, fontWeight: '500' },
  card: {
    backgroundColor: '#121824',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2a3d',
    padding: 20,
    marginBottom: 16,
  },
  heroCard: {
    backgroundColor: '#182030',
    borderColor: '#2d3a54',
    shadowColor: '#6d8cff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  heroLabel: { fontSize: 13, fontWeight: '800', color: '#8b97ad', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  cardLabel: { fontSize: 15, fontWeight: '800', color: '#c5d0e6', marginBottom: 16, letterSpacing: 0.5 },
  trustBig: { fontSize: 40, fontWeight: '900', color: '#ffffff', textShadowColor: 'rgba(109, 140, 255, 0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  heroTier: { fontSize: 16, color: '#43d17a', fontWeight: '700', marginTop: 6 },
  heroMuted: { fontSize: 13, color: '#8b97ad', marginTop: 8, fontWeight: '500' },
  muted: { fontSize: 12, color: '#8b97ad', marginTop: 6, lineHeight: 17 },
  checkRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a2230',
  },
  checkLabel: { fontSize: 14, color: '#e8edf6', fontWeight: '600' },
  checkDetail: { fontSize: 12, color: '#6a7891', marginTop: 4 },
  checkResult: { fontSize: 13, fontWeight: '800', marginLeft: 12, alignSelf: 'center' },
  pass: { color: '#43d17a' },
  fail: { color: '#ff6b6b' },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  stat: {
    flex: 1,
    minWidth: 70,
    backgroundColor: '#0a0d14',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1c2433',
  },
  statN: { fontSize: 20, fontWeight: '900', color: '#ffffff' },
  statL: { fontSize: 11, color: '#8b97ad', marginTop: 4, textTransform: 'uppercase', fontWeight: '700' },
  postRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a2230' },
  postContent: { fontSize: 14, color: '#c5d0e6', marginBottom: 6, lineHeight: 20 },
  report: {
    backgroundColor: '#0a0d14',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1c2433',
    padding: 16,
    marginTop: 12,
  },
  reportTitle: { fontSize: 15, fontWeight: '800', color: '#e8edf6', marginBottom: 8 },
  reportReason: { fontSize: 14, color: '#aeb9cb', lineHeight: 20 },
  appealInput: {
    marginTop: 12,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#2d3a54',
    borderRadius: 10,
    padding: 12,
    color: '#e8edf6',
    backgroundColor: '#090b10',
    textAlignVertical: 'top',
    fontSize: 14,
  },
  appealBtn: {
    marginTop: 12,
    backgroundColor: '#6d8cff',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  appealBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});
