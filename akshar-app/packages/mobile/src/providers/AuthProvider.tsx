/**
 * AuthProvider — session state, token refresh, and risk verification gate.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as Keychain from 'react-native-keychain';
import { auth as authApi, setToken } from '../services/api';
import { captureHashOnly } from '../services/face-capture';
import { config } from '../config';

const KEYCHAIN_SERVICE = 'com.akshar.session';
const DEVICE_KEYCHAIN_SERVICE = 'com.akshar.device';
const INIT_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  isAdmin: boolean;
  loading: boolean;
  requiresRiskCheck: boolean;
  riskReason: string;
}

interface AuthContextType extends AuthState {
  login: (token: string, refreshToken: string, userId: string) => Promise<void>;
  logout: () => Promise<void>;
  deviceId: string | null;
  setDeviceId: (id: string) => void;
  checkRisk: (loginData?: { requiresRiskCheck?: boolean; riskReason?: string }) => Promise<void>;
  clearRisk: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

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
    requiresRiskCheck: false,
    riskReason: '',
  });
  const [deviceId, setDeviceIdState] = useState<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRisk = useCallback(() => {
    setState(prev => ({ ...prev, requiresRiskCheck: false, riskReason: '' }));
  }, []);

  const checkRisk = useCallback(async (loginData?: { requiresRiskCheck?: boolean; riskReason?: string }) => {
    if (loginData?.requiresRiskCheck) {
      setState(prev => ({
        ...prev,
        requiresRiskCheck: true,
        riskReason: loginData.riskReason || 'Identity verification required',
      }));
      return;
    }
    try {
      const risk = await authApi.getRiskStatus();
      setState(prev => ({
        ...prev,
        requiresRiskCheck: !!risk.requiresRiskCheck,
        riskReason: risk.riskReason || '',
      }));
    } catch {}
  }, []);

  const login = useCallback(async (token: string, refreshToken: string, userId: string) => {
    setToken(token);
    refreshTokenRef.current = refreshToken;
    setState(prev => ({
      ...prev,
      isAuthenticated: true,
      userId,
      isAdmin: false,
      loading: false,
    }));
    scheduleRefresh(token, userId);
    await persistSession(token, refreshToken, userId);
    await checkRisk();
  }, [checkRisk]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {}
    setToken(null);
    refreshTokenRef.current = null;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setState({
      isAuthenticated: false,
      userId: null,
      isAdmin: false,
      loading: false,
      requiresRiskCheck: false,
      riskReason: '',
    });
    await clearPersistedSession();
  }, []);

  const setDeviceId = useCallback((id: string) => {
    setDeviceIdState(id);
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
          const reauthed = await attemptFaceReauth();
          if (!reauthed) {
            logout();
          }
        }
      }, refreshIn);
    } catch {}
  }

  async function attemptFaceReauth(): Promise<boolean> {
    try {
      const storedDeviceId = await getPersistedDeviceId();
      if (!storedDeviceId) return false;

      const faceHash = await captureHashOnly();
      const result = await authApi.faceLogin(faceHash, storedDeviceId, false);

      setToken(result.token);
      refreshTokenRef.current = result.refreshToken;
      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        userId: result.userId,
        isAdmin: false,
        loading: false,
      }));
      scheduleRefresh(result.token, result.userId);
      await persistSession(result.token, result.refreshToken, result.userId);
      await checkRisk(result);
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    let cancelled = false;

    const finishLoading = () => {
      if (!cancelled) {
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    (async () => {
      try {
        await withTimeout((async () => {
          const storedDeviceId = await getPersistedDeviceId();
          if (storedDeviceId) {
            setDeviceIdState(storedDeviceId);
          }

          const stored = await getPersistedSession();
          if (!stored) {
            return;
          }

          try {
            const payload = JSON.parse(atob(stored.token.split('.')[1]));
            const now = Math.floor(Date.now() / 1000);

            if (payload.exp > now) {
              setToken(stored.token);
              refreshTokenRef.current = stored.refreshToken;
              setState(prev => ({
                ...prev,
                isAuthenticated: true,
                userId: stored.userId,
                isAdmin: false,
                loading: false,
              }));
              scheduleRefresh(stored.token, stored.userId);
              await checkRisk();
              return;
            }
          } catch {}

          try {
            const result = await withTimeout(
              authApi.refresh(stored.refreshToken),
              3000,
              'Token refresh',
            );
            setToken(result.token);
            refreshTokenRef.current = result.refreshToken;
            setState(prev => ({
              ...prev,
              isAuthenticated: true,
              userId: result.userId,
              isAdmin: false,
              loading: false,
            }));
            scheduleRefresh(result.token, result.userId);
            await persistSession(result.token, result.refreshToken, result.userId);
            await checkRisk();
            return;
          } catch {}

          await clearPersistedSession();
        })(), INIT_TIMEOUT_MS, 'Session restore');
      } catch {
      } finally {
        finishLoading();
      }
    })();

    return () => {
      cancelled = true;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [checkRisk]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        deviceId,
        setDeviceId,
        checkRisk,
        clearRisk,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
