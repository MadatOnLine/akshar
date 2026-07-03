/**
 * Mobile app configuration.
 */
export const config = {
  authUrl: 'http://localhost:8001',
  aiUrl: 'http://localhost:8002',
  meshUrl: 'http://localhost:8003',
  meshWsUrl: 'ws://localhost:8003',
  couchdbSyncUrl: 'http://localhost:5984/akshar_vault',
  livenessTimeout: 15,
  maxMessageLength: 5000,
  tokenRefreshBuffer: 5 * 60, // refresh 5 min before expiry (seconds)
} as const;
