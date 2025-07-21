import { Server, Socket } from 'socket.io';
import { Logger } from '../logger';
import { ConnectionManager } from '../connection-manager';
import { RoomManager } from '../room-manager';
import { EventHandler } from './base-handler';
import { SystemEventHandler } from './system-handler';
import { Metrics } from '../metrics';
import { LoadManager } from '../utils/load-manager';

/**
 * Handler registry for managing event handlers
 */
export class HandlerRegistry {
    private handlers: Map<string, EventHandler> = new Map();
    private eventMap: Map<string, EventHandler> = new Map();
    private systemHandler: SystemEventHandler | null = null;

    constructor(
        private io: Server,
        private connectionManager: ConnectionManager,
        private roomManager: RoomManager,
        private logger: Logger,
        private metrics?: Metrics,
        private loadManager?: LoadManager
    ) { }

    /**
     * Register a handler
     */
    public registerHandler(handler: EventHandler): void {
        // Initialize the handler
        handler.initialize();

        // Register the handler
        const handlerName = handler.getName();
        this.handlers.set(handlerName, handler);

        // Store system handler separately for special handling
        if (handler instanceof SystemEventHandler) {
            this.systemHandler = handler;
        }

        // Map events to handlers
        const events = handler.getEvents();
        events.forEach(event => {
            if (this.eventMap.has(event)) {
                this.logger.warn(`Event ${event} already registered by handler ${this.eventMap.get(event)?.getName()}. Overriding with ${handlerName}.`);
            }

            this.eventMap.set(event, handler);
        });

        this.logger.info(`Registered handler: ${handlerName} for events: ${events.join(', ') || 'none'}`);
    }

    /**
     * Get a handler by name
     */
    public getHandler(name: string): EventHandler | undefined {
        return this.handlers.get(name);
    }

    /**
     * Get all registered handlers
     */
    public getAllHandlers(): EventHandler[] {
        return Array.from(this.handlers.values());
    }

    /**
     * Get handler for an event
     */
    public getHandlerForEvent(event: string): EventHandler | undefined {
        return this.eventMap.get(event);
    }

    /**
     * Handle an event
     */
    public async handleEvent(socket: Socket, event: string, data: any): Promise<void> {
        const handler = this.getHandlerForEvent(event);

        if (handler) {
            await handler.handleEvent(socket, event, data);
        } else {
            this.logger.warn(`No handler registered for event: ${event}`, {
                socketId: socket.id,
                userId: this.connectionManager.getUserId(socket.id)
            });

            // Record error in metrics if available
            if (this.metrics) {
                this.metrics.recordError('unhandled_event', new Error(`Unhandled event: ${event}`));
            }

            // Emit error to client
            socket.emit('error', {
                event,
                message: 'Unsupported event',
                code: 'UNSUPPORTED_EVENT'
            });
        }
    }

