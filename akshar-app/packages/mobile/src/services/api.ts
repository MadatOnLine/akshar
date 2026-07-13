/**
 * HTTP API client — wraps fetch with auth headers and error handling.
 */
import { config } from '../config';

let _token: string | null = null;

export function setToken(token: string | null): void {
  _token = token;
}

export function getToken(): string | null {
  return _token;
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

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || body.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// --- Auth API ---
export const auth = {
  enroll: (name: string, deviceId: string) =>
    request<any>(`${config.authUrl}/auth/enroll`, {
      method: 'POST',
      body: JSON.stringify({ name, deviceId }),
    }),

  enrollDirect: (name: string, deviceId: string, faceHash: string) =>
    request<any>(`${config.authUrl}/auth/enroll-direct`, {
      method: 'POST',
      body: JSON.stringify({ name, deviceId, faceHash }),
    }),

  liveness: (attemptId: string, challengeId: string, faceHash: string) =>
    request<any>(`${config.authUrl}/auth/liveness`, {
      method: 'POST',
      body: JSON.stringify({ attemptId, challengeId, faceHash }),
    }),

  faceLogin: (faceHash: string, deviceId: string) =>
    request<any>(`${config.authUrl}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ faceHash, deviceId }),
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
