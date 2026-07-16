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
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c1018' }}>
      <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }}>
      <View style={styles.logoContainer}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
      </View>
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
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 13, color: '#8b97ad', marginBottom: 6, fontWeight: '600', paddingLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Display name</Text>
        <TextInput
          style={[styles.input, isVerifying && { opacity: 0.5 }]}
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
      <View style={[styles.btnGroup, isVerifying && styles.btnDisabled]}>
        <TouchableOpacity
          style={styles.btn}
          onPress={handleEnroll}
          disabled={isVerifying}
          accessibilityLabel="Create account and enroll face"
        >
          <Text style={styles.btnText}>Create account & enroll face</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={handleLogin}
          disabled={isVerifying}
          accessibilityLabel="Log in with face"
        >
          <Text style={styles.btnSecondaryText}>Log in with face</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleResetDevice} disabled={isVerifying}>
        <Text style={styles.resetText}>Reset this device</Text>
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
      </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0c1018' },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 16 },
  logo: { width: 56, height: 56, resizeMode: 'contain', borderRadius: 14 },
  title: { fontSize: 28, fontWeight: '800', color: '#e8edf6', textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 },
  description: { fontSize: 14, color: '#8b97ad', textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 12 },
  bold: { fontWeight: '700', color: '#c5d0e6' },
  camShell: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#05080d',
    borderWidth: 1,
    borderColor: '#1f2a3d',
    marginBottom: 24,
    shadowColor: '#6d8cff',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  camShellVerifying: { borderColor: '#58e1c0' },
  liveBadge: { position: 'absolute', left: 16, bottom: 16, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: '#283347', zIndex: 3 },
  liveBadgeOn: { borderColor: '#43d17a' },
  liveBadgeText: { fontSize: 11, color: '#8b97ad', fontWeight: '700' },
  liveBadgeTextOn: { color: '#43d17a' },
  challengeOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: 'rgba(8,12,20,0.85)', zIndex: 2 },
  challengeText: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', paddingHorizontal: 20 },
  challengeTimer: { fontSize: 16, fontWeight: '700', color: '#58e1c0', backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 99 },
  motionMeter: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 3 },
  motionFill: { height: '100%', backgroundColor: '#6d8cff' },
  steps: { marginBottom: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginVertical: 4, borderWidth: 1, borderColor: '#1f2a3d', borderRadius: 16, backgroundColor: '#141b28' },
  stepRowOk: { borderColor: '#43d17a' },
  stepRowFail: { borderColor: '#ff6b6b' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stepText: { fontSize: 14, color: '#8b97ad', fontWeight: '500' },
  stepSmall: { fontSize: 12, opacity: 0.7 },
  input: { backgroundColor: '#141b28', borderWidth: 1, borderColor: '#283347', borderRadius: 16, padding: 16, color: '#e8edf6', fontSize: 16, marginBottom: 16 },
  btnGroup: { gap: 12 },
  btn: { backgroundColor: '#6d8cff', paddingVertical: 16, borderRadius: 16, alignItems: 'center', minHeight: 56, justifyContent: 'center', shadowColor: '#6d8cff', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  btnSecondary: { backgroundColor: '#1c2433', borderWidth: 1, borderColor: '#283347', paddingVertical: 16, borderRadius: 16, alignItems: 'center', minHeight: 56, justifyContent: 'center' },
  btnSecondaryText: { color: '#c5d0e6', fontWeight: '700', fontSize: 16 },
  resetText: { color: '#667', fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 24, textDecorationLine: 'underline' },
  status: { fontSize: 14, textAlign: 'center', marginTop: 16, minHeight: 20 },
  statusGood: { color: '#43d17a' },
  statusBad: { color: '#ff6b6b' },
});
