/**
 * Redis adapter for Socket.IO
 * This adapter enables horizontal scaling of Socket.IO across multiple instances
 * by providing cross-instance messaging and connection state sharing
 */
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import { Logger } from '../logger';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

/**
 * Redis adapter options
 */
export interface RedisAdapterOptions {
    /**
     * Redis host
     */
    host?: string;

    /**
     * Redis port
     */
    port?: number;

    /**
     * Redis password
     */
    password?: string;

    /**
     * Redis database index
     */
    db?: number;

    /**
     * Redis URL (alternative to host/port/password)
     */
    url?: string;

    /**
     * Prefix for Redis keys
     */
    prefix?: string;

    /**
     * Whether to enable TLS
     */
    tls?: boolean;

    /**
     * Connection timeout in milliseconds
     */
    connectionTimeoutMs?: number;

    /**
     * Retry strategy options
     */
    retry?: {
        /**
         * Maximum number of retry attempts
         */
        maxRetries?: number;

        /**
         * Initial delay in milliseconds
         */
        initialDelayMs?: number;

        /**
         * Maximum delay in milliseconds
         */
        maxDelayMs?: number;
    };

    /**
     * Enable connection state sharing
     */
    enableStateSharing?: boolean;

    /**
     * State sharing options
     */
    stateSharing?: {
        /**
         * Key prefix for state sharing
         */
        keyPrefix?: string;

        /**
         * TTL for state entries in seconds
         */
        stateTtl?: number;

        /**
         * Interval for state synchronization in milliseconds
         */
        syncIntervalMs?: number;
    };
}

/**
 * Default Redis adapter options
 */
const DEFAULT_OPTIONS: RedisAdapterOptions = {
    host: 'localhost',
    port: 6379,
    prefix: 'socket.io',
    connectionTimeoutMs: 10000,
    retry: {
        maxRetries: 10,
        initialDelayMs: 100,
        maxDelayMs: 10000
    },
    enableStateSharing: true,
    stateSharing: {
        keyPrefix: 'socket.io:state',
        stateTtl: 86400, // 24 hours
        syncIntervalMs: 30000 // 30 seconds
    }
};

/**
 * Instance information for cross-instance communication
 */
export interface InstanceInfo {
    id: string;
    hostname: string;
    pid: number;
    startTime: number;
    connections: number;
    uptime: number;
    lastHeartbeat: number;
}

/**
 * Connection state for sharing across instances
 */
export interface ConnectionState {
    socketId: string;
    userId: string;
    rooms: string[];
    data: Record<string, any>;
    instanceId: string;
    lastUpdated: number;
}

/**
 * Create a Redis adapter for Socket.IO
 * 
 * @param io Socket.IO server instance
 * @param logger Logger instance
 * @param options Redis adapter options
 * @returns Promise that resolves when the adapter is ready
 */
