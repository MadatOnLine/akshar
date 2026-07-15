/**
 * Mobile app configuration.
 * - iOS Simulator (Mac or cloud via Appetize): see dev-endpoints.ts (rebuild after ngrok).
 * - Android Emulator: 10.0.2.2 maps to the host machine.
 * - Physical iPhone on same WiFi: run prepare-ios-cloud-test.ps1 and use your PC LAN IP.
 */
import { Platform } from 'react-native';
import { devEndpoints } from './dev-endpoints';

function resolveDevHost(): string {
  const override =
    typeof process !== 'undefined' && process.env?.AKSHAR_DEV_HOST
      ? process.env.AKSHAR_DEV_HOST
      : undefined;
  if (override) return override;
  if (Platform.OS === 'android') return '10.0.2.2';
  return 'localhost';
}

const host = resolveDevHost();
const useCustomEndpoints = devEndpoints.authUrl !== `http://${host}:8001`;

export const config = useCustomEndpoints
  ? {
      authUrl: devEndpoints.authUrl,
      aiUrl: devEndpoints.aiUrl,
      meshUrl: devEndpoints.meshUrl,
      meshWsUrl: devEndpoints.meshWsUrl,
      couchdbSyncUrl: devEndpoints.couchdbSyncUrl,
      livenessTimeout: 15,
      maxMessageLength: 5000,
      tokenRefreshBuffer: 5 * 60,
    }
  : {
      authUrl: `http://${host}:8001`,
      aiUrl: `http://${host}:8002`,
      meshUrl: `http://${host}:8003`,
      meshWsUrl: `ws://${host}:8003`,
      couchdbSyncUrl: `http://${host}:5984/akshar_vault`,
      livenessTimeout: 15,
      maxMessageLength: 5000,
      tokenRefreshBuffer: 5 * 60,
    };
