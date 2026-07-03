/**
 * EnrollmentScreen — face capture + liveness challenge + account creation.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LivenessPrompt } from '../components/LivenessPrompt';
import { auth } from '../services/api';
import { useAuth } from '../providers/AuthProvider';
import type { LivenessChallenge } from '../types';

type EnrollmentState = 'input' | 'capturing' | 'challenging' | 'verifying' | 'success' | 'failed';

export function EnrollmentScreen() {
  const { login } = useAuth();
  const [state, setState] = useState<EnrollmentState>('input');
  const [name, setName] = useState('');
  const [challenge, setChallenge] = useState<LivenessChallenge | null>(null);
  const [error, setError] = useState('');

  const startEnrollment = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setError('');
    setState('capturing');

    try {
      // In production: activate camera, detect face, compute hash
      // MVP: simulate face hash capture
      const mockFaceHash = Array.from({ length: 16 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');

      const result = await auth.enroll(name.trim(), 'device-' + Date.now());
      setChallenge({
        attemptId: result.attemptId,
        challengeId: result.challenge.challengeId,
        action: result.challenge.action,
        timeout: result.challenge.timeout,
      });
      setState('challenging');

      // Store face hash for liveness submission
      (globalThis as any).__tempFaceHash = mockFaceHash;
    } catch (err: any) {
      setError(err.message || 'Enrollment failed');
      setState('input');
    }
  };

  const completeLiveness = async () => {
    if (!challenge) return;
    setState('verifying');

    try {
      const faceHash = (globalThis as any).__tempFaceHash || '0'.repeat(16);
      const result = await auth.liveness(challenge.attemptId, challenge.challengeId, faceHash);

      if (result.passed) {
        setState('success');
        login(result.token, result.refreshToken, result.userId);
      } else if (result.newChallenge) {
        setChallenge({
          attemptId: challenge.attemptId,
          challengeId: result.newChallenge.challengeId,
          action: result.newChallenge.action,
          timeout: result.newChallenge.timeout,
        });
        setState('challenging');
      } else {
        setState('failed');
        setError('Liveness verification failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setState('failed');
    }
  };

  const handleTimeout = () => {
    completeLiveness(); // Submit anyway — server decides if expired
  };

  if (state === 'success') {
    return (
      <View style={styles.container}>
        <Text style={styles.successEmoji}>✅</Text>
        <Text style={styles.title}>Welcome to Akshar!</Text>
        <Text style={styles.subtitle}>Your identity has been verified.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} data-testid="enrollment-screen">
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Prove you're human with a quick face check</Text>

      {state === 'input' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            maxLength={50}
            autoCapitalize="words"
            data-testid="enrollment-name-input"
          />
          <TouchableOpacity
            style={styles.button}
            onPress={startEnrollment}
            data-testid="enrollment-capture-button"
          >
            <Text style={styles.buttonText}>Start Face Capture</Text>
          </TouchableOpacity>
        </>
      )}

      {state === 'capturing' && (
        <View style={styles.cameraPlaceholder} data-testid="enrollment-camera-view">
          <Text style={styles.cameraText}>📷 Camera Active</Text>
          <Text style={styles.cameraSubtext}>Position your face in the circle</Text>
        </View>
      )}

      {state === 'challenging' && challenge && (
        <>
          <LivenessPrompt
            action={challenge.action}
            timeout={challenge.timeout}
            onTimeout={handleTimeout}
          />
          <TouchableOpacity
            style={[styles.button, { marginTop: 20 }]}
            onPress={completeLiveness}
            data-testid="enrollment-done-button"
          >
            <Text style={styles.buttonText}>Done</Text>
          </TouchableOpacity>
        </>
      )}

      {state === 'verifying' && (
        <Text style={styles.subtitle}>Verifying...</Text>
      )}

      {state === 'failed' && (
        <TouchableOpacity style={styles.button} onPress={() => setState('input')}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FAFAFA' },
  title: { fontSize: 28, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32, textAlign: 'center' },
  input: { width: '100%', borderWidth: 1, borderColor: '#DDD', borderRadius: 12, padding: 16, fontSize: 16, backgroundColor: '#FFF', marginBottom: 16 },
  button: { backgroundColor: '#6200EE', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, minWidth: 200, alignItems: 'center', minHeight: 44 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  error: { color: '#F44336', marginTop: 16, textAlign: 'center' },
  cameraPlaceholder: { width: 250, height: 250, borderRadius: 125, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  cameraText: { fontSize: 40 },
  cameraSubtext: { fontSize: 14, color: '#666', marginTop: 8 },
  successEmoji: { fontSize: 64, marginBottom: 16 },
});