export async function createRedisAdapter(
    io: Server,
    logger: Logger,
    options: RedisAdapterOptions = {}
): Promise<void> {
    // Create module logger
    const moduleLogger = logger.child({ module: 'RedisAdapter' });

    // Merge options with defaults
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Generate a unique instance ID
    const instanceId = uuidv4();

    // Create instance info
    const instanceInfo: InstanceInfo = {
        id: instanceId,
        hostname: os.hostname(),
        pid: process.pid,
        startTime: Date.now(),
        connections: 0,
        uptime: 0,
        lastHeartbeat: Date.now()
    };

    try {
        moduleLogger.info('Starting Redis adapter initialization...', {
            instanceId,
            host: opts.host,
            port: opts.port,
            url: opts.url ? '[redacted]' : undefined,
            enableStateSharing: opts.enableStateSharing
        });

        // Create Redis clients
        moduleLogger.info('Creating Redis clients...');
        const pubClient = createClient(getRedisClientOptions(opts));
        const subClient = pubClient.duplicate();

        // Create a separate client for state management if enabled
        let stateClient: ReturnType<typeof createClient> | null = null;
        if (opts.enableStateSharing) {
            stateClient = createClient(getRedisClientOptions(opts));

            stateClient.on('connect', () => {
                moduleLogger.info('Redis state client connected');
            });

            stateClient.on('error', (err) => {
                moduleLogger.error('Redis state client error', err);
            });
        }

        // Handle connection events
        pubClient.on('connect', () => {
            moduleLogger.info('Redis publisher connected');
        });

        pubClient.on('error', (err) => {
            moduleLogger.error('Redis publisher error', err);
        });

        subClient.on('connect', () => {
            moduleLogger.info('Redis subscriber connected');
        });

        subClient.on('error', (err) => {
            moduleLogger.error('Redis subscriber error', err);
        });

        // Connect to Redis
        moduleLogger.info('Connecting to Redis', {
            host: opts.host,
            port: opts.port,
            url: opts.url ? '[redacted]' : undefined
        });

        try {
            const connectPromises = [
                pubClient.connect().then(() => moduleLogger.info('Redis publisher connected successfully')),
                subClient.connect().then(() => moduleLogger.info('Redis subscriber connected successfully'))
            ];

            if (stateClient) {
                connectPromises.push(stateClient.connect().then(() => moduleLogger.info('Redis state client connected successfully')));
            }

            await Promise.all(connectPromises);
            moduleLogger.info('All Redis clients connected successfully');
        } catch (error) {
            moduleLogger.error('Failed to connect to Redis', error as Error);
            throw error;
        }

        // Create and set adapter
        const adapter = createAdapter(pubClient, subClient, {
            key: opts.prefix
        });

        io.adapter(adapter);

        // Register instance in Redis
        if (stateClient) {
            const instanceKey = `${opts.stateSharing?.keyPrefix}:instances:${instanceId}`;
            await stateClient.hSet(instanceKey, {
                hostname: instanceInfo.hostname,
                pid: instanceInfo.pid.toString(),
                startTime: instanceInfo.startTime.toString(),
                connections: '0',
                uptime: '0',
                lastHeartbeat: instanceInfo.lastHeartbeat.toString()
            });

            // Set TTL for instance info
            await stateClient.expire(instanceKey, opts.stateSharing?.stateTtl || 86400);

            // Setup cross-instance messaging
            setupCrossInstanceMessaging(io, pubClient, subClient, instanceId, moduleLogger);

            // Setup connection state sharing if enabled
            if (opts.enableStateSharing) {
                setupConnectionStateSharing(io, stateClient, instanceId, opts, moduleLogger);
            }

            // Setup instance heartbeat
            const heartbeatInterval = setInterval(async () => {
                try {
                    instanceInfo.uptime = Math.floor((Date.now() - instanceInfo.startTime) / 1000);
                    instanceInfo.connections = io.engine.clientsCount;
                    instanceInfo.lastHeartbeat = Date.now();

                    await stateClient.hSet(instanceKey, {
                        connections: instanceInfo.connections.toString(),
                        uptime: instanceInfo.uptime.toString(),
                        lastHeartbeat: instanceInfo.lastHeartbeat.toString()
                    });

                    // Refresh TTL
                    await stateClient.expire(instanceKey, opts.stateSharing?.stateTtl || 86400);
                } catch (error) {
                    moduleLogger.error('Failed to update instance heartbeat', error as Error);
                }
            }, 15000); // Every 15 seconds

            // Clean up on process exit
            process.on('SIGTERM', async () => {
                clearInterval(heartbeatInterval);
                try {
                    await stateClient.del(instanceKey);
                    await stateClient.disconnect();
                } catch (error) {
                    moduleLogger.error('Error during cleanup', error as Error);
                }
            });

            process.on('SIGINT', async () => {
                clearInterval(heartbeatInterval);
                try {
                    await stateClient.del(instanceKey);
                    await stateClient.disconnect();
                } catch (error) {
                    moduleLogger.error('Error during cleanup', error as Error);
                }
            });
        }

        moduleLogger.info('Redis adapter initialized', {
            instanceId,
            hostname: instanceInfo.hostname,
            enableStateSharing: opts.enableStateSharing
        });
    } catch (error) {
        moduleLogger.error('Failed to initialize Redis adapter', error as Error);
        throw error;
    }
}

/**
 * Get Redis client options from adapter options
 * 
 * @param options Redis adapter options
 * @returns Redis client options
 */
