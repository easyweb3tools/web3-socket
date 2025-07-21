import { Server, Socket } from 'socket.io';
import { Logger } from './logger';
import jwt from 'jsonwebtoken';

// User connection metadata
export interface UserMetadata {
    userAgent?: string;
    ip?: string;
    connectedAt: Date;
    lastActivity: Date;
    [key: string]: any;
}

// Connection details
export interface ConnectionDetails {
    userId: string;
    socketId: string;
    metadata: UserMetadata;
}

export class ConnectionManager {
    private connections: Map<string, ConnectionDetails> = new Map(); // socketId -> ConnectionDetails
    private userConnections: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>
    private jwtSecret: string;
    private moduleLogger: Logger;

    constructor(
        private io: Server,
        private logger: Logger
    ) {
        this.jwtSecret = process.env.JWT_SECRET || 'easyweb3.TOOLS';
        this.moduleLogger = logger.child({ module: 'ConnectionManager' });

        this.moduleLogger.info('ConnectionManager initialized');
    }

    /**
     * Register a user connection with authentication
     */
    public async registerUser(socket: Socket, userId: string, token?: string): Promise<boolean> {
        // Create a child logger with context for this operation
        const opLogger = this.moduleLogger.child({
            operation: 'registerUser',
            userId,
            socketId: socket.id,
            hasToken: !!token
        });

        try {
            // Verify authentication if token is provided
            if (token) {
                const isValid = await this.verifyToken(token, userId);
                if (!isValid) {
                    opLogger.warn('Authentication failed', {
                        reason: 'invalid_token'
                    });
                    return false;
                }
            }

            // Create connection metadata
            const metadata: UserMetadata = {
                userAgent: socket.handshake.headers['user-agent'],
                ip: socket.handshake.address,
                connectedAt: new Date(),
                lastActivity: new Date()
            };

            // Store connection details
            const connectionDetails: ConnectionDetails = {
                userId,
                socketId: socket.id,
                metadata
            };

            this.connections.set(socket.id, connectionDetails);

            // Add to user connections map
            if (!this.userConnections.has(userId)) {
                this.userConnections.set(userId, new Set());
            }

            this.userConnections.get(userId)?.add(socket.id);

            // Store user data in socket for easy access
            socket.data.userId = userId;
            socket.data.authenticated = true;

            // Get user's connection count
            const connectionCount = this.userConnections.get(userId)?.size || 1;

            opLogger.info('User registered successfully', {
                ip: metadata.ip,
                userAgent: metadata.userAgent?.substring(0, 50), // Truncate for logging
                connectionCount,
                transport: socket.conn?.transport?.name
            });

            return true;
        } catch (error) {
            opLogger.error('Error registering user', error as Error, {
                errorCode: 'REGISTRATION_ERROR'
            });
            return false;
        }
    }

    /**
     * Remove a user connection
     */
    public removeUser(socket: Socket): void {
        const connectionDetails = this.connections.get(socket.id);

        if (connectionDetails) {
            const { userId } = connectionDetails;
            const opLogger = this.moduleLogger.child({
                operation: 'removeUser',
                userId,
                socketId: socket.id
            });

            this.connections.delete(socket.id);

            const userSockets = this.userConnections.get(userId);
            if (userSockets) {
                userSockets.delete(socket.id);

                if (userSockets.size === 0) {
                    this.userConnections.delete(userId);
                    opLogger.info('User disconnected (all connections closed)', {
                        connectedDuration: this.getConnectionDuration(connectionDetails.metadata.connectedAt)
                    });
                } else {
                    opLogger.info('User connection removed (other connections remain)', {
                        connectedDuration: this.getConnectionDuration(connectionDetails.metadata.connectedAt),
                        remainingConnections: userSockets.size
                    });
                }
            }
        }
    }

