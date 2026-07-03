import jwt from 'jsonwebtoken';
import { config } from '../config.js';
/**
 * Express middleware — validates Bearer JWT and attaches userId to request.
 */
export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ ok: false, error: 'Missing authorization' });
        return;
    }
    try {
        const token = authHeader.slice(7);
        const payload = jwt.verify(token, config.jwtSecret);
        req.userId = payload.sub;
        req.sessionId = payload.sid;
        next();
    }
    catch {
        res.status(401).json({ ok: false, error: 'Invalid or expired token' });
    }
}
/**
 * Socket.IO middleware — validates JWT from handshake auth.
 */
export function socketAuth(socket, next) {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
        return next(new Error('Authentication required'));
    }
    try {
        const payload = jwt.verify(token, config.jwtSecret);
        socket.data.userId = payload.sub;
        socket.data.sessionId = payload.sid;
        next();
    }
    catch {
        next(new Error('Invalid or expired token'));
    }
}
//# sourceMappingURL=auth.js.map