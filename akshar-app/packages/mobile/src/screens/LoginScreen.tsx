/**
 * LoginScreen — device-native biometric authentication.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { auth } from '../services/api';
import { useAuth } from '../providers/AuthProvider';

export function LoginScreen() {
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const handleBiometricLogin = async () => {
    setError('');
    try {
      // In production: call ReactNativeBiometrics.simplePrompt()
      // MVP: simulate biometric success
      const biometricToken = 'biometric-verified-' + Date.now();
      const deviceId = 'device-mvp'; // In production: from secure storage

      const result = await auth.biometricLogin(deviceId, biometricToken);
      login(result.token, result.refreshToken, result.userId);
    } catch (err: any) {
      setAttempts(prev => prev + 1);
      setError(err.message || 'Authentication failed');
    }
  };

  useEffect(() => {
    // Auto-trigger biometric on screen load
    handleBiometricLogin();
  }, []);

  return (
    <View style={styles.container} data-testid="login-screen">
      <Text style={styles.logo}>अक्षर</Text>
      <Text style={styles.title}>Welcome Back</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handleBiometricLogin}
        data-testid="login-biometric-button"
        accessibilityLabel="Authenticate with biometric"
      >
        <Text style={styles.buttonEmoji}>🔐</Text>
        <Text style={styles.buttonText}>Unlock with Face ID</Text>
      </TouchableOpacity>

      {attempts >= 3 && (
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          data-testid="login-pin-fallback"
          accessibilityLabel="Use PIN instead"
        >
          <Text style={styles.secondaryText}>Use PIN instead</Text>
        </TouchableOpacity>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FAFAFA' },
  logo: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 48 },
  button: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6200EE', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, gap: 12, minHeight: 44 },
  buttonEmoji: { fontSize: 24 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  secondaryButton: { backgroundColor: '#F5F5F5', marginTop: 16 },
  secondaryText: { color: '#666', fontSize: 16, fontWeight: '600' },
  error: { color: '#F44336', marginTop: 24, textAlign: 'center' },
});
