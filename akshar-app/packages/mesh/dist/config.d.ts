/**
 * Configuration for akshar-mesh service.
 */
import 'dotenv/config';
export declare const config: {
    readonly port: number;
    readonly host: string;
    readonly couchdbUrl: string;
    readonly vaultDb: string;
    readonly groupsDb: string;
    readonly feedDb: string;
    readonly keysDb: string;
    readonly jwtSecret: string;
    readonly serviceApiKey: string;
    readonly aiServiceUrl: string;
    readonly authServiceUrl: string;
    readonly anomalyPollInterval: number;
    readonly initialReplicationFactor: 1;
    readonly maxReplicationFactor: 16;
    readonly messageBacklogLimit: number;
    readonly feedPageSize: number;
    readonly aiTimeout: number;
    readonly messageRateLimit: number;
};
