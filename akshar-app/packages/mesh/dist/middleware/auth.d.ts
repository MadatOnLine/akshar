/**
 * JWT authentication middleware for Express and Socket.IO.
 */
import { Request, Response, NextFunction } from 'express';
export interface AuthPayload {
    userId: string;
    sessionId: string;
}
/**
 * Express middleware — validates Bearer JWT and attaches userId to request.
 */
export declare function requireAuth(req: Request, res: Response, next: NextFunction): void;
/**
 * Socket.IO middleware — validates JWT from handshake auth.
 */
export declare function socketAuth(socket: any, next: (err?: Error) => void): void;
