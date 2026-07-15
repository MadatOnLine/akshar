/**
 * AccountStudioScreen — trust snapshot, post analytics, reports & appeals.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
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
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Account Studio</Text>
        <Text style={styles.sub}>Trust snapshot, analytics, and reports — no trust history shown.</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Trust score</Text>
          <Text style={styles.trustBig}>{(t?.score || 0).toLocaleString()} / 10,000</Text>
          <Text style={styles.tierText}>{t?.tier || '—'}</Text>
          <Text style={styles.muted}>
            {(t?.integrity?.verdict || '—')} · {(t?.binding?.verdict || '—')}
          </Text>
        </View>

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
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0c1018' },
  container: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0c1018', alignItems: 'center', justifyContent: 'center' },
  back: { marginBottom: 8 },
  backText: { color: '#6d8cff', fontSize: 15 },
  title: { fontSize: 24, fontWeight: '800', color: '#e8edf6', marginBottom: 4 },
  sub: { fontSize: 13, color: '#8b97ad', marginBottom: 16, lineHeight: 18 },
  card: {
    backgroundColor: '#141b28',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#283347',
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: { fontSize: 14, fontWeight: '700', color: '#c5d0e6', marginBottom: 10 },
  trustBig: { fontSize: 30, fontWeight: '800', color: '#e8edf6' },
  tierText: { fontSize: 14, color: '#aeb9cb', marginTop: 4 },
  muted: { fontSize: 12, color: '#8b97ad', marginTop: 6, lineHeight: 17 },
  checkRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2a3d',
  },
  checkLabel: { fontSize: 13, color: '#e8edf6' },
  checkDetail: { fontSize: 11, color: '#667', marginTop: 2 },
  checkResult: { fontSize: 12, fontWeight: '700', marginLeft: 8 },
  pass: { color: '#43d17a' },
  fail: { color: '#ff6b6b' },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  stat: {
    flex: 1,
    minWidth: 70,
    backgroundColor: '#0e131d',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  statN: { fontSize: 18, fontWeight: '800', color: '#e8edf6' },
  statL: { fontSize: 11, color: '#8b97ad', marginTop: 2 },
  postRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1f2a3d' },
  postContent: { fontSize: 13, color: '#e8edf6', marginBottom: 4 },
  report: {
    backgroundColor: '#0e131d',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#283347',
    padding: 12,
    marginTop: 10,
  },
  reportTitle: { fontSize: 14, fontWeight: '700', color: '#e8edf6', marginBottom: 6 },
  reportReason: { fontSize: 13, color: '#9aa8c0', lineHeight: 18 },
  appealInput: {
    marginTop: 8,
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#283347',
    borderRadius: 8,
    padding: 10,
    color: '#e8edf6',
    backgroundColor: '#0c1018',
    textAlignVertical: 'top',
  },
  appealBtn: {
    marginTop: 8,
    backgroundColor: '#1c2433',
    borderWidth: 1,
    borderColor: '#283347',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  appealBtnText: { color: '#e8edf6', fontWeight: '600' },
});