    /**
     * Setup connection handler
     */
    public setupConnectionHandler(): void {
        // Ensure we have a system handler
        if (!this.systemHandler) {
            this.logger.warn('No system handler registered. System events will not be handled properly.');
        }

        this.io.on('connection', (socket: Socket) => {
            // Check if connection should be allowed based on load
            if (this.loadManager && !this.loadManager.shouldAllowConnection()) {
                this.logger.warn('Connection rejected due to high load', {
                    socketId: socket.id,
                    ip: socket.handshake.address
                });

                // Send throttling message and disconnect
                socket.emit('system:throttled', {
                    message: 'Server is currently under high load. Please try again later.',
                    timestamp: new Date().toISOString()
                });

                // Disconnect after a short delay to allow the message to be sent
                setTimeout(() => {
                    socket.disconnect(true);
                }, 1000);

                return;
            }

            // Record connection in metrics if available
            if (this.metrics) {
                this.metrics.connectionRate.inc({
                    authenticated: 'false',
                    transport: socket.conn?.transport?.name || 'unknown'
                });
            }

            // Handle connection with system handler if available
            if (this.systemHandler) {
                this.systemHandler.handleConnection(socket)
                    .catch(error => {
                        this.logger.error('Error handling connection event', error as Error);

                        // Record error in metrics if available
                        if (this.metrics) {
                            this.metrics.recordError('connection_handler', error as Error);
                        }
                    });
            } else {
                this.logger.info(`New connection: ${socket.id}`, {
                    ip: socket.handshake.address,
                    userAgent: socket.handshake.headers['user-agent']?.toString().substring(0, 50)
                });
            }

            // Handle all registered events
            this.eventMap.forEach((handler, event) => {
                socket.on(event, (data: any) => {
                    this.handleEvent(socket, event, data)
                        .catch(error => {
                            this.logger.error(`Unhandled error in event handler: ${event}`, error as Error);

                            // Record error in metrics if available
                            if (this.metrics) {
                                this.metrics.recordError(`unhandled_error_${event}`, error as Error);
                            }
                        });
                });
            });

            // Handle disconnect
            socket.on('disconnect', (reason: string) => {
                // Record disconnection in metrics if available
                if (this.metrics) {
                    this.metrics.disconnectionRate.inc({ reason });
                }

                if (this.systemHandler) {
                    this.systemHandler.handleDisconnection(socket, reason)
                        .catch(error => {
                            this.logger.error('Error handling disconnection event', error as Error);

                            // Record error in metrics if available
                            if (this.metrics) {
                                this.metrics.recordError('disconnection_handler', error as Error);
                            }
                        });
                } else {
                    const userId = this.connectionManager.getUserId(socket.id);

                    if (userId) {
                        this.roomManager.removeFromAllRooms(socket);
                        this.connectionManager.removeUser(socket);
                    }

                    this.logger.info(`Socket disconnected: ${socket.id}`, { reason });
                }
            });

            // Handle errors
            socket.on('error', (error: Error) => {
                // Record error in metrics if available
                if (this.metrics) {
                    this.metrics.recordError('socket_error', error);
                }

                if (this.systemHandler) {
                    this.systemHandler.handleError(socket, error)
                        .catch(err => {
                            this.logger.error('Error handling socket error event', err as Error);

                            // Record error in metrics if available
                            if (this.metrics) {
                                this.metrics.recordError('error_handler', err as Error);
                            }
                        });
                } else {
                    this.logger.error(`Socket error: ${socket.id}`, error);
                }
            });

            // Handle reconnection attempts
            socket.on('reconnect_attempt', (attemptNumber: number) => {
                // Record reconnection attempt in metrics if available
                if (this.metrics) {
                    this.metrics.errorCounter.inc({
                        attempt: attemptNumber.toString(),
                        transport: socket.conn?.transport?.name || 'unknown'
                    });
                }

                if (this.systemHandler) {
                    this.systemHandler.handleReconnectAttempt(socket, attemptNumber)
                        .catch(error => {
                            this.logger.error('Error handling reconnect attempt event', error as Error);

                            // Record error in metrics if available
                            if (this.metrics) {
                                this.metrics.recordError('reconnect_attempt_handler', error as Error);
                            }
                        });
                }
            });

            // Handle successful reconnection
            socket.on('reconnect', (attemptNumber: number) => {
                // Record successful reconnection in metrics if available
                if (this.metrics) {
                    this.metrics.messageCounter.inc({
                        attempt: attemptNumber.toString(),
                        transport: socket.conn?.transport?.name || 'unknown'
                    });
                }

                // Store reconnection time for analytics
                socket.data.reconnectionTime = Date.now();

                if (this.systemHandler) {
                    this.systemHandler.handleReconnect(socket, attemptNumber)
                        .catch(error => {
                            this.logger.error('Error handling reconnect event', error as Error);

                            // Record error in metrics if available
                            if (this.metrics) {
                                this.metrics.recordError('reconnect_handler', error as Error);
                            }
                        });
                }
            });

            // Handle reconnection error
            socket.on('reconnect_error', (error: Error) => {
                // Record reconnection error in metrics if available
                if (this.metrics) {
                    this.metrics.recordError('reconnect_error', error);
                }

                this.logger.error('Reconnection error', error, {
                    socketId: socket.id,
                    userId: socket.data.userId || socket.data.previousUserId
                });
            });

            // Handle reconnection failed (all attempts failed)
            socket.on('reconnect_failed', () => {
                // Record reconnection failure in metrics if available
                if (this.metrics) {
                    this.metrics.errorCounter.inc({type: 'reconnection_failed'});
                }

                this.logger.warn('Reconnection failed after all attempts', {
                    socketId: socket.id,
                    userId: socket.data.userId || socket.data.previousUserId
                });

                // Notify client that all reconnection attempts failed
                socket.emit('system:reconnect_failed', {
                    message: 'All reconnection attempts failed',
                    timestamp: new Date().toISOString()
                });
            });
        });

        this.logger.info('Connection handler setup complete');
    }
}