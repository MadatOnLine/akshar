/**
 * Health check endpoint.
 */
import { Router } from 'express';
import * as anomaly from '../services/anomaly.js';
import { getPeerIds } from '../services/recovery.js';
export const healthRouter = Router();
healthRouter.get('/mesh/health', (_req, res) => {
    res.json({
        ok: true,
        service: 'akshar-mesh',
        version: '1.0.0',
        peers: getPeerIds().length,
        anomaly: anomaly.getStatus(),
    });
});
//# sourceMappingURL=health.js.map