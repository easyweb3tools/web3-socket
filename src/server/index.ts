import dotenv from 'dotenv';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { setupLogger } from './logger';
import { setupMetrics, Metrics } from './metrics';
import { ConnectionManager } from './connection-manager';
import { RoomManager } from './room-manager';
import { setupEventHandlers } from './handlers';
import { setupRoutes } from './routes';
import { createAuthMiddleware } from './middleware/auth';
import { createSocketAuthMiddleware } from './middleware/socket-auth';
import { createApiAuthMiddleware } from './middleware/api-auth';
import { createSanitizationMiddleware } from './middleware/validation';
import { AppError } from './errors/app-error';
import { LoadManager } from './utils/load-manager';
import { createRedisAdapter } from './adapters/redis-adapter';
import { InstanceManager } from './utils/instance-manager';
import { initializeBackendService } from './api';
import { EventLoopOptimizer } from './utils/event-loop-optimizer';
import { MessageBatchManager } from './utils/message-batcher';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = setupLogger();

// Ensure console logging for startup debugging
console.log('🚀 Starting web3-socket server...');
console.log('Node version:', process.version);
console.log('Process ID:', process.pid);

// Enhanced startup logging
logger.info('🚀 Starting web3-socket server...');

// Log environment variables for debugging
logger.info('=== Environment Variables Loaded ===', {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    REDIS_ENABLED: process.env.REDIS_ENABLED,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    // REDIS_PASSWORD: process.env.REDIS_PASSWORD ? '[MASKED]' : 'NOT_SET',
    REDIS_URL: process.env.REDIS_URL ? process.env.REDIS_URL : 'NOT_SET',
    JWT_SECRET: process.env.JWT_SECRET ? '[MASKED]' : 'NOT_SET',
    API_KEY: process.env.API_KEY ? '[MASKED]' : 'NOT_SET',
    BACKEND_URL: process.env.BACKEND_URL,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    LOG_LEVEL: process.env.LOG_LEVEL
});

// Log process info
logger.info('Process information', {
    pid: process.pid,
    ppid: process.ppid,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    cwd: process.cwd()
});

async function startServer() {
    try {
        logger.info('📦 Starting server initialization...');

        // Create Express app
        const app = express();

        // Apply basic middleware
        app.use(cors({
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST'],
            credentials: true
        }));
        app.use(helmet());
        app.use(express.json({ limit: '1mb' }));
        app.use(express.urlencoded({ extended: true }));

        // Create HTTP server
        const httpServer = createServer(app);

        // Create Socket.IO server
        const io = new Server(httpServer, {
            path: process.env.SOCKET_PATH || '/socket.io',
            cors: {
                origin: process.env.CORS_ORIGIN || '*',
                methods: ['GET', 'POST'],
                credentials: true
            },
            pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT || '10000', 10),
            pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL || '25000', 10)
        });

        // Setup Redis adapter if enabled
        if (process.env.REDIS_ENABLED === 'true') {
            try {
                logger.info('🔧 Configuring Redis adapter...');
                const redisConfig = {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379', 10),
                    // password: process.env.REDIS_PASSWORD || 'easyweb3.TOOLS',
                    db: parseInt(process.env.REDIS_DB || '0', 10),
                    prefix: process.env.REDIS_PREFIX || 'socket.io',
                    url: process.env.REDIS_URL || 'redis://localhost:6379',
                    tls: process.env.REDIS_TLS === 'true',
                    enableStateSharing: process.env.REDIS_STATE_SHARING !== 'false',
                    stateSharing: {
                        keyPrefix: `${process.env.REDIS_PREFIX || 'socket.io'}:state`,
                        stateTtl: parseInt(process.env.REDIS_STATE_TTL || '86400', 10),
                        syncIntervalMs: parseInt(process.env.REDIS_STATE_SYNC_INTERVAL || '30000', 10)
                    }
                };
                logger.info('Redis adapter configuration', redisConfig);
                await createRedisAdapter(io, logger, redisConfig);
                logger.info('✅ Redis adapter initialized successfully');
            } catch (error) {
                logger.error('❌ Failed to initialize Redis adapter', error as Error);
                logger.error('Redis connection failed - check if Redis is running and accessible');
                logger.error('Make sure Redis is accessible at:' + JSON.stringify({
                    host: process.env.REDIS_HOST,
                    port: process.env.REDIS_PORT,
                    passwordSet: !!process.env.REDIS_PASSWORD,
                    url: process.env.REDIS_URL
                }));
                throw error; // Re-throw to prevent startup
            }
        } else {
            logger.info('⚠️ Redis adapter disabled');
        }

        // Create Socket.IO authentication middleware
        const socketAuthMiddleware = createSocketAuthMiddleware(logger);

        // Apply Socket.IO middleware for authentication
        io.use(socketAuthMiddleware);

        // Initialize managers
        const connectionManager = new ConnectionManager(io, logger);
        const roomManager = new RoomManager(io, logger);

        // Initialize instance manager for horizontal scaling
        const instanceManager = new InstanceManager(io, logger, {
            instanceId: process.env.INSTANCE_ID || '0',
            groupName: process.env.INSTANCE_GROUP || 'default',
            enableLoadBalancing: process.env.ENABLE_LOAD_BALANCING !== 'false',
            loadBalancing: {
                maxConnectionsPerInstance: parseInt(process.env.MAX_CONNECTIONS_PER_INSTANCE || '10000', 10),
                reportLoad: process.env.REPORT_INSTANCE_LOAD !== 'false',
                reportIntervalMs: parseInt(process.env.LOAD_REPORT_INTERVAL || '10000', 10)
            }
        });

        // Start instance manager
        instanceManager.start();

        // Initialize backend service with Redis support for distributed retries
        let redisClient: any;
        if (process.env.REDIS_ENABLED === 'true' && process.env.BACKEND_USE_DISTRIBUTED_RETRIES === 'true') {
            try {
                // Create Redis client for backend service
                const { createClient } = require('redis');
                redisClient = createClient({
                    url: process.env.REDIS_URL || 'redis://localhost:6379',
                    // socket: {
                    //     host: process.env.REDIS_HOST || 'localhost',
                    //     port: parseInt(process.env.REDIS_PORT || '6379', 10),
                    //     tls: process.env.REDIS_TLS === 'true'
                    // },
                    // password: process.env.REDIS_PASSWORD || 'easyweb3.TOOLS',
                    database: parseInt(process.env.REDIS_DB || '0', 10)
                });

                await redisClient.connect();
                logger.info('Redis client connected for backend service distributed retries');
            } catch (error) {
                logger.error('Failed to initialize Redis client for backend service', error as Error);
                logger.warn('Continuing without distributed retries for backend service');
                redisClient = undefined;
            }
        }

        // Initialize backend service
        const backendService = initializeBackendService(
            logger,
            redisClient,
            instanceManager.getInstanceId()
        );

        // Initialize event loop optimizer
        const eventLoopOptimizer = new EventLoopOptimizer(logger, {
            checkIntervalMs: parseInt(process.env.EVENT_LOOP_CHECK_INTERVAL || '5000', 10),
            highLagThresholdMs: parseInt(process.env.EVENT_LOOP_HIGH_LAG_THRESHOLD || '100', 10),
            criticalLagThresholdMs: parseInt(process.env.EVENT_LOOP_CRITICAL_LAG_THRESHOLD || '500', 10),
            enableAutoOptimization: process.env.EVENT_LOOP_AUTO_OPTIMIZATION !== 'false',
            onHighLag: (lag) => {
                logger.warn(`High event loop lag detected: ${lag}ms`);
                if (metrics) {
                    metrics.eventLoopLag.set(lag / 1000); // Convert to seconds for metrics
                }
            },
            onCriticalLag: (lag) => {
                logger.error(`Critical event loop lag detected: ${lag}ms`);
                if (metrics) {
                    metrics.eventLoopLag.set(lag / 1000); // Convert to seconds for metrics
                }
            }
        });

        // Start event loop optimizer
        eventLoopOptimizer.start();

        // Initialize message batch manager for optimizing message delivery
        const messageBatchManager = new MessageBatchManager({
            maxBatchSize: parseInt(process.env.MESSAGE_BATCH_SIZE || '100', 10),
            maxDelayMs: parseInt(process.env.MESSAGE_BATCH_DELAY || '50', 10),
            maxPayloadBytes: parseInt(process.env.MESSAGE_BATCH_MAX_PAYLOAD || '1048576', 10), // 1MB
            enableCompression: process.env.MESSAGE_BATCH_COMPRESSION !== 'false'
        });

        logger.info('Performance optimizations initialized', {
            eventLoopMonitoring: true,
            messageBatching: true,
            connectionPooling: true
        });

        // Initialize load manager
        const loadManager = new LoadManager(
            logger,
            () => connectionManager.getActiveConnectionsCount(),
            {
                enableAutoThrottling: process.env.ENABLE_AUTO_THROTTLING !== 'false',
                checkIntervalMs: parseInt(process.env.LOAD_CHECK_INTERVAL || '10000', 10),
                maxConnectionsUnderLoad: parseInt(process.env.MAX_CONNECTIONS_UNDER_LOAD || '1000', 10),
                maxMessageRateUnderLoad: parseInt(process.env.MAX_MESSAGE_RATE_UNDER_LOAD || '100', 10),
                thresholds: {
                    connections: {
                        elevated: parseInt(process.env.CONNECTIONS_THRESHOLD_ELEVATED || '1000', 10),
                        high: parseInt(process.env.CONNECTIONS_THRESHOLD_HIGH || '5000', 10),
                        critical: parseInt(process.env.CONNECTIONS_THRESHOLD_CRITICAL || '10000', 10)
                    }
                }
            }
        );

        // Start load monitoring
        loadManager.start();

        // Log load level changes
        loadManager.on('loadLevelChanged', (state) => {
            logger.info(`Load level changed to ${state.level}`, {
                cpuUsage: Math.round(state.cpuUsage),
                memoryUsage: Math.round(state.memoryUsage),
                connectionCount: state.connectionCount,
                eventLoopLag: Math.round(state.eventLoopLag)
            });
        });

        // Log throttling changes
        loadManager.on('throttlingChanged', (throttling) => {
            logger.info('Throttling settings changed', throttling);
        });

        // Create auth middleware (used in setupRoutes)
        const authMiddleware = createAuthMiddleware(logger);

        // Setup metrics
        let metrics: Metrics | undefined;
        if (process.env.METRICS_ENABLED === 'true') {
            metrics = setupMetrics(app, io, connectionManager, roomManager, logger);
            logger.info('Metrics collection enabled');
        }

        // Setup event handlers
        const handlerRegistry = setupEventHandlers(io, connectionManager, roomManager, logger, metrics, loadManager, backendService);

        // Connect instance manager to system handler
        const systemHandler = handlerRegistry.getHandler('system') as any;
        if (systemHandler && systemHandler.setInstanceManager) {
            systemHandler.setInstanceManager(instanceManager);
            logger.info('Connected instance manager to system handler');
        }

        // Add request logging middleware with metrics
        app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
            const start = Date.now();
            const path = req.path;
            const method = req.method;

            res.on('finish', () => {
                const duration = Date.now() - start;
                const statusCode = res.statusCode;

                logger.debug(`${method} ${path} ${statusCode} ${duration}ms`, {
                    method,
                    path,
                    statusCode,
                    duration,
                    ip: req.ip
                });

                // Record metrics if enabled
                if (metrics) {
                    // Normalize route path for metrics to avoid cardinality explosion
                    const route = path.startsWith('/api/')
                        ? path.replace(/\/api\/[^\/]+\/[0-9a-f-]+/, '/api/:resource/:id')
                        : path;

                    metrics.recordHttpRequest(method, route, statusCode, duration / 1000);
                }
            });

            next();
        });

        // Create enhanced API security middleware (used in setupRoutes)
        const apiAuthMiddleware = createApiAuthMiddleware(logger, {
            requireSigning: process.env.API_REQUIRE_SIGNING === 'true',
            maxRequestAge: parseInt(process.env.API_MAX_REQUEST_AGE || '300', 10),
            enableRateLimiting: process.env.API_RATE_LIMITING === 'true',
            maxRequestsPerWindow: parseInt(process.env.API_MAX_REQUESTS_PER_MINUTE || '100', 10)
        });

        // Create sanitization middleware (used in setupRoutes)
        const sanitizationMiddleware = createSanitizationMiddleware({
            removeHtml: true,
            maxLength: 50000 // 50KB max payload size
        }, logger);

        // Setup API routes
        setupRoutes(app, io, connectionManager, roomManager, handlerRegistry, logger, apiAuthMiddleware);

        // Add error handling middleware
        app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
            // Check if this is an AppError
            if (err instanceof AppError) {
                logger.error(`Express error: ${err.message}`, err, {
                    path: req.path,
                    method: req.method,
                    code: err.code,
                    statusCode: err.statusCode,
                    isOperational: err.isOperational,
                    requestId: req.requestId
                });

                // Record error in metrics
                if (metrics) {
                    metrics.recordError(`express_${err.code.toLowerCase()}`, err);
                }

                // Send structured error response
                return res.status(err.statusCode).json(err.toResponse(req.requestId));
            }

            // Handle unknown errors
            logger.error('Express error', err, {
                path: req.path,
                method: req.method,
                requestId: req.requestId
            });

            // Record error in metrics
            if (metrics) {
                metrics.recordError('express_unknown', err);
            }

            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR',
                requestId: req.requestId
            });
        });

        // Health check endpoint
        app.get('/health', (req: express.Request, res: express.Response) => {
            const health = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                pid: process.pid,
                memory: process.memoryUsage(),
                environment: process.env.NODE_ENV,
                redis: {
                    enabled: process.env.REDIS_ENABLED === 'true',
                    host: process.env.REDIS_HOST,
                    port: process.env.REDIS_PORT
                }
            };
            logger.debug('Health check requested', health);
            res.json(health);
        });

        // Handle 404 errors
        app.use((req: express.Request, res: express.Response) => {
            logger.debug(`Route not found: ${req.method} ${req.path}`);
            res.status(404).json({
                success: false,
                error: 'Not found',
                code: 'NOT_FOUND'
            });
        });

        // Start server
        const PORT = process.env.PORT || 8081;
        logger.info(`🌐 Starting HTTP server on port ${PORT}...`);
        httpServer.listen(PORT, () => {
            logger.info(`✅ Server started successfully on port ${PORT}`, {
                port: PORT,
                environment: process.env.NODE_ENV || 'development',
                socketPath: process.env.SOCKET_PATH || '/socket.io',
                metricsEnabled: !!metrics
            });
        });

        logger.info('🏁 Server initialization complete');

        // Handle graceful shutdown
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received, shutting down gracefully');
            httpServer.close(() => {
                logger.info('HTTP server closed');
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            logger.info('SIGINT received, shutting down gracefully');
            httpServer.close(() => {
                logger.info('HTTP server closed');
                process.exit(0);
            });
        });

        process.on('uncaughtException', (err) => {
            logger.error('Uncaught exception', err);

            // Record error in metrics
            if (metrics) {
                metrics.recordError('uncaught_exception', err);
            }

            process.exit(1);
        });

        process.on('unhandledRejection', (reason) => {
            logger.error('Unhandled rejection', reason as Error);

            // Record error in metrics
            if (metrics) {
                metrics.recordError('unhandled_rejection', reason as Error);
            }
        });

    } catch (error) {
        console.error('❌ Failed to start server - CRITICAL ERROR:', error);
        console.error('Stack trace:', (error as Error).stack);
        console.error('Server will exit...');

        // Force immediate exit
        process.exit(1);
    }
}

// Start the server
logger.info('🔄 Starting server process...');
startServer().catch((error: Error) => {
    logger.error('❌ Unhandled error in startServer', error);
    process.exit(1);
});