function getRedisClientOptions(options: RedisAdapterOptions): any {
    if (options.url) {
        return {
            url: options.url,
            socket: {
                tls: options.tls,
                connectTimeout: options.connectionTimeoutMs
            },
            database: options.db
        };
    }

    return {
        socket: {
            host: options.host,
            port: options.port,
            tls: options.tls,
            connectTimeout: options.connectionTimeoutMs
        },
        password: options.password,
        database: options.db
    };
}

/**
 * Create a Redis client for testing connection
 * 
 * @param options Redis adapter options
 * @returns Redis client
 */
export async function testRedisConnection(
    options: RedisAdapterOptions = {},
    logger: Logger
): Promise<boolean> {
    // Create module logger
    const moduleLogger = logger.child({ module: 'RedisAdapter' });

    // Merge options with defaults
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
        // Create Redis client
        const client = createClient(getRedisClientOptions(opts));

        // Connect to Redis
        moduleLogger.info('Testing Redis connection', {
            host: opts.host,
            port: opts.port,
            url: opts.url ? '[redacted]' : undefined
        });

        await client.connect();

        // Ping Redis
        const pong = await client.ping();

        // Disconnect
        await client.disconnect();

        moduleLogger.info('Redis connection test successful');

        return pong === 'PONG';
    } catch (error) {
        moduleLogger.error('Redis connection test failed', error as Error);
        return false;
    }
}

/**
 * Setup cross-instance messaging
 * 
 * @param io Socket.IO server instance
 * @param pubClient Redis publisher client
 * @param subClient Redis subscriber client
 * @param instanceId Unique instance ID
 * @param logger Logger instance
 */
function setupCrossInstanceMessaging(
    io: Server,
    pubClient: ReturnType<typeof createClient>,
    subClient: ReturnType<typeof createClient>,
    instanceId: string,
    logger: Logger
): void {
    const CHANNEL_PREFIX = 'socket.io:cross-instance';
    const BROADCAST_CHANNEL = `${CHANNEL_PREFIX}:broadcast`;
    const DIRECT_CHANNEL = `${CHANNEL_PREFIX}:direct:${instanceId}`;

    // Subscribe to broadcast channel
    subClient.subscribe(BROADCAST_CHANNEL, (message, channel) => {
        try {
            const data = JSON.parse(message);
            if (data.sourceInstanceId !== instanceId) {
                logger.debug('Received cross-instance broadcast message', {
                    event: data.event,
                    sourceInstanceId: data.sourceInstanceId
                });

                // Process the message based on its type
                handleCrossInstanceMessage(io, data, logger);
            }
        } catch (error) {
            logger.error('Error processing cross-instance broadcast message', error as Error);
        }
    });

    // Subscribe to direct channel for this instance
    subClient.subscribe(DIRECT_CHANNEL, (message, channel) => {
        try {
            const data = JSON.parse(message);
            logger.debug('Received direct cross-instance message', {
                event: data.event,
                sourceInstanceId: data.sourceInstanceId
            });

            // Process the message based on its type
            handleCrossInstanceMessage(io, data, logger);
        } catch (error) {
            logger.error('Error processing direct cross-instance message', error as Error);
        }
    });

    // Add methods to io object for cross-instance messaging
    (io as any).crossInstanceBroadcast = async (event: string, data: any) => {
        try {
            await pubClient.publish(BROADCAST_CHANNEL, JSON.stringify({
                event,
                data,
                sourceInstanceId: instanceId,
                timestamp: Date.now()
            }));
        } catch (error) {
            logger.error('Error sending cross-instance broadcast', error as Error);
        }
    };

    (io as any).crossInstanceSendToInstance = async (targetInstanceId: string, event: string, data: any) => {
        try {
            await pubClient.publish(`${CHANNEL_PREFIX}:direct:${targetInstanceId}`, JSON.stringify({
                event,
                data,
                sourceInstanceId: instanceId,
                timestamp: Date.now()
            }));
        } catch (error) {
            logger.error('Error sending direct cross-instance message', error as Error);
        }
    };

    // Log successful setup
    logger.info('Cross-instance messaging initialized', {
        instanceId,
        broadcastChannel: BROADCAST_CHANNEL,
        directChannel: DIRECT_CHANNEL
    });
}

