/**
 * HTTP API client — wraps fetch with auth headers and error handling.
 */
import { config } from '../config';
import type { RiskStatus, StudioDashboard } from '../types';

let _token: string | null = null;

export function setToken(token: string | null): void {
  _token = token;
}

export function getToken(): string | null {
  return _token;
}

function formatApiError(detail: unknown, fallback: string): string {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (typeof item === 'object' && item && 'msg' in item ? String(item.msg) : String(item)))
      .join('; ');
  }
  return fallback;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`;
  }

  const response = await fetch(url, { ...options, headers });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(formatApiError(body.detail, body.error || `HTTP ${response.status}`));
  }

  return body;
}

// --- Auth API ---
export const auth = {
  enroll: (name: string, deviceId: string) =>
    request<any>(`${config.authUrl}/auth/enroll`, {
      method: 'POST',
      body: JSON.stringify({ name, deviceId }),
    }),

  enrollDirect: (
    name: string,
    deviceId: string,
    faceHash: string,
    attemptId: string,
    challengeId: string,
  ) =>
    request<any>(`${config.authUrl}/auth/enroll-direct`, {
      method: 'POST',
      body: JSON.stringify({ name, deviceId, faceHash, attemptId, challengeId }),
    }),

  liveness: (attemptId: string, challengeId: string, faceHash: string) =>
    request<any>(`${config.authUrl}/auth/liveness`, {
      method: 'POST',
      body: JSON.stringify({ attemptId, challengeId, faceHash }),
    }),

  faceLogin: (faceHash: string, deviceId: string, livenessPassed = true) =>
    request<any>(`${config.authUrl}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ faceHash, deviceId, livenessPassed }),
    }),

  biometricLogin: (deviceId: string, biometricToken: string) =>
    request<any>(`${config.authUrl}/auth/biometric`, {
      method: 'POST',
      body: JSON.stringify({ deviceId, biometricToken }),
    }),

  refresh: (refreshToken: string) =>
    request<any>(`${config.authUrl}/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  logout: () =>
    request<any>(`${config.authUrl}/auth/logout`, { method: 'POST' }),

  getProfile: (userId: string) =>
    request<any>(`${config.authUrl}/auth/profile/${userId}`),

  getTier2: (userId: string) =>
    request<any>(`${config.authUrl}/auth/tier2/${userId}`),

  reverify: (faceHash: string, deviceId: string, livenessPassed = true) =>
    request<any>(`${config.authUrl}/auth/reverify`, {
      method: 'POST',
      body: JSON.stringify({ faceHash, deviceId, livenessPassed }),
    }),

  getRiskStatus: () =>
    request<RiskStatus>(`${config.authUrl}/auth/risk-status`),

  getStudio: (userId: string) =>
    request<StudioDashboard>(`${config.authUrl}/auth/studio/${userId}`),

  submitAppeal: (reportId: string, appealText: string) =>
    request<any>(`${config.authUrl}/auth/reports/${reportId}/appeal`, {
      method: 'POST',
      body: JSON.stringify({ appealText }),
    }),
};

// --- AI API ---
export const ai = {
  getTrust: (userId: string) =>
    request<any>(`${config.aiUrl}/ai/trust/${userId}`),

  getDashboard: (serviceKey: string = 'akshar-internal-dev-key') =>
    request<any>(`${config.aiUrl}/ai/dashboard`, {
      headers: { 'x-service-key': serviceKey },
    }),
};

// --- Mesh API ---
export const mesh = {
  getGroups: () =>
    request<any>(`${config.meshUrl}/mesh/groups`),

  createGroup: (name: string, memberIds: string[]) =>
    request<any>(`${config.meshUrl}/mesh/groups`, {
      method: 'POST',
      body: JSON.stringify({ name, memberIds }),
    }),

  getFeed: (limit = 20, skip = 0) =>
    request<any>(`${config.meshUrl}/mesh/feed?limit=${limit}&skip=${skip}`),

  shareToFeed: (groupId: string, messageId: string, plaintext: string, originalAuthorId?: string) =>
    request<any>(`${config.meshUrl}/mesh/share`, {
      method: 'POST',
      body: JSON.stringify({ groupId, messageId, plaintext, originalAuthorId }),
    }),

  react: (postId: string, type: 'like' | 'dislike' | 'share') =>
    request<any>(`${config.meshUrl}/mesh/feed/${postId}/react`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    }),
};
