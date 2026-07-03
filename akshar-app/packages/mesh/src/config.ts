/**
 * Configuration for akshar-mesh service.
 */
import 'dotenv/config';

export const config = {
  port: parseInt(process.env.MESH_PORT || '8003'),
  host: process.env.MESH_HOST || '0.0.0.0',

  // CouchDB
  couchdbUrl: process.env.COUCHDB_URL || 'http://admin:admin@127.0.0.1:5984',
  vaultDb: process.env.VAULT_DB || 'akshar_vault',
  groupsDb: process.env.GROUPS_DB || 'akshar_groups',
  feedDb: process.env.FEED_DB || 'akshar_feed',
  keysDb: process.env.KEYS_DB || 'akshar_keys',

  // Auth
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production-minimum-32-chars!',
  serviceApiKey: process.env.SERVICE_API_KEY || 'akshar-internal-key-change-in-production',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8002',
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:8001',

  // Anomaly Detection
  anomalyPollInterval: parseInt(process.env.ANOMALY_POLL_INTERVAL || '5000'),
  initialReplicationFactor: 1,
  maxReplicationFactor: 16,

  // Messaging
  messageBacklogLimit: parseInt(process.env.MESSAGE_BACKLOG_LIMIT || '100'),
  feedPageSize: parseInt(process.env.FEED_PAGE_SIZE || '20'),
  aiTimeout: parseInt(process.env.AI_TIMEOUT || '500'),

  // Rate limiting
  messageRateLimit: parseInt(process.env.MESSAGE_RATE_LIMIT || '60'), // per minute per user
} as const;