/**
 * Handle cross-instance message
 * 
 * @param io Socket.IO server instance
 * @param message Message data
 * @param logger Logger instance
 */
function handleCrossInstanceMessage(
    io: Server,
    message: any,
    logger: Logger
): void {
    const { event, data, sourceInstanceId } = message;

    switch (event) {
        case 'broadcast':
            // Broadcast to all clients on this instance
            if (data.room) {
                io.to(data.room).emit(data.event, data.payload);
            } else {
                io.emit(data.event, data.payload);
            }
            break;

        case 'direct':
            // Send to specific socket if it exists on this instance
            const socket = io.sockets.sockets.get(data.socketId);
            if (socket) {
                socket.emit(data.event, data.payload);
            }
            break;

        case 'disconnect':
            // Disconnect a socket if it exists on this instance
            const socketToDisconnect = io.sockets.sockets.get(data.socketId);
            if (socketToDisconnect) {
                socketToDisconnect.disconnect(true);
            }
            break;

        case 'join':
            // Join a socket to a room if it exists on this instance
            const socketToJoin = io.sockets.sockets.get(data.socketId);
            if (socketToJoin) {
                socketToJoin.join(data.room);
            }
            break;

        case 'leave':
            // Remove a socket from a room if it exists on this instance
            const socketToLeave = io.sockets.sockets.get(data.socketId);
            if (socketToLeave) {
                socketToLeave.leave(data.room);
            }
            break;

        default:
            // Custom events can be handled by registering handlers
            io.emit(`cross-instance:${event}`, data);
            break;
    }
}

/**
 * Setup connection state sharing
 * 
 * @param io Socket.IO server instance
 * @param stateClient Redis client for state management
 * @param instanceId Unique instance ID
 * @param options Redis adapter options
 * @param logger Logger instance
 */
