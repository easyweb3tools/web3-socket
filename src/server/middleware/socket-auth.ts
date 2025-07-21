import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import jwt from 'jsonwebtoken';
import { Logger } from '../logger';

/**
 * Socket.IO authentication middleware
 * This middleware validates JWT tokens for Socket.IO connections
 */
export function createSocketAuthMiddleware(logger: Logger) {
    const jwtSecret = process.env.JWT_SECRET || 'easyweb3.TOOLS';
    const moduleLogger = logger.child({ module: 'SocketAuthMiddleware' });

    return function socketAuthMiddleware(
        socket: Socket,
        next: (err?: ExtendedError) => void
    ) {
        const token = extractToken(socket);

        // If no token is provided, allow connection but mark as unauthenticated
        // The client will need to authenticate via the 'register' event
        if (!token) {
            moduleLogger.debug('No authentication token provided', {
                socketId: socket.id,
                ip: socket.handshake.address
            });

            // Store authentication status in socket data
            socket.data.authenticated = false;
            return next();
        }

        // Verify the token
        try {
            const decoded = jwt.verify(token, jwtSecret) as { sub?: string, userId?: string };

            // Ensure the token contains a user identifier
            if (!decoded.userId && !decoded.sub) {
                moduleLogger.warn('Invalid token format: missing user identifier', {
                    socketId: socket.id,
                    ip: socket.handshake.address
                });

                return next(new Error('Invalid token format'));
            }

            // Store user data in socket for easy access
            socket.data.userId = decoded.userId || decoded.sub;
            socket.data.authenticated = true;
            socket.data.token = token;

            moduleLogger.debug('Socket authenticated via JWT', {
                socketId: socket.id,
                userId: socket.data.userId
            });

            return next();
        } catch (error) {
            moduleLogger.warn('JWT verification failed', {
                socketId: socket.id,
                ip: socket.handshake.address,
                error: (error as Error).message
            });

            // Allow connection but mark as unauthenticated
            socket.data.authenticated = false;
            return next();
        }
    };
}

/**
 * Extract JWT token from socket handshake
 */
function extractToken(socket: Socket): string | null {
    // Check authorization header
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // Check query parameter
    const { token } = socket.handshake.auth;
    if (token) {
        return token;
    }

    // Check cookie
    const cookies = parseCookies(socket.handshake.headers.cookie);
    if (cookies.token) {
        return cookies.token;
    }

    return null;
}

/**
 * Parse cookies from cookie header
 */
function parseCookies(cookieHeader?: string): Record<string, string> {
    const cookies: Record<string, string> = {};

    if (!cookieHeader) {
        return cookies;
    }

    cookieHeader.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            cookies[key] = value;
        }
    });

    return cookies;
}