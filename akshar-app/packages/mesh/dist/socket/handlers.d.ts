/**
 * Socket.IO event handlers — real-time messaging, key exchange, sharing.
 */
import { Server as SocketServer, Socket } from 'socket.io';
/**
 * Register all Socket.IO event handlers for a connected client.
 */
export declare function registerHandlers(io: SocketServer, socket: Socket): void;