    /**
     * Update user activity timestamp
     */
    public updateActivity(socketId: string): void {
        const connectionDetails = this.connections.get(socketId);

        if (connectionDetails) {
            const previousActivity = new Date(connectionDetails.metadata.lastActivity);
            connectionDetails.metadata.lastActivity = new Date();

            // Only log if significant time has passed (more than 1 minute)
            const timeSinceLastActivity = (connectionDetails.metadata.lastActivity.getTime() - previousActivity.getTime()) / 1000;
            if (timeSinceLastActivity > 60) {
                this.moduleLogger.debug('User activity updated', {
                    operation: 'updateActivity',
                    userId: connectionDetails.userId,
                    socketId,
                    inactiveDuration: Math.round(timeSinceLastActivity)
                });
            }
        }
    }

    /**
     * Get user ID for a socket
     */
    public getUserId(socketId: string): string | null {
        return this.connections.get(socketId)?.userId || null;
    }

    /**
     * Get connection details for a socket
     */
    public getConnectionDetails(socketId: string): ConnectionDetails | null {
        return this.connections.get(socketId) || null;
    }

    /**
     * Get all sockets for a user
     */
    public getSocketsForUser(userId: string): Socket[] {
        const socketIds = this.userConnections.get(userId);

        if (!socketIds) {
            return [];
        }

        return Array.from(socketIds)
            .map(socketId => this.io.sockets.sockets.get(socketId))
            .filter((socket): socket is Socket => socket !== undefined);
    }

    /**
     * Check if a socket is authenticated
     */
    public isAuthenticated(socket: Socket): boolean {
        return this.connections.has(socket.id) && !!socket.data.authenticated;
    }

    /**
     * Get active connections count
     */
    public getActiveConnectionsCount(): number {
        return this.connections.size;
    }

    /**
     * Get user connections map
     */
    public getUserConnections(): Map<string, Set<string>> {
        return new Map(this.userConnections);
    }

    /**
     * Get all connection details
     */
    public getAllConnections(): ConnectionDetails[] {
        return Array.from(this.connections.values());
    }

    /**
     * Get inactive connections (no activity for specified minutes)
     */
    public getInactiveConnections(minutes: number): ConnectionDetails[] {
        const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

        return this.getAllConnections().filter(conn =>
            conn.metadata.lastActivity < cutoffTime
        );
    }

    /**
     * Disconnect inactive sockets
     */
    public disconnectInactiveSockets(minutes: number): number {
        const inactiveConnections = this.getInactiveConnections(minutes);

        if (inactiveConnections.length > 0) {
            this.moduleLogger.info('Disconnecting inactive sockets', {
                operation: 'disconnectInactiveSockets',
                count: inactiveConnections.length,
                inactivityThreshold: minutes
            });
        }

        inactiveConnections.forEach(conn => {
            const socket = this.io.sockets.sockets.get(conn.socketId);
            if (socket) {
                socket.disconnect(true);
                this.moduleLogger.info('Disconnected inactive socket', {
                    userId: conn.userId,
                    socketId: conn.socketId,
                    inactiveDuration: this.getInactiveDuration(conn.metadata.lastActivity)
                });
            }
        });

        return inactiveConnections.length;
    }

    /**
     * Verify JWT token
     */
    private async verifyToken(token: string, userId: string): Promise<boolean> {
        try {
            const decoded = jwt.verify(token, this.jwtSecret) as { sub: string, userId: string };

            // Verify that the token belongs to the claimed user
            return decoded.userId === userId || decoded.sub === userId;
        } catch (error) {
            this.moduleLogger.error('Token verification failed', error as Error, {
                operation: 'verifyToken',
                userId
            });
            return false;
        }
    }

    /**
     * Get connection duration in seconds
     */
    private getConnectionDuration(connectedAt: Date): number {
        return Math.round((Date.now() - connectedAt.getTime()) / 1000);
    }

    /**
     * Get inactivity duration in seconds
     */
    private getInactiveDuration(lastActivity: Date): number {
        return Math.round((Date.now() - lastActivity.getTime()) / 1000);
    }
}