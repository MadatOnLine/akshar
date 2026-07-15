/**
 * RiskVerificationScreen — mandatory full-screen identity check when account is at risk.
 * Non-dismissible until reverify succeeds (matches web risk overlay).
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import * as Keychain from 'react-native-keychain';
import { auth } from '../services/api';
import { captureFaceWithLiveness, type LivenessState } from '../services/face-capture';
import { FaceCamera } from '../components/FaceCamera';
import { useAuth } from '../providers/AuthProvider';

const DEVICE_KEYCHAIN_SERVICE = 'com.akshar.device';

const emptyLiveness = (): LivenessState => ({
  stage: 'passive',
  passiveStatus: 'pending',
  activeStatus: 'pending',
  motionPercent: 0,
  challengeText: '',
  timerSeconds: 0,
  statusMessage: '',
  statusKind: '',
});

interface Props {
  visible: boolean;
  reason: string;
  onVerified: () => void;
}

export function RiskVerificationScreen({ visible, reason, onVerified }: Props) {
  const { deviceId: authDeviceId } = useAuth();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [liveness, setLiveness] = useState<LivenessState>(emptyLiveness());

  const resolveDeviceId = useCallback(async () => {
    if (authDeviceId) return authDeviceId;
    const stored = await Keychain.getGenericPassword({ service: DEVICE_KEYCHAIN_SERVICE });
    return stored ? stored.password : null;
  }, [authDeviceId]);

  const handleVerify = useCallback(async () => {
    const devId = await resolveDeviceId();
    if (!devId) {
      setStatus('Device ID missing — log out and enroll again');
      return;
    }
    setBusy(true);
    setLiveness(emptyLiveness());
    setStatus('Running verification...');
    try {
      const hash = await captureFaceWithLiveness(setLiveness);
      const result = await auth.reverify(hash, devId, true);
      if (result.passed && !result.requiresRiskCheck) {
        setStatus('Verification complete');
        onVerified();
      } else {
        setStatus(result.riskReason || 'Verification failed — try again');
      }
    } catch (err: any) {
      setStatus(err.message || 'Verification failed');
    } finally {
      setBusy(false);
    }
  }, [onVerified, resolveDeviceId]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <Text style={styles.title}>Identity verification required</Text>
        <Text style={styles.reason}>{reason || 'Complete verification to continue using Akshar.'}</Text>
        <Text style={styles.warn}>This step cannot be skipped.</Text>

        <View style={styles.camShell}>
          <FaceCamera active={visible && !busy} />
          {liveness.stage === 'active' && liveness.challengeText !== '' && (
            <View style={styles.challengeOverlay}>
              <Text style={styles.challengeText}>{liveness.challengeText}</Text>
              <Text style={styles.challengeTimer}>{liveness.timerSeconds}s</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.btn, busy && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Complete verification</Text>
          )}
        </TouchableOpacity>

        {status !== '' && (
          <Text style={[styles.status, status.includes('complete') && styles.statusGood]}>{status}</Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c1018', padding: 20, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#ff8a8a', textAlign: 'center', marginBottom: 8 },
  reason: { fontSize: 14, color: '#9aa8c0', textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  warn: { fontSize: 13, fontWeight: '600', color: '#ff6b6b', textAlign: 'center', marginBottom: 16 },
  camShell: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#05080d',
    borderWidth: 1,
    borderColor: '#663333',
    marginBottom: 16,
  },
  challengeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeText: { fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center', paddingHorizontal: 16 },
  challengeTimer: { marginTop: 8, color: '#58e1c0', fontWeight: '700' },
  btn: {
    backgroundColor: '#6d8cff',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  status: { marginTop: 14, fontSize: 14, color: '#ff6b6b', textAlign: 'center' },
  statusGood: { color: '#43d17a' },
});
