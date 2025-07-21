/**
 * Integration test setup
 * This file sets up the test environment for integration tests
 */
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { setupLogger } from '../server/logger';
import { ConnectionManager } from '../server/connection-manager';
import { RoomManager } from '../server/room-manager';
import { setupEventHandlers } from '../server/handlers';
import { setupRoutes } from '../server/routes';
import { createSocketAuthMiddleware } from '../server/middleware/socket-auth';
import { createApiAuthMiddleware } from '../server/middleware/api-auth';
import { LoadManager } from '../server/utils/load-manager';
import { setupMetrics } from '../server/metrics';
import jwt from 'jsonwebtoken';

// Load environment variables from .env.test file
dotenv.config({ path: '.env.test' });

// Test server configuration
const TEST_PORT = parseInt(process.env.TEST_PORT || '3001', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
const API_KEY = process.env.API_KEY || 'test_api_key';

/**
 * Create a test server for integration tests
 */
export async function createTestServer() {
    // Initialize logger
    const logger = setupLogger();

    // Create Express app
    const app = express();
    app.use(express.json());

    // Create HTTP server
    const httpServer = createServer(app);

    // Create Socket.IO server
    const io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    // Create Socket.IO authentication middleware
    const socketAuthMiddleware = createSocketAuthMiddleware(logger);

    // Apply Socket.IO middleware for authentication
    io.use(socketAuthMiddleware);

    // Initialize managers
    const connectionManager = new ConnectionManager(io, logger);
    const roomManager = new RoomManager(io, logger);

    // Initialize load manager
    const loadManager = new LoadManager(logger, () => connectionManager.getActiveConnectionsCount());

    // Setup metrics
    const metrics = setupMetrics(app, io, connectionManager, roomManager, logger);

    // Setup event handlers
    const handlerRegistry = setupEventHandlers(io, connectionManager, roomManager, logger, metrics, loadManager);

    // Create API auth middleware
    const apiAuthMiddleware = createApiAuthMiddleware(logger, {
        requireSigning: false
    });

    // Setup API routes
    setupRoutes(app, io, connectionManager, roomManager, handlerRegistry, logger, apiAuthMiddleware);

    // Start server
    await new Promise<void>((resolve) => {
        httpServer.listen(TEST_PORT, () => {
            logger.info(`Test server started on port ${TEST_PORT}`);
            resolve();
        });
    });

    return {
        httpServer,
        io,
        app,
        connectionManager,
        roomManager,
        handlerRegistry,
        logger,
        metrics,
        loadManager,
        close: async () => {
            return new Promise<void>((resolve) => {
                httpServer.close(() => {
                    logger.info('Test server closed');
                    resolve();
                });
            });
        }
    };
}

/**
 * Create a test client for integration tests
 */
export function createTestClient(options: {
    autoConnect?: boolean;
    auth?: {
        userId: string;
        [key: string]: any;
    };
} = {}) {
    const clientOptions: any = {
        autoConnect: options.autoConnect !== false,
        transports: ['websocket'],
        forceNew: true
    };

    // Add authentication if provided
    if (options.auth) {
        const token = jwt.sign(
            { userId: options.auth.userId, ...options.auth },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        clientOptions.auth = { token };
    }

    // Create client
    const client = ioc(`http://localhost:${TEST_PORT}`, clientOptions);

    return client;
}

/**
 * Wait for an event to be emitted
 */
export function waitForEvent(socket: ClientSocket, event: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for event: ${event}`));
        }, timeout);

        socket.once(event, (data) => {
            clearTimeout(timer);
            resolve(data);
        });
    });
}

/**
 * Wait for a specified time
 */
export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create an API request with authentication
 */
export function createAuthenticatedRequest(method: string, path: string, data?: any) {
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).substring(2, 15);

    return {
        method,
        path,
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
            'X-Request-Timestamp': timestamp.toString(),
            'X-Request-Nonce': nonce
        },
        data
    };
}