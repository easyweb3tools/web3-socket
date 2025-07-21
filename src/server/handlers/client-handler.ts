import { Socket } from 'socket.io';
import { BaseEventHandler } from './base-handler';
import { v4 as uuidv4 } from 'uuid';
import { BackendService } from '../api/backend-service';

/**
 * Client event handler for handling client-to-server events
 */
export class ClientEventHandler extends BaseEventHandler {
    private backendService: BackendService;

    constructor(
        io: any,
        connectionManager: any,
        roomManager: any,
        logger: any,
        metrics?: any,
        backendService?: BackendService
    ) {
        super(io, connectionManager, roomManager, logger, metrics);

        // Use provided backend service or create a new one
        this.backendService = backendService || new BackendService(logger, {
            baseUrl: process.env.BACKEND_URL || 'http://localhost:8080',
            timeoutMs: parseInt(process.env.BACKEND_TIMEOUT_MS || '5000', 10),
            defaultHeaders: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.API_KEY || 'easyweb3.TOOLS'
            }
        });
    }

    /**
     * Register event listeners
     */
    public registerEvents(): void {
        // Register client event handlers
        this.registerEventHandler('client:event', this.handleClientEvent.bind(this));
        this.registerEventHandler('client:message', this.handleClientMessage.bind(this));
        this.registerEventHandler('client:action', this.handleClientAction.bind(this));
    }

    /**
     * Get the handler name
     */
    public getName(): string {
        return 'client-events';
    }

    /**
     * Handle generic client event
     */
    private async handleClientEvent(socket: Socket, data: any): Promise<void> {
        // Check authentication
        if (!this.isAuthenticated(socket)) {
            return;
        }

        // Update activity timestamp
        this.updateActivity(socket);

        const userId = this.getUserId(socket);

        // Validate data
        if (!data || !data.type) {
            socket.emit('error', {
                event: 'client:event',
                message: 'Invalid event data. Missing type.',
                code: 'INVALID_EVENT_DATA'
            });
            return;
        }

        try {
            // Generate request ID for tracking
            const requestId = uuidv4();

            this.logger.info(`Processing client:event from user ${userId}`, {
                eventType: data.type,
                requestId
            });

            // Forward to backend
            const response = await this.forwardToBackend('/api/events', {
                userId,
                socketId: socket.id,
                event: 'client:event',
                data,
                requestId,
                timestamp: new Date().toISOString()
            });

            // Send response to client
            socket.emit('server:response', {
                success: true,
                requestId,
                data: response.data
            });

            this.logger.debug(`Sent server:response to user ${userId}`, {
                requestId
            });
        } catch (error) {
            this.logger.error(`Error processing client:event from user ${userId}`, error as Error);

            socket.emit('server:response', {
                success: false,
                error: 'Failed to process event',
                code: 'EVENT_PROCESSING_ERROR'
            });
        }
    }

    /**
     * Handle client message
     */
    private async handleClientMessage(socket: Socket, data: any): Promise<void> {
        // Check authentication
        if (!this.isAuthenticated(socket)) {
            return;
        }

        // Update activity timestamp
        this.updateActivity(socket);

        const userId = this.getUserId(socket);

        // Validate data
        if (!data || !data.content) {
            socket.emit('error', {
                event: 'client:message',
                message: 'Invalid message data. Missing content.',
                code: 'INVALID_MESSAGE_DATA'
            });
            return;
        }

        try {
            // Generate request ID for tracking
            const requestId = uuidv4();

            this.logger.info(`Processing client:message from user ${userId}`, {
                messageType: data.type || 'text',
                requestId
            });

            // Forward to backend
            const response = await this.forwardToBackend('/api/messages', {
                userId,
                socketId: socket.id,
                event: 'client:message',
                message: data,
                requestId,
                timestamp: new Date().toISOString()
            });

            // Send response to client
            socket.emit('message:ack', {
                success: true,
                requestId,
                messageId: response.data.messageId || requestId
            });

            this.logger.debug(`Sent message:ack to user ${userId}`, {
                requestId
            });
        } catch (error) {
            this.logger.error(`Error processing client:message from user ${userId}`, error as Error);

            socket.emit('message:ack', {
                success: false,
                error: 'Failed to process message',
                code: 'MESSAGE_PROCESSING_ERROR'
            });
        }
    }

    /**
     * Handle client action
     */
    private async handleClientAction(socket: Socket, data: any): Promise<void> {
        // Check authentication
        if (!this.isAuthenticated(socket)) {
            return;
        }

        // Update activity timestamp
        this.updateActivity(socket);

        const userId = this.getUserId(socket);

        // Validate data
        if (!data || !data.action) {
            socket.emit('error', {
                event: 'client:action',
                message: 'Invalid action data. Missing action.',
                code: 'INVALID_ACTION_DATA'
            });
            return;
        }

        try {
            // Generate request ID for tracking
            const requestId = uuidv4();

            this.logger.info(`Processing client:action from user ${userId}`, {
                action: data.action,
                requestId
            });

            // Forward to backend
            const response = await this.forwardToBackend('/api/actions', {
                userId,
                socketId: socket.id,
                event: 'client:action',
                action: data,
                requestId,
                timestamp: new Date().toISOString()
            });

            // Send response to client
            socket.emit('action:result', {
                success: true,
                requestId,
                result: response.data
            });

            this.logger.debug(`Sent action:result to user ${userId}`, {
                requestId
            });
        } catch (error) {
            this.logger.error(`Error processing client:action from user ${userId}`, error as Error);

            socket.emit('action:result', {
                success: false,
                error: 'Failed to process action',
                code: 'ACTION_PROCESSING_ERROR'
            });
        }
    }

    /**
     * Forward data to backend
     */
    private async forwardToBackend(endpoint: string, data: any): Promise<any> {
        try {
            // Use the BackendService to make the request with retry and circuit breaker
            const response = await this.backendService.post(endpoint, data);
            return response;
        } catch (error) {
            this.logger.error(`Error forwarding to backend: ${endpoint}`, error as Error);
            throw error;
        }
    }
}