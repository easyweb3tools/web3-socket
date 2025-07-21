import { Request, Response } from 'express';
import { Server } from 'socket.io';
import { ConnectionManager } from '../connection-manager';
import { RoomManager } from '../room-manager';
import { Logger } from '../logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Push API for sending messages to clients
 */
export class PushAPI {
    constructor(
        private io: Server,
        private connectionManager: ConnectionManager,
        private roomManager: RoomManager,
        private logger: Logger
    ) { }

    /**
     * Push a message to a specific user
     */
    public async pushToUser(req: Request, res: Response): Promise<void> {
        try {
            // Validate request
            const { userId, event, payload, volatile = false } = req.body;

            if (!userId || !event || !payload) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: userId, event, payload',
                    code: 'MISSING_REQUIRED_FIELDS'
                });
                return;
            }

            // Get user sockets
            const sockets = this.connectionManager.getSocketsForUser(userId);

            if (sockets.length === 0) {
                this.logger.warn(`No active connections for user ${userId}`);
                res.status(404).json({
                    success: false,
                    error: 'User not connected',
                    code: 'USER_NOT_CONNECTED'
                });
                return;
            }

            // Generate request ID for tracking
            const requestId = req.body.requestId || uuidv4();

            // Prepare message with metadata
            const message = {
                ...payload,
                _meta: {
                    requestId,
                    timestamp: new Date().toISOString(),
                    source: 'push-api'
                }
            };

            // Send message to all user sockets
            let deliveredCount = 0;

            for (const socket of sockets) {
                try {
                    if (volatile) {
                        socket.volatile.emit(event, message);
                    } else {
                        socket.emit(event, message);
                    }
                    deliveredCount++;
                } catch (error) {
                    this.logger.error(`Error sending message to socket ${socket.id}`, error as Error);
                }
            }

            this.logger.info(`Message pushed to user ${userId}, event: ${event}`, {
                requestId,
                socketCount: sockets.length,
                deliveredCount,
                volatile
            });

            res.status(200).json({
                success: true,
                requestId,
                delivered: deliveredCount,
                total: sockets.length
            });
        } catch (error) {
            this.logger.error('Error pushing message', error as Error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR'
            });
        }
    }

    /**
     * Push a message to multiple users
     */
    public async pushToUsers(req: Request, res: Response): Promise<void> {
        try {
            // Validate request
            const { userIds, event, payload, volatile = false } = req.body;

            if (!userIds || !Array.isArray(userIds) || !event || !payload) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: userIds (array), event, payload',
                    code: 'MISSING_REQUIRED_FIELDS'
                });
                return;
            }

            // Generate request ID for tracking
            const requestId = req.body.requestId || uuidv4();

            // Prepare message with metadata
            const message = {
                ...payload,
                _meta: {
                    requestId,
                    timestamp: new Date().toISOString(),
                    source: 'push-api'
                }
            };

            // Track delivery statistics
            const stats = {
                total: userIds.length,
                delivered: 0,
                sockets: 0,
                notFound: 0
            };

            // Send message to each user
            for (const userId of userIds) {
                const sockets = this.connectionManager.getSocketsForUser(userId);

                if (sockets.length === 0) {
                    stats.notFound++;
                    continue;
                }

                stats.sockets += sockets.length;

                for (const socket of sockets) {
                    try {
                        if (volatile) {
                            socket.volatile.emit(event, message);
                        } else {
                            socket.emit(event, message);
                        }
                        stats.delivered++;
                    } catch (error) {
                        this.logger.error(`Error sending message to socket ${socket.id}`, error as Error);
                    }
                }
            }

            this.logger.info(`Message pushed to ${stats.delivered} sockets for ${userIds.length} users, event: ${event}`, {
                requestId,
                stats
            });

            res.status(200).json({
                success: true,
                requestId,
                stats
            });
        } catch (error) {
            this.logger.error('Error pushing message to multiple users', error as Error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR'
            });
        }
    }

    /**
     * Broadcast a message to a room
     */
    public async broadcastToRoom(req: Request, res: Response): Promise<void> {
        try {
            // Validate request
            const { room, event, payload, volatile = false } = req.body;

            if (!room || !event || !payload) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: room, event, payload',
                    code: 'MISSING_REQUIRED_FIELDS'
                });
                return;
            }

            // Check if room exists
            const roomDetails = this.roomManager.getRoomDetails(room);
            if (!roomDetails) {
                res.status(404).json({
                    success: false,
                    error: 'Room not found',
                    code: 'ROOM_NOT_FOUND'
                });
                return;
            }

            // Generate request ID for tracking
            const requestId = req.body.requestId || uuidv4();

            // Prepare message with metadata
            const message = {
                ...payload,
                _meta: {
                    requestId,
                    timestamp: new Date().toISOString(),
                    source: 'push-api',
                    room
                }
            };

            // Broadcast to room
            if (volatile) {
                this.io.to(room).volatile.emit(event, message);
            } else {
                this.io.to(room).emit(event, message);
            }

            const recipients = roomDetails.members.size;

            this.logger.info(`Broadcast to room ${room}, event: ${event}, recipients: ${recipients}`, {
                requestId,
                volatile
            });

            res.status(200).json({
                success: true,
                requestId,
                recipients,
                room
            });
        } catch (error) {
            this.logger.error('Error broadcasting message', error as Error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR'
            });
        }
    }

    /**
     * Broadcast a message to all connected clients
     */
    public async broadcastToAll(req: Request, res: Response): Promise<void> {
        try {
            // Validate request
            const { event, payload, volatile = false } = req.body;

            if (!event || !payload) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: event, payload',
                    code: 'MISSING_REQUIRED_FIELDS'
                });
                return;
            }

            // Generate request ID for tracking
            const requestId = req.body.requestId || uuidv4();

            // Prepare message with metadata
            const message = {
                ...payload,
                _meta: {
                    requestId,
                    timestamp: new Date().toISOString(),
                    source: 'push-api',
                    broadcast: true
                }
            };

            // Broadcast to all clients
            if (volatile) {
                this.io.volatile.emit(event, message);
            } else {
                this.io.emit(event, message);
            }

            const recipients = this.connectionManager.getActiveConnectionsCount();

            this.logger.info(`Broadcast to all clients, event: ${event}, recipients: ${recipients}`, {
                requestId,
                volatile
            });

            res.status(200).json({
                success: true,
                requestId,
                recipients
            });
        } catch (error) {
            this.logger.error('Error broadcasting to all clients', error as Error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR'
            });
        }
    }
}