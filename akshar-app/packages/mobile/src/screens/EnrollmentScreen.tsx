/**
 * EnrollmentScreen — direct port of research login/templates/login.html + app.js
 *
 * Layout matches research exactly:
 *   - Live camera feed (front-facing, always visible)
 *   - Challenge overlay (appears during active liveness)
 *   - Motion meter bar (at bottom of camera)
 *   - Liveness steps: passive + active (with dot indicators)
 *   - Name input field
 *   - Two buttons: "Create account & enroll face" + "Log in with face"
 *   - Status message
 *
 * Flow (from research app.js):
 *   1. Camera starts immediately on mount (like research startCamera())
 *   2. User taps button → runHybridLiveness (passive → active → captureHash)
 *   3. POST to server with hash
 */
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { auth } from '../services/api';
import { captureFaceWithLiveness, type LivenessState } from '../services/face-capture';
import { FaceCamera, type FaceCameraRef } from '../components/FaceCamera';
import { useAuth } from '../providers/AuthProvider';

const DEVICE_KEYCHAIN_SERVICE = 'com.akshar.device';

export function EnrollmentScreen() {
  const { login, setDeviceId } = useAuth();
  const cameraRef = useRef<FaceCameraRef>(null);
  const [name, setName] = useState('');
  const [deviceId] = useState(
    () => `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );

  // Liveness UI state — mirrors research DOM updates
  const [liveness, setLiveness] = useState<LivenessState>({
    stage: 'passive',
    passiveStatus: 'pending',
    activeStatus: 'pending',
    motionPercent: 0,
    challengeText: '',
    timerSeconds: 0,
    statusMessage: '',
    statusKind: '',
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);

  const persistDeviceId = useCallback(async () => {
    try {
      await Keychain.setGenericPassword('deviceId', deviceId, { service: DEVICE_KEYCHAIN_SERVICE });
    } catch {}
  }, [deviceId]);

  // --- Enroll button (research: btn-enroll) ---
  const handleEnroll = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setLiveness(s => ({ ...s, statusMessage: 'Enter a display name to create your account.', statusKind: 'bad' }));
      return;
    }

    setIsVerifying(true);
    setLiveness(s => ({ ...s, passiveStatus: 'pending', activeStatus: 'pending', statusMessage: '', statusKind: '' }));

    try {
      const enrollInit = await auth.enroll(trimmedName, deviceId);
      const hash = await captureFaceWithLiveness(setLiveness);

      setLiveness(s => ({ ...s, statusMessage: 'Liveness passed — enrolling your face...', statusKind: 'good' }));

      const result = await auth.enrollDirect(
        trimmedName,
        deviceId,
        hash,
        enrollInit.attemptId,
        enrollInit.challenge.challengeId,
      );

      setLiveness(s => ({ ...s, statusMessage: 'Face enrolled — signing you in...', statusKind: 'good' }));
      await persistDeviceId();
      setDeviceId(deviceId);
      await login(result.token, result.refreshToken, result.userId);
    } catch (err: any) {
      setLiveness(s => ({ ...s, statusMessage: err.message || 'Enrollment failed.', statusKind: 'bad' }));
    } finally {
      setIsVerifying(false);
    }
  }, [name, deviceId, login, persistDeviceId, setDeviceId]);

  // --- Login button (research: btn-login) ---
  const handleLogin = useCallback(async () => {
    setIsVerifying(true);
    setLiveness(s => ({ ...s, passiveStatus: 'pending', activeStatus: 'pending', statusMessage: '', statusKind: '' }));

    try {
      const storedDevice = await Keychain.getGenericPassword({ service: DEVICE_KEYCHAIN_SERVICE });
      const devId = storedDevice ? storedDevice.password : deviceId;

      const hash = await captureFaceWithLiveness(setLiveness);

      setLiveness(s => ({ ...s, statusMessage: 'Liveness passed — matching your face...', statusKind: 'good' }));

      const result = await auth.faceLogin(hash, devId, true);

      setLiveness(s => ({
        ...s,
        statusMessage: `Welcome back, ${result.name}! Signing in...`,
        statusKind: 'good',
      }));
      if (!storedDevice) {
        await Keychain.setGenericPassword('deviceId', devId, { service: DEVICE_KEYCHAIN_SERVICE });
      }
      setDeviceId(devId);
      await login(result.token, result.refreshToken, result.userId);
    } catch (err: any) {
      setLiveness(s => ({ ...s, statusMessage: err.message || 'Login failed.', statusKind: 'bad' }));
    } finally {
      setIsVerifying(false);
    }
  }, [deviceId, login, setDeviceId]);

  const handleResetDevice = useCallback(async () => {
    try {
      await Keychain.resetGenericPassword({ service: DEVICE_KEYCHAIN_SERVICE });
      setLiveness(s => ({
        ...s,
        statusMessage: 'Device reset — create a new account or log in with face.',
        statusKind: 'good',
      }));
    } catch {
      setLiveness(s => ({ ...s, statusMessage: 'Could not reset device.', statusKind: 'bad' }));
    }
  }, []);

  // Dot color (research CSS: .pending→warn, .ok→good, .fail→bad)
  const dotColor = (status: string) =>
    status === 'ok' ? '#43d17a' : status === 'fail' ? '#ff6b6b' : status === 'pending' ? '#ffc66b' : '#44506a';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Sign in with your face</Text>
      <Text style={styles.description}>
        Tier 0 verification runs a <Text style={styles.bold}>hybrid liveness</Text> check
        — passive motion detection plus an active challenge you respond to on cue —
        then captures and hashes your face, all on-device.
      </Text>

      {/* Camera shell (research: .cam-shell) — LIVE CAMERA FEED */}
      <View style={[styles.camShell, isVerifying && styles.camShellVerifying]}>
        <FaceCamera ref={cameraRef} active={cameraActive} />

        {/* Live badge (research: #live-badge) */}
        <View style={[styles.liveBadge, cameraActive && styles.liveBadgeOn]}>
          <Text style={[styles.liveBadgeText, cameraActive && styles.liveBadgeTextOn]}>
            {cameraActive ? 'camera live' : 'camera off'}
          </Text>
        </View>

        {/* Challenge overlay (research: #challenge-overlay) */}
        {liveness.stage === 'active' && liveness.challengeText !== '' && (
          <View style={styles.challengeOverlay}>
            <Text style={styles.challengeText}>{liveness.challengeText}</Text>
            <Text style={styles.challengeTimer}>{liveness.timerSeconds}s</Text>
          </View>
        )}

        {/* Motion meter (research: .motion-meter) */}
        <View style={styles.motionMeter}>
          <View style={[styles.motionFill, { width: `${liveness.motionPercent}%` }]} />
        </View>
      </View>

      {/* Liveness steps (research: ul.liveness-steps) */}
      <View style={styles.steps}>
        <View style={[styles.stepRow, liveness.passiveStatus === 'ok' && styles.stepRowOk, liveness.passiveStatus === 'fail' && styles.stepRowFail]}>
          <View style={[styles.dot, { backgroundColor: dotColor(liveness.passiveStatus) }]} />
          <Text style={styles.stepText}>
            Passive liveness <Text style={styles.stepSmall}>(live motion present)</Text>
          </Text>
        </View>
        <View style={[styles.stepRow, liveness.activeStatus === 'ok' && styles.stepRowOk, liveness.activeStatus === 'fail' && styles.stepRowFail]}>
          <View style={[styles.dot, { backgroundColor: dotColor(liveness.activeStatus) }]} />
          <Text style={styles.stepText}>
            Active challenge <Text style={styles.stepSmall}>(respond on cue)</Text>
          </Text>
        </View>
      </View>

      {/* Name field (research: .field) */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Display name</Text>
        <TextInput
          style={[styles.fieldInput, isVerifying && styles.fieldDisabled]}
          placeholder="e.g. Sidd"
          placeholderTextColor="#44506a"
          value={name}
          onChangeText={setName}
          maxLength={50}
          autoCapitalize="words"
          editable={!isVerifying}
          accessibilityLabel="Display name"
        />
      </View>

      {/* Buttons (research: .btn-row) */}
      <View style={[styles.btnRow, isVerifying && styles.btnRowDisabled]}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={handleEnroll}
          disabled={isVerifying}
          accessibilityLabel="Create account and enroll face"
        >
          <Text style={styles.btnPrimaryText}>Create account & enroll face</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btn}
          onPress={handleLogin}
          disabled={isVerifying}
          accessibilityLabel="Log in with face"
        >
          <Text style={styles.btnText}>Log in with face</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleResetDevice} disabled={isVerifying}>
        <Text style={styles.resetLink}>Reset this device</Text>
      </TouchableOpacity>

      {/* Status (research: #status) */}
      {liveness.statusMessage !== '' && (
        <Text style={[
          styles.status,
          liveness.statusKind === 'good' && styles.statusGood,
          liveness.statusKind === 'bad' && styles.statusBad,
        ]}>
          {liveness.statusMessage}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0c1018',
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#0c1018',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#e8edf6',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    color: '#8b97ad',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 19,
  },
  bold: { fontWeight: '700', color: '#e8edf6' },

  // Camera shell — renders LIVE camera feed
  camShell: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#05080d',
    borderWidth: 1,
    borderColor: '#283347',
    position: 'relative',
    marginBottom: 8,
  },
  camShellVerifying: {
    borderColor: '#58e1c0',
    shadowColor: '#58e1c0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },

  // Live badge
  liveBadge: {
    position: 'absolute',
    left: 10,
    bottom: 16,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: '#283347',
    zIndex: 3,
  },
  liveBadgeOn: { borderColor: '#43d17a' },
  liveBadgeText: { fontSize: 12, color: '#8b97ad' },
  liveBadgeTextOn: { color: '#43d17a' },

  // Challenge overlay
  challengeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(8,12,20,0.7)',
    zIndex: 2,
  },
  challengeText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
    paddingHorizontal: 16,
  },
  challengeTimer: {
    fontSize: 16,
    fontWeight: '700',
    color: '#58e1c0',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },

  // Motion meter
  motionMeter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 3,
  },
  motionFill: {
    height: '100%',
    backgroundColor: '#6d8cff',
  },

  // Liveness steps
  steps: { marginBottom: 14 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 3,
    borderWidth: 1,
    borderColor: '#283347',
    borderRadius: 10,
    backgroundColor: '#1c2433',
  },
  stepRowOk: { borderColor: '#43d17a' },
  stepRowFail: { borderColor: '#ff6b6b' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  stepText: { fontSize: 14, color: '#8b97ad' },
  stepSmall: { fontSize: 12, color: '#8b97ad', opacity: 0.8 },

  // Name field
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, color: '#8b97ad', marginBottom: 6 },
  fieldInput: {
    width: '100%',
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 10,
    fontSize: 15,
    backgroundColor: '#0e131d',
    borderWidth: 1,
    borderColor: '#283347',
    color: '#e8edf6',
  },
  fieldDisabled: { opacity: 0.4 },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  btnRowDisabled: { opacity: 0.4 },
  btn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#283347',
    backgroundColor: '#1c2433',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#6d8cff',
    borderWidth: 0,
  },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  btnText: { color: '#e8edf6', fontSize: 14 },
  resetLink: { color: '#8b97ad', fontSize: 13, textAlign: 'center', marginBottom: 8 },

  // Status
  status: { fontSize: 14, textAlign: 'center', color: '#8b97ad', minHeight: 20 },
  statusGood: { color: '#43d17a' },
  statusBad: { color: '#ff6b6b' },
});
