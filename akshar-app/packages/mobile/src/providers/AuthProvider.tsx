/**
 * AuthProvider — manages session state, token refresh, and auth lifecycle.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { auth as authApi, setToken } from '../services/api';
import { config } from '../config';

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  isAdmin: boolean;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (token: string, refreshToken: string, userId: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    userId: null,
    isAdmin: false,
    loading: true,
  });
  const refreshTokenRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const login = useCallback((token: string, refreshToken: string, userId: string) => {
    setToken(token);
    refreshTokenRef.current = refreshToken;
    setState({ isAuthenticated: true, userId, isAdmin: false, loading: false });
    scheduleRefresh(token);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {}
    setToken(null);
    refreshTokenRef.current = null;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setState({ isAuthenticated: false, userId: null, isAdmin: false, loading: false });
  }, []);

  function scheduleRefresh(token: string) {
    // Decode JWT exp (simple base64 decode — no verification needed client-side)
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
          scheduleRefresh(result.token);
        } catch {
          // Refresh failed — force logout
          logout();
        }
      }, refreshIn);
    } catch {}
  }

  useEffect(() => {
    // On mount, check if we have stored credentials (simplified for MVP)
    setState(prev => ({ ...prev, loading: false }));
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
