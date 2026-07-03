/**
 * akshar-mesh — Entry point: Express + Socket.IO server.
 */
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { setCryptoProvider, NodeCryptoProvider } from '@akshar/crypto';
import { config } from './config.js';
import { initDatabases } from './db/couch.js';
import { errorHandler } from './middleware/error-handler.js';
import { socketAuth } from './middleware/auth.js';
import { relayRouter } from './routes/relay.js';
import { groupsRouter } from './routes/groups.js';
import { feedRouter } from './routes/feed.js';
import { healthRouter } from './routes/health.js';
import { registerHandlers } from './socket/handlers.js';
import * as anomaly from './services/anomaly.js';
// Initialize crypto provider
setCryptoProvider(new NodeCryptoProvider());
const app = express();
const server = createServer(app);
const io = new SocketServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});
// --- Express middleware ---
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '5mb' }));
// Attach io to requests (for relay handler)
app.use((req, _res, next) => {
    req.io = io;
    next();
});
// --- Express routes ---
app.use(relayRouter);
app.use(groupsRouter);
app.use(feedRouter);
app.use(healthRouter);
app.use(errorHandler);
// --- Socket.IO auth + handlers ---
io.use(socketAuth);
io.on('connection', (socket) => {
    registerHandlers(io, socket);
});
// --- Startup ---
async function start() {
    // Initialize CouchDB databases
    await initDatabases();
    console.log('[Mesh] CouchDB databases initialized');
    // Seed anomaly detector (userId from env or default for MVP)
    const nodeId = process.env.NODE_ID || 'mesh-node-1';
    await anomaly.seedFromDb(nodeId);
    anomaly.startDetector(nodeId, io);
    console.log('[Mesh] Anomaly detector started');
    // Start server
    server.listen(config.port, config.host, () => {
        console.log(`[Mesh] akshar-mesh listening on ${config.host}:${config.port}`);
    });
}
start().catch((err) => {
    console.error('[Mesh] Startup failed:', err);
    process.exit(1);
});
export { app, server, io };
//# sourceMappingURL=index.js.map