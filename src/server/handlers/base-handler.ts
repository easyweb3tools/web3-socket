import { Server, Socket } from 'socket.io';
import { Logger } from '../logger';
import { ConnectionManager } from '../connection-manager';
import { RoomManager } from '../room-manager';
import { Metrics } from '../metrics';
import { SocketEventError } from '../errors/error-types';
import { AppError } from '../errors/app-error';

/**
 * Event handler interface
 */
export interface EventHandler {
    /**
     * Initialize the handler
     */
    initialize(): void;

    /**
     * Register event listeners
     */
    registerEvents(): void;

    /**
     * Handle a specific event
     */
    handleEvent(socket: Socket, eventName: string, data: any): Promise<void>;

    /**
     * Get the events this handler manages
     */
    getEvents(): string[];

    /**
     * Get the handler name
     */
    getName(): string;
}

/**
 * Base event handler abstract class
 */
export abstract class BaseEventHandler implements EventHandler {
    protected events: Map<string, (socket: Socket, data: any) => Promise<void>> = new Map();

    constructor(
        protected io: Server,
        protected connectionManager: ConnectionManager,
        protected roomManager: RoomManager,
        protected logger: Logger,
        protected metrics?: Metrics
    ) { }

    /**
     * Initialize the handler
     */
    public initialize(): void {
        this.registerEvents();
        this.logger.info(`Initialized event handler: ${this.getName()}`);
    }

    /**
     * Register event listeners
     */
    public abstract registerEvents(): void;

    /**
     * Handle a specific event
     */
    public async handleEvent(socket: Socket, eventName: string, data: any): Promise<void> {
        const handler = this.events.get(eventName);

        if (handler) {
            try {
                // Record metrics if available
                let startTime: number | undefined;
                if (this.metrics) {
                    startTime = Date.now();
                    this.metrics.incrementMessageCounter('incoming', eventName);

                    // Estimate message size
                    try {
                        const size = JSON.stringify(data).length;
                        this.metrics.recordMessageSize(eventName, size);
                    } catch (e) {
                        // Ignore serialization errors
                    }
                }

                // Handle the event
                await handler(socket, data);

                // Record latency if metrics are available
                if (this.metrics && startTime) {
                    const latency = (Date.now() - startTime) / 1000;
                    this.metrics.observeMessageLatency(eventName, latency);
                }
            } catch (error) {
                // Determine if this is an AppError or a regular Error
                const appError = error instanceof AppError
                    ? error
                    : new SocketEventError(
                        (error as Error).message || 'Unknown error processing event',
                        { eventName, socketId: socket.id },
                        error as Error
                    );

                this.logger.error(`Error handling event ${eventName}`, error as Error, {
                    socketId: socket.id,
                    userId: this.connectionManager.getUserId(socket.id),
                    errorCode: appError.code,
                    isOperational: appError.isOperational
                });

                // Record error in metrics if available
                if (this.metrics) {
                    this.metrics.recordError(`event_handler_${eventName}`, error as Error);
                }

                // Send structured error to client
                socket.emit('error', {
                    event: eventName,
                    message: appError.message,
                    code: appError.code,
                    ...(appError.details ? { details: appError.details } : {})
                });
            }
        } else {
            this.logger.warn(`No handler found for event: ${eventName}`, {
                socketId: socket.id,
                userId: this.connectionManager.getUserId(socket.id)
            });
        }
    }

    /**
     * Get the events this handler manages
     */
    public getEvents(): string[] {
        return Array.from(this.events.keys());
    }

    /**
     * Get the handler name
     */
    public abstract getName(): string;

    /**
     * Register a handler for an event
     */
    protected registerEventHandler(
        eventName: string,
        handler: (socket: Socket, data: any) => Promise<void>
    ): void {
        this.events.set(eventName, handler);
        this.logger.debug(`Registered handler for event: ${eventName}`);
    }

    /**
     * Check if a socket is authenticated
     */
    protected isAuthenticated(socket: Socket): boolean {
        const isAuth = this.connectionManager.isAuthenticated(socket);

        if (!isAuth) {
            socket.emit('error', {
                message: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED'
            });
        }

        return isAuth;
    }

    /**
     * Get user ID for a socket
     */
    protected getUserId(socket: Socket): string | null {
        return this.connectionManager.getUserId(socket.id);
    }

    /**
     * Update user activity
     */
    protected updateActivity(socket: Socket): void {
        this.connectionManager.updateActivity(socket.id);
    }

    /**
     * Record outgoing message in metrics
     */
    protected recordOutgoingMessage(event: string, payload: any): void {
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
}