function setupConnectionStateSharing(
    io: Server,
    stateClient: ReturnType<typeof createClient>,
    instanceId: string,
    options: RedisAdapterOptions,
    logger: Logger
): void {
    const keyPrefix = options.stateSharing?.keyPrefix || 'socket.io:state';
    const stateTtl = options.stateSharing?.stateTtl || 86400;
    const syncIntervalMs = options.stateSharing?.syncIntervalMs || 30000;

    // Track connection state changes
    io.on('connection', (socket) => {
        // Store initial connection state
        socket.on('authenticated', async (userId: string) => {
            try {
                await storeConnectionState(stateClient, keyPrefix, stateTtl, {
                    socketId: socket.id,
                    userId,
                    rooms: Array.from(socket.rooms || []),
                    data: socket.data || {},
                    instanceId,
                    lastUpdated: Date.now()
                });

                logger.debug('Stored connection state for authenticated user', {
                    socketId: socket.id,
                    userId
                });
            } catch (error) {
                logger.error('Failed to store connection state', error as Error);
            }
        });

        // Update state when rooms change
        const originalJoin = socket.join.bind(socket);
        socket.join = function (room: string | string[]) {
            const result = originalJoin(room);

            // Update connection state after room change
            if (socket.data?.userId) {
                updateConnectionState(stateClient, keyPrefix, stateTtl, socket, instanceId, logger).catch(
                    (error) => logger.error('Failed to update connection state after join', error as Error)
                );
            }

            return result;
        };

        const originalLeave = socket.leave.bind(socket);
        socket.leave = function (room: string) {
            const result = originalLeave(room);

            // Update connection state after room change
            if (socket.data?.userId) {
                updateConnectionState(stateClient, keyPrefix, stateTtl, socket, instanceId, logger).catch(
                    (error) => logger.error('Failed to update connection state after leave', error as Error)
                );
            }

            return result;
        };

        // Remove state on disconnect
        socket.on('disconnect', async () => {
            try {
                await stateClient.del(`${keyPrefix}:connections:${socket.id}`);
                logger.debug('Removed connection state on disconnect', {
                    socketId: socket.id
                });
            } catch (error) {
                logger.error('Failed to remove connection state', error as Error);
            }
        });
    });

    // Periodically sync connection states
    const syncInterval = setInterval(async () => {
        try {
            // Get all connections on this instance
            const sockets = await io.fetchSockets();

            // Update state for each authenticated connection
            for (const socket of sockets) {
                if (socket.data?.userId) {
                    await updateConnectionState(stateClient, keyPrefix, stateTtl, socket, instanceId, logger);
                }
            }

            logger.debug('Connection states synchronized', {
                connectionCount: sockets.length
            });
        } catch (error) {
            logger.error('Failed to sync connection states', error as Error);
        }
    }, syncIntervalMs);

    // Clean up on process exit
    process.on('SIGTERM', () => {
        clearInterval(syncInterval);
    });

    process.on('SIGINT', () => {
        clearInterval(syncInterval);
    });

    // Add methods to io object for state management
    (io as any).getConnectionStates = async (userId?: string): Promise<ConnectionState[]> => {
        try {
            if (userId) {
                // Get connections for specific user
                const pattern = `${keyPrefix}:connections:*`;
                const keys = await stateClient.keys(pattern);
                const states: ConnectionState[] = [];

                for (const key of keys) {
                    const stateData = await stateClient.get(key);
                    if (stateData) {
                        const state = JSON.parse(stateData) as ConnectionState;
                        if (state.userId === userId) {
                            states.push(state);
                        }
                    }
                }

                return states;
            } else {
                // Get all connections
                const pattern = `${keyPrefix}:connections:*`;
                const keys = await stateClient.keys(pattern);
                const states: ConnectionState[] = [];

                for (const key of keys) {
                    const stateData = await stateClient.get(key);
                    if (stateData) {
                        states.push(JSON.parse(stateData) as ConnectionState);
                    }
                }

                return states;
            }
        } catch (error) {
            logger.error('Failed to get connection states', error as Error);
            return [];
        }
    };

    (io as any).getActiveInstances = async (): Promise<InstanceInfo[]> => {
        try {
            const pattern = `${keyPrefix}:instances:*`;
            const keys = await stateClient.keys(pattern);
            const instances: InstanceInfo[] = [];

            for (const key of keys) {
                const data = await stateClient.hGetAll(key);
                if (data && Object.keys(data).length > 0) {
                    instances.push({
                        id: key.split(':').pop() || '',
                        hostname: data.hostname,
                        pid: parseInt(data.pid, 10),
                        startTime: parseInt(data.startTime, 10),
                        connections: parseInt(data.connections, 10),
                        uptime: parseInt(data.uptime, 10),
                        lastHeartbeat: parseInt(data.lastHeartbeat, 10)
                    });
                }
            }

            return instances;
        } catch (error) {
            logger.error('Failed to get active instances', error as Error);
            return [];
        }
    };

    logger.info('Connection state sharing initialized', {
        instanceId,
        syncIntervalMs
    });
}

/**
 * Store connection state in Redis
 * 
 * @param stateClient Redis client for state management
 * @param keyPrefix Key prefix for state entries
 * @param stateTtl TTL for state entries in seconds
 * @param state Connection state to store
 */
async function storeConnectionState(
    stateClient: ReturnType<typeof createClient>,
    keyPrefix: string,
    stateTtl: number,
    state: ConnectionState
): Promise<void> {
    const key = `${keyPrefix}:connections:${state.socketId}`;
    await stateClient.set(key, JSON.stringify(state));
    await stateClient.expire(key, stateTtl);
}

/**
 * Update connection state in Redis
 * 
 * @param stateClient Redis client for state management
 * @param keyPrefix Key prefix for state entries
 * @param stateTtl TTL for state entries in seconds
 * @param socket Socket instance
 * @param instanceId Instance ID
 * @param logger Logger instance
 */
async function updateConnectionState(
    stateClient: ReturnType<typeof createClient>,
    keyPrefix: string,
    stateTtl: number,
    socket: any,
    instanceId: string,
    logger: Logger
): Promise<void> {
    try {
        const state: ConnectionState = {
            socketId: socket.id,
            userId: socket.data.userId,
            rooms: Array.from(socket.rooms || []),
            data: { ...socket.data },
            instanceId,
            lastUpdated: Date.now()
        };

        await storeConnectionState(stateClient, keyPrefix, stateTtl, state);
    } catch (error) {
        logger.error('Failed to update connection state', error as Error);
    }
}