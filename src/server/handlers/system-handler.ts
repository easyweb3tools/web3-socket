import { Socket } from 'socket.io';
import { BaseEventHandler } from './base-handler';
import { RoomManager } from '../room-manager';
import { Metrics } from '../metrics';
import { InstanceManager } from '../utils/instance-manager';

/**
 * System event handler for handling system events
 */
export class SystemEventHandler extends BaseEventHandler {
    private instanceManager?: InstanceManager;

    /**
     * Set instance manager
     * 
     * @param instanceManager Instance manager
     */
    public setInstanceManager(instanceManager: InstanceManager): void {
        this.instanceManager = instanceManager;
    }
    /**
     * Register event listeners
     */
    public registerEvents(): void {
        // System events are handled differently, as they are registered directly
        // in the connection handler. This class provides methods for handling those events.
    }

    /**
     * Get the handler name
     */
    public getName(): string {
        return 'system';
    }

    /**
     * Handle connection event
     */
    public async handleConnection(socket: Socket): Promise<void> {
        this.logger.info(`New connection: ${socket.id}`, {
            ip: socket.handshake.address,
            userAgent: socket.handshake.headers['user-agent']?.toString().substring(0, 50),
            transport: socket.conn.transport.name
        });

        // Add to system room for broadcasting system messages
        this.roomManager.addToRoom(socket, 'system:all', 'system');

        // Update room metrics if available
        if (this.metrics) {
            const roomCount = this.roomManager.getRoomCount();
            const userRooms = this.roomManager.getRoomsByType('user').length;
            const groupRooms = this.roomManager.getRoomsByType('group').length;
            const systemRooms = this.roomManager.getRoomsByType('system').length;

            this.metrics.roomCount.set(roomCount);
            this.metrics.roomsByType.set({ type: 'user' }, userRooms);
            this.metrics.roomsByType.set({ type: 'group' }, groupRooms);
            this.metrics.roomsByType.set({ type: 'system' }, systemRooms);
        }

        // Send welcome message
        socket.emit('system:welcome', {
            message: 'Welcome to the Socket.IO server',
            socketId: socket.id,
            timestamp: new Date().toISOString(),
            serverInfo: {
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            }
        });

        // Record outgoing message in metrics
        if (this.metrics) {
            this.metrics.incrementMessageCounter('outgoing', 'system:welcome');
        }
    }

    /**
     * Handle disconnection event
     */
    public async handleDisconnection(socket: Socket, reason: string): Promise<void> {
        const userId = this.connectionManager.getUserId(socket.id);

        if (userId) {
            this.roomManager.removeFromAllRooms(socket);
            this.connectionManager.removeUser(socket);

            this.logger.info(`User ${userId} disconnected (socket ${socket.id})`, {
                reason
            });
        } else {
            this.logger.info(`Socket disconnected: ${socket.id}`, {
                reason
            });
        }

        // Update room metrics if available
        if (this.metrics) {
            const roomCount = this.roomManager.getRoomCount();
            this.metrics.roomCount.set(roomCount);
        }
    }

    /**
     * Handle error event
     */
    public async handleError(socket: Socket, error: Error): Promise<void> {
        const userId = this.connectionManager.getUserId(socket.id);

        this.logger.error(`Socket error: ${socket.id}`, error, {
            userId
        });

        // Record error in metrics if available
        if (this.metrics) {
            this.metrics.recordError('socket_error', error);
        }
    }

    /**
     * Handle reconnection attempt
     */
    public async handleReconnectAttempt(socket: Socket, attemptNumber: number): Promise<void> {
        // Calculate backoff time based on attempt number
        const baseDelay = Math.min(1000 * Math.pow(1.5, attemptNumber - 1), 30000);
        const jitter = 0.1 * baseDelay * (Math.random() * 2 - 1);
        const delay = Math.round(baseDelay + jitter);

        this.logger.info(`Reconnection attempt: ${socket.id}`, {
            attemptNumber,
            backoffDelay: delay,
            transport: socket.conn?.transport?.name || 'unknown'
        });

        // Store reconnection state in socket data for recovery
        socket.data.reconnecting = true;
        socket.data.reconnectAttempt = attemptNumber;
        socket.data.reconnectDelay = delay;

        // If we have previous connection data, store it for recovery
        const previousUserId = socket.data.userId;
        if (previousUserId) {
            socket.data.previousUserId = previousUserId;

            this.logger.debug(`Storing previous user data for reconnection: ${previousUserId}`, {
                socketId: socket.id,
                attemptNumber
            });
        }

        // Emit reconnection status to client
        socket.emit('system:reconnect_status', {
            attempt: attemptNumber,
            delay,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Handle successful reconnection
     */
    public async handleReconnect(socket: Socket, attemptNumber: number): Promise<void> {
        this.logger.info(`Reconnected: ${socket.id}`, {
            attemptNumber,
            transport: socket.conn?.transport?.name || 'unknown'
        });

        // Clear reconnection state
        socket.data.reconnecting = false;
        socket.data.reconnectAttempt = 0;
        socket.data.reconnectDelay = 0;

        // If the socket was authenticated before, we need to re-authenticate
        const userId = socket.data.userId || socket.data.previousUserId;
        if (userId) {
            try {
                // Re-add to user room
                const userRoom = RoomManager.getUserRoom(userId);
                this.roomManager.addToRoom(socket, userRoom, 'user');

                // Ensure user data is properly set
                socket.data.userId = userId;
                socket.data.authenticated = true;

                // Clear previous user data
                delete socket.data.previousUserId;

                this.logger.info(`Re-authenticated user ${userId} after reconnection`, {
                    socketId: socket.id,
                    attemptNumber,
                    reconnectionTime: socket.data.reconnectionTime
                });

                // Update connection metrics if available
                if (this.metrics) {
                    this.metrics.connectionRate.inc({
                        authenticated: 'true',
                        transport: socket.conn?.transport?.name || 'unknown'
                    });
                }

                // Notify client of successful state recovery
                socket.emit('system:state_recovered', {
                    userId,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                this.logger.error(`Failed to recover connection state for user ${userId}`, error as Error, {
                    socketId: socket.id,
                    attemptNumber
                });

                // Notify client of failed state recovery
                socket.emit('system:state_recovery_failed', {
                    message: 'Failed to recover connection state',
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    /**
     * Broadcast system message to all clients
     */
    public broadcastSystemMessage(event: string, data: any): void {
        const payload = {
            ...data,
            timestamp: new Date().toISOString()
        };

        this.io.to('system:all').emit(event, payload);

        const recipients = this.roomManager.getRoomSocketIds('system:all').length;

        this.logger.info(`Broadcast system message: ${event}`, {
            recipients
        });

        // Record outgoing message in metrics
        if (this.metrics) {
            this.metrics.incrementMessageCounter('outgoing', event);

            try {
                const size = JSON.stringify(payload).length;
                this.metrics.recordMessageSize(event, size);
            } catch (e) {
                // Ignore serialization errors
            }
        }
    }

    /**
     * Send system notification to specific user
     */
    public sendSystemNotification(userId: string, title: string, message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
        const userRoom = RoomManager.getUserRoom(userId);

        const payload = {
            title,
            message,
            type,
            timestamp: new Date().toISOString()
        };

        this.io.to(userRoom).emit('system:notification', payload);

        this.logger.info(`Sent system notification to user ${userId}`, {
            title,
            type
        });

        // Record outgoing message in metrics
        if (this.metrics) {
            this.metrics.incrementMessageCounter('outgoing', 'system:notification');

            try {
                const size = JSON.stringify(payload).length;
                this.metrics.recordMessageSize('system:notification', size);
            } catch (e) {
                // Ignore serialization errors
            }
        }
    }

    /**
     * Broadcast system message to all clients across all instances
     */
    public broadcastSystemMessageToAllInstances(event: string, data: any): void {
        const payload = {
            ...data,
            timestamp: new Date().toISOString()
        };

        // Send to local clients
        this.io.to('system:all').emit(event, payload);

        // Send to other instances if Redis adapter is available
        if ((this.io as any).crossInstanceBroadcast) {
            (this.io as any).crossInstanceBroadcast('broadcast', {
                room: 'system:all',
                event,
                payload
            });
        }

        const recipients = this.roomManager.getRoomSocketIds('system:all').length;

        this.logger.info(`Broadcast system message to all instances: ${event}`, {
            recipients,
            crossInstance: (this.io as any).crossInstanceBroadcast ? true : false
        });

        // Record outgoing message in metrics
        if (this.metrics) {
            this.metrics.incrementMessageCounter('outgoing', event);
            this.metrics.incrementMessageCounter('cross-instance', event);

            try {
                const size = JSON.stringify(payload).length;
                this.metrics.recordMessageSize(event, size);
            } catch (e) {
                // Ignore serialization errors
            }
        }
    }

    /**
     * Send system notification to specific user across all instances
     */
    public sendSystemNotificationToAllInstances(userId: string, title: string, message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
        const userRoom = RoomManager.getUserRoom(userId);

        const payload = {
            title,
            message,
            type,
            timestamp: new Date().toISOString()
        };

        // Send to local clients
        this.io.to(userRoom).emit('system:notification', payload);

        // Send to other instances if Redis adapter is available
        if ((this.io as any).crossInstanceBroadcast) {
            (this.io as any).crossInstanceBroadcast('broadcast', {
                room: userRoom,
                event: 'system:notification',
                payload
            });
        }

        this.logger.info(`Sent system notification to user ${userId} across all instances`, {
            title,
            type,
            crossInstance: (this.io as any).crossInstanceBroadcast ? true : false
        });

        // Record outgoing message in metrics
        if (this.metrics) {
            this.metrics.incrementMessageCounter('outgoing', 'system:notification');
            this.metrics.incrementMessageCounter('cross-instance', 'system:notification');

            try {
                const size = JSON.stringify(payload).length;
                this.metrics.recordMessageSize('system:notification', size);
            } catch (e) {
                // Ignore serialization errors
            }
        }
    }

    /**
     * Get instance information
     */
    public getInstanceInfo(): any {
        if (!this.instanceManager) {
            return {
                id: 'unknown',
                hostname: 'unknown',
                connections: this.io.engine.clientsCount,
                uptime: 0
            };
        }

        return this.instanceManager.getInstanceInfo();
    }

    /**
     * Get all instances
     */
    public async getAllInstances(): Promise<any[]> {
        if (!this.instanceManager) {
            return [{
                id: 'unknown',
                hostname: 'unknown',
                connections: this.io.engine.clientsCount,
                uptime: 0
            }];
        }

        return await this.instanceManager.getAllInstances();
    }

    /**
     * Handle cross-instance events
     */
    public handleCrossInstanceEvent(event: string, data: any): void {
        this.logger.debug(`Received cross-instance event: ${event}`, {
            data: typeof data === 'object' ? JSON.stringify(data).substring(0, 100) : data
        });

        switch (event) {
            case 'instance:info':
                // Handle instance information update
                if (this.metrics && data.instanceId) {
                    this.metrics.instanceCount.set(data.instanceCount || 1);
                    this.metrics.instanceConnections.set({ instanceId: data.instanceId }, data.connections || 0);
                }
                break;

            case 'instance:load':
                // Handle instance load update
                if (this.metrics && data.instanceId) {
                    this.metrics.instanceLoad.set({ instanceId: data.instanceId }, data.loadScore || 0);
                    this.metrics.instanceCpuUsage.set({ instanceId: data.instanceId }, data.cpuUsage || 0);
                    this.metrics.instanceMemoryUsage.set({ instanceId: data.instanceId }, data.memoryUsage || 0);
                }
                break;

            default:
                // Unknown cross-instance event
                this.logger.debug(`Unknown cross-instance event: ${event}`);
                break;
        }
    }
}