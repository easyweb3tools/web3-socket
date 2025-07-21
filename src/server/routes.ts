import { Express, Request, Response, Router } from 'express';
import { Server } from 'socket.io';
import { ConnectionManager } from './connection-manager';
import { RoomManager } from './room-manager';
import { HandlerRegistry } from './handlers/handler-registry';
import { Logger } from './logger';
import { SystemEventHandler } from './handlers/system-handler';
import { PushAPI } from './api/push-api';
import { v4 as uuidv4 } from 'uuid';
import { createApiAuthMiddleware } from './middleware/api-auth';
import { createSanitizationMiddleware, createValidationMiddleware } from './middleware/validation';
import { body, param } from 'express-validator';
import { asyncHandler } from './errors/async-handler';
import { NotFoundError } from './errors/error-types';
import { AppError } from './errors/app-error';

export function setupRoutes(
    app: Express,
    io: Server,
    connectionManager: ConnectionManager,
    roomManager: RoomManager,
    handlerRegistry: HandlerRegistry,
    logger: Logger,
    authMiddleware: (req: Request, res: Response, next: Function) => void
): void {
    // Create enhanced API authentication middleware
    const apiAuthMiddleware = createApiAuthMiddleware(logger, {
        requireSigning: process.env.API_REQUIRE_SIGNING === 'true',
        maxRequestAge: parseInt(process.env.API_MAX_REQUEST_AGE || '300', 10),
        enableRateLimiting: process.env.API_RATE_LIMITING === 'true',
        maxRequestsPerWindow: parseInt(process.env.API_MAX_REQUESTS_PER_MINUTE || '100', 10)
    });

    // Create sanitization middleware
    const sanitizationMiddleware = createSanitizationMiddleware({
        removeHtml: true,
        maxLength: 50000 // 50KB max payload size
    }, logger);
    // Public routes (no authentication required)
    const publicRouter = Router();

    // Health check endpoint
    publicRouter.get('/health', (req: Request, res: Response) => {
        res.status(200).json({
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0'
        });
    });

    // Register public routes
    app.use(publicRouter);

    // Protected routes (authentication required)
    const apiRouter = Router();

    // Apply enhanced API authentication and sanitization middleware
    apiRouter.use(apiAuthMiddleware);
    apiRouter.use(sanitizationMiddleware);

    // Status endpoint
    apiRouter.get('/status', (req: Request, res: Response) => {
        const activeConnections = connectionManager.getActiveConnectionsCount();
        const rooms = roomManager.getAllRooms();
        const userConnections = connectionManager.getUserConnections();

        res.status(200).json({
            status: 'ok',
            activeConnections,
            uniqueUsers: userConnections.size,
            rooms: {
                total: rooms.length,
                user: rooms.filter(r => r.type === 'user').length,
                group: rooms.filter(r => r.type === 'group').length,
                system: rooms.filter(r => r.type === 'system').length
            },
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0'
        });
    });

    // Get active connections
    apiRouter.get('/connections', (req: Request, res: Response) => {
        const connections = connectionManager.getAllConnections();

        // Filter sensitive information
        const sanitizedConnections = connections.map(conn => ({
            userId: conn.userId,
            socketId: conn.socketId,
            connectedAt: conn.metadata.connectedAt,
            lastActivity: conn.metadata.lastActivity,
            ip: conn.metadata.ip?.split('.').slice(0, 2).join('.') + '.x.x', // Partial IP
            userAgent: conn.metadata.userAgent
        }));

        res.status(200).json({
            success: true,
            count: sanitizedConnections.length,
            connections: sanitizedConnections
        });
    });

    // Get rooms
    apiRouter.get('/rooms', (req: Request, res: Response) => {
        const rooms = roomManager.getAllRooms();

        // Filter and format room data
        const formattedRooms = rooms.map(room => ({
            name: room.name,
            type: room.type,
            memberCount: room.members.size,
            createdAt: room.createdAt
        }));

        res.status(200).json({
            success: true,
            count: formattedRooms.length,
            rooms: formattedRooms
        });
    });

    // Get room details
    apiRouter.get('/rooms/:roomName', asyncHandler(async (req: Request, res: Response) => {
        const { roomName } = req.params;
        const room = roomManager.getRoomDetails(roomName);

        if (!room) {
            throw new NotFoundError('Room not found', { roomName });
        }

        // Get member details
        const members = Array.from(room.members).map(socketId => {
            const connection = connectionManager.getConnectionDetails(socketId);
            return {
                socketId,
                userId: connection?.userId || 'unknown',
                connectedAt: connection?.metadata.connectedAt || null
            };
        });

        res.status(200).json({
            success: true,
            room: {
                name: room.name,
                type: room.type,
                memberCount: room.members.size,
                members,
                createdAt: room.createdAt,
                metadata: room.metadata || {}
            }
        });
    }));

    // Get logs endpoint
    apiRouter.get('/logs', (req: Request, res: Response) => {
        const count = parseInt(req.query.count as string) || 100;
        const level = req.query.level as string;
        const search = req.query.search as string;
        const startTime = req.query.startTime as string;
        const endTime = req.query.endTime as string;

        // Get recent logs from logger
        let logs = logger.getRecentLogs(count);

        // Filter by level if specified
        if (level && level !== 'all') {
            logs = logs.filter(log => log.level === level);
        }

        // Filter by search term if specified
        if (search) {
            logs = logs.filter(log =>
                log.message.toLowerCase().includes(search.toLowerCase()) ||
                JSON.stringify(log).toLowerCase().includes(search.toLowerCase())
            );
        }

        // Filter by time range if specified
        if (startTime || endTime) {
            logs = logs.filter(log => {
                const logTime = new Date(log.timestamp).getTime();
                const start = startTime ? new Date(startTime).getTime() : 0;
                const end = endTime ? new Date(endTime).getTime() : Date.now();
                return logTime >= start && logTime <= end;
            });
        }

        res.status(200).json({
            success: true,
            count: logs.length,
            logs
        });
    });

    // Get metrics in JSON format for dashboard
    apiRouter.get('/metrics', (req: Request, res: Response) => {
        const activeConnections = connectionManager.getActiveConnectionsCount();
        const userConnections = connectionManager.getUserConnections();
        const rooms = roomManager.getAllRooms();
        const memoryUsage = process.memoryUsage();

        // Calculate room statistics
        const roomsByType = {
            user: rooms.filter(r => r.type === 'user').length,
            group: rooms.filter(r => r.type === 'group').length,
            system: rooms.filter(r => r.type === 'system').length,
            other: rooms.filter(r => !['user', 'group', 'system'].includes(r.type)).length
        };

        // Mock some metrics data (in a real implementation, you'd collect these over time)
        const metricsData = {
            // Connection metrics
            activeConnections,
            uniqueUsers: userConnections.size,
            connectionRate: 0, // Would be calculated from historical data
            disconnectionRate: 0, // Would be calculated from historical data

            // Room metrics
            roomCount: rooms.length,
            roomsByType,

            // Message metrics (mock data - in real implementation, collect from metrics)
            messagesPerSecond: 0,
            messagesByType: {},
            averageMessageSize: 0,
            averageLatency: 0,

            // Error metrics (mock data)
            errorRate: 0,
            errorsByType: {},

            // System metrics
            cpuUsage: process.cpuUsage ? (process.cpuUsage().user / 1000000) : 0,
            memoryUsage: {
                heapTotal: memoryUsage.heapTotal,
                heapUsed: memoryUsage.heapUsed,
                rss: memoryUsage.rss,
                external: memoryUsage.external
            },
            eventLoopLag: 0, // Would be measured

            // HTTP metrics (mock data)
            httpRequestRate: 0,
            httpResponseTime: 0,
            httpStatusCodes: {},

            // Historical data (mock - in real implementation, store historical data)
            history: {
                timestamps: [],
                connections: [],
                messages: [],
                errors: [],
                latency: []
            }
        };

        res.status(200).json(metricsData);
    });

    // Create Push API instance
    const pushAPI = new PushAPI(io, connectionManager, roomManager, logger);

    // Push message to user endpoint
    apiRouter.post('/push',
        createValidationMiddleware([
            body('userId').isString().notEmpty().withMessage('userId is required and must be a string'),
            body('event').isString().notEmpty().withMessage('event is required and must be a string'),
            body('payload').isObject().notEmpty().withMessage('payload is required and must be an object'),
            body('volatile').optional().isBoolean().withMessage('volatile must be a boolean if provided')
        ], logger),
        asyncHandler(async (req: Request, res: Response) => {
            await pushAPI.pushToUser(req, res);
        })
    );

    // Push message to multiple users endpoint
    apiRouter.post('/push/users',
        createValidationMiddleware([
            body('userIds').isArray().notEmpty().withMessage('userIds is required and must be an array'),
            body('userIds.*').isString().notEmpty().withMessage('Each userId must be a non-empty string'),
            body('event').isString().notEmpty().withMessage('event is required and must be a string'),
            body('payload').isObject().notEmpty().withMessage('payload is required and must be an object'),
            body('volatile').optional().isBoolean().withMessage('volatile must be a boolean if provided')
        ], logger),
        asyncHandler(async (req: Request, res: Response) => {
            await pushAPI.pushToUsers(req, res);
        })
    );

    // Broadcast to room endpoint
    apiRouter.post('/broadcast',
        createValidationMiddleware([
            body('room').isString().notEmpty().withMessage('room is required and must be a string'),
            body('event').isString().notEmpty().withMessage('event is required and must be a string'),
            body('payload').isObject().notEmpty().withMessage('payload is required and must be an object'),
            body('volatile').optional().isBoolean().withMessage('volatile must be a boolean if provided')
        ], logger),
        asyncHandler(async (req: Request, res: Response) => {
            await pushAPI.broadcastToRoom(req, res);
        })
    );

    // Broadcast to all clients endpoint
    apiRouter.post('/broadcast/all',
        createValidationMiddleware([
            body('event').isString().notEmpty().withMessage('event is required and must be a string'),
            body('payload').isObject().notEmpty().withMessage('payload is required and must be an object'),
            body('volatile').optional().isBoolean().withMessage('volatile must be a boolean if provided')
        ], logger),
        asyncHandler(async (req: Request, res: Response) => {
            await pushAPI.broadcastToAll(req, res);
        })
    );

    // System notification endpoint
    apiRouter.post('/notify',
        createValidationMiddleware([
            body('userId').isString().notEmpty().withMessage('userId is required and must be a string'),
            body('title').isString().notEmpty().withMessage('title is required and must be a string'),
            body('message').isString().notEmpty().withMessage('message is required and must be a string'),
            body('type').optional().isIn(['info', 'warning', 'error']).withMessage('type must be one of: info, warning, error')
        ], logger),
        asyncHandler(async (req: Request, res: Response) => {
            const { userId, title, message, type = 'info' } = req.body;

            // Get system handler
            const systemHandler = handlerRegistry.getHandler('system') as SystemEventHandler;

            if (!systemHandler) {
                throw new AppError(
                    'System handler not available',
                    500,
                    'SYSTEM_HANDLER_UNAVAILABLE',
                    false
                );
            }

            // Send notification
            systemHandler.sendSystemNotification(userId, title, message, type as any);

            return res.status(200).json({
                success: true,
                requestId: req.requestId
            });
        })
    );

    // Register API routes
    app.use('/api', apiRouter);
}