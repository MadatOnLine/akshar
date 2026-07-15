/**
 * API endpoints for mobile dev builds.
 * Overridden by scripts/prepare-ios-cloud-test.ps1 before cloud iOS builds (ngrok URLs).
 * Rebuild the iOS app after changing these values.
 */
export const devEndpoints = {
  authUrl: 'http://localhost:8001',
  aiUrl: 'http://localhost:8002',
  meshUrl: 'http://localhost:8003',
  meshWsUrl: 'ws://localhost:8003',
  couchdbSyncUrl: 'http://localhost:5984/akshar_vault',
} as const;
