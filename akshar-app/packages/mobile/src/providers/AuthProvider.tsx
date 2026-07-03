/**
 * AuthProvider — manages session state, token refresh, and auth lifecycle.
 * Persists tokens + deviceId to Keychain so the user stays logged in across
 * app restarts. When refresh tokens expire, falls back to face-based
 * re-authentication if a deviceId is available.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as Keychain from 'react-native-keychain';
import { auth as authApi, setToken } from '../services/api';
import { captureHashOnly } from '../services/face-capture';
import { config } from '../config';

const KEYCHAIN_SERVICE = 'com.akshar.session';
const DEVICE_KEYCHAIN_SERVICE = 'com.akshar.device';

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  isAdmin: boolean;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (token: string, refreshToken: string, userId: string) => void;
  logout: () => Promise<void>;
  deviceId: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

// --- Keychain helpers ---

async function persistSession(token: string, refreshToken: string, userId: string): Promise<void> {
  try {
    const value = JSON.stringify({ token, refreshToken, userId });
    await Keychain.setGenericPassword('session', value, { service: KEYCHAIN_SERVICE });
  } catch {}
}

async function clearPersistedSession(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  } catch {}
}

async function getPersistedSession(): Promise<{ token: string; refreshToken: string; userId: string } | null> {
  try {
    const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (!credentials) return null;
    return JSON.parse(credentials.password);
  } catch {
    return null;
  }
}

async function getPersistedDeviceId(): Promise<string | null> {
  try {
    const credentials = await Keychain.getGenericPassword({ service: DEVICE_KEYCHAIN_SERVICE });
    if (!credentials) return null;
    return credentials.password;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    userId: null,
    isAdmin: false,
    loading: true,
  });
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const login = useCallback((token: string, refreshToken: string, userId: string) => {
    setToken(token);
    refreshTokenRef.current = refreshToken;
    setState({ isAuthenticated: true, userId, isAdmin: false, loading: false });
    scheduleRefresh(token, userId);
    persistSession(token, refreshToken, userId);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {}
    setToken(null);
    refreshTokenRef.current = null;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setState({ isAuthenticated: false, userId: null, isAdmin: false, loading: false });
    await clearPersistedSession();
    // Note: deviceId is NOT cleared on logout — allows face re-login
  }, []);

  function scheduleRefresh(token: string, userId: string) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresIn = payload.exp - Math.floor(Date.now() / 1000);
      const refreshIn = Math.max(0, (expiresIn - config.tokenRefreshBuffer) * 1000);

      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(async () => {
        if (!refreshTokenRef.current) return;
        try {
          const result = await authApi.refresh(refreshTokenRef.current);
          setToken(result.token);
          refreshTokenRef.current = result.refreshToken;
          scheduleRefresh(result.token, userId);
          persistSession(result.token, result.refreshToken, userId);
        } catch {
          // Refresh failed — attempt silent face re-authentication
          const reauthed = await attemptFaceReauth();
          if (!reauthed) {
            logout();
          }
        }
      }, refreshIn);
    } catch {}
  }

  /**
   * Attempt silent face-based re-authentication when refresh token expires.
   * Returns true if successful, false if user must manually log in.
   */
  async function attemptFaceReauth(): Promise<boolean> {
    try {
      const storedDeviceId = await getPersistedDeviceId();
      if (!storedDeviceId) return false;

      // Capture face silently (skip liveness for background re-auth)
      const faceHash = await captureHashOnly();
      const result = await authApi.faceLogin(faceHash, storedDeviceId);

      // Success — restore session
      setToken(result.token);
      refreshTokenRef.current = result.refreshToken;
      setState({ isAuthenticated: true, userId: result.userId, isAdmin: false, loading: false });
      scheduleRefresh(result.token, result.userId);
      await persistSession(result.token, result.refreshToken, result.userId);
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    // On mount, load deviceId and restore session from Keychain
    (async () => {
      // Load deviceId (persisted during enrollment)
      const storedDeviceId = await getPersistedDeviceId();
      if (storedDeviceId) {
        setDeviceId(storedDeviceId);
      }

      // Attempt session restoration
      const stored = await getPersistedSession();
      if (!stored) {
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      // 1. Try using stored access token (may still be valid)
      try {
        const payload = JSON.parse(atob(stored.token.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);

        if (payload.exp > now) {
          setToken(stored.token);
          refreshTokenRef.current = stored.refreshToken;
          setState({ isAuthenticated: true, userId: stored.userId, isAdmin: false, loading: false });
          scheduleRefresh(stored.token, stored.userId);
          return;
        }
      } catch {}

      // 2. Access token expired — try refresh token
      try {
        const result = await authApi.refresh(stored.refreshToken);
        setToken(result.token);
        refreshTokenRef.current = result.refreshToken;
        setState({ isAuthenticated: true, userId: result.userId, isAdmin: false, loading: false });
        scheduleRefresh(result.token, result.userId);
        await persistSession(result.token, result.refreshToken, result.userId);
        return;
      } catch {}

      // 3. Refresh token also expired — try silent face re-authentication
      if (storedDeviceId) {
        try {
          const faceHash = await captureHashOnly();
          const result = await authApi.faceLogin(faceHash, storedDeviceId);
          setToken(result.token);
          refreshTokenRef.current = result.refreshToken;
          setState({ isAuthenticated: true, userId: result.userId, isAdmin: false, loading: false });
          scheduleRefresh(result.token, result.userId);
          await persistSession(result.token, result.refreshToken, result.userId);
          return;
        } catch {}
      }

      // 4. All restoration attempts failed — user must manually log in
      await clearPersistedSession();
      setState(prev => ({ ...prev, loading: false }));
    })();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, deviceId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
