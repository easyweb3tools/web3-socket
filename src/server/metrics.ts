import { Express } from 'express';
import { Server, Socket } from 'socket.io';
import { register, Counter, Gauge, Histogram, Summary, collectDefaultMetrics } from 'prom-client';
import { ConnectionManager } from './connection-manager';
import { RoomManager } from './room-manager';
import { Logger } from './logger';

// Metrics interface
export interface Metrics {
    // Connection metrics
    activeConnections: Gauge<string>;
    connectionsByUser: Gauge<string>;
    connectionRate: Counter<string>;
    disconnectionRate: Counter<string>;

    // Room metrics
    roomCount: Gauge<string>;
    roomsByType: Gauge<string>;
    roomMemberCount: Gauge<string>;

    // Message metrics
    messageCounter: Counter<string>;
    messageSize: Histogram<string>;
    messageLatency: Histogram<string>;

    // Error metrics
    errorCounter: Counter<string>;

    // HTTP metrics
    httpRequestDuration: Histogram<string>;
    httpRequestCounter: Counter<string>;

    // System metrics
    eventLoopLag: Gauge<string>;
    heapUsage: Gauge<string>;

    // Instance metrics
    instanceCount: Gauge<string>;
    instanceConnections: Gauge<string>;
    instanceLoad: Gauge<string>;
    instanceCpuUsage: Gauge<string>;
    instanceMemoryUsage: Gauge<string>;

    // Utility methods
    observeMessageLatency(event: string, latency: number): void;
    incrementMessageCounter(direction: string, event: string): void;
    recordMessageSize(event: string, size: number): void;
    recordError(type: string, error?: Error): void;
    recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void;
}

// Initialize metrics
export function setupMetrics(
    app: Express,
    io: Server,
    connectionManager: ConnectionManager,
    roomManager: RoomManager,
    logger?: Logger
): Metrics {
    const metricsLogger = logger?.child({ module: 'Metrics' }) || console;

    // Enable default metrics
    collectDefaultMetrics({
        prefix: 'socket_server_',
        register
    });

    register.setDefaultLabels({
        app: 'socket-server',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });

    metricsLogger.info('Setting up metrics collection');

    // Connection metrics
    const activeConnections = new Gauge({
        name: 'socket_server_active_connections',
        help: 'Number of active socket connections',
        collect() {
            this.set(connectionManager.getActiveConnectionsCount());
        }
    });

    const connectionsByUser = new Gauge({
        name: 'socket_server_connections_by_user',
        help: 'Number of unique users connected',
        collect() {
            this.set(connectionManager.getUserConnections().size);
        }
    });

    const connectionRate = new Counter({
        name: 'socket_server_connections_total',
        help: 'Total number of connections',
        labelNames: ['authenticated', 'transport']
    });

    const disconnectionRate = new Counter({
        name: 'socket_server_disconnections_total',
        help: 'Total number of disconnections',
        labelNames: ['reason']
    });

    // Room metrics
    const roomCount = new Gauge({
        name: 'socket_server_room_count',
        help: 'Number of active rooms',
        collect() {
            this.set(roomManager.getRoomCount());
        }
    });

    const roomsByType = new Gauge({
        name: 'socket_server_rooms_by_type',
        help: 'Number of rooms by type',
        labelNames: ['type'],
        collect() {
            const userRooms = roomManager.getRoomsByType('user').length;
            const groupRooms = roomManager.getRoomsByType('group').length;
            const systemRooms = roomManager.getRoomsByType('system').length;

            this.set({ type: 'user' }, userRooms);
            this.set({ type: 'group' }, groupRooms);
            this.set({ type: 'system' }, systemRooms);
        }
    });

    const roomMemberCount = new Gauge({
        name: 'socket_server_room_member_count',
        help: 'Number of members in rooms',
        labelNames: ['room', 'type']
    });

    // Message metrics
    const messageCounter = new Counter({
        name: 'socket_server_messages_total',
        help: 'Total number of messages processed',
        labelNames: ['direction', 'event']
    });

    const messageSize = new Histogram({
        name: 'socket_server_message_size_bytes',
        help: 'Size of messages in bytes',
        labelNames: ['event'],
        buckets: [10, 100, 1000, 10000, 100000, 1000000]
    });

    const messageLatency = new Histogram({
        name: 'socket_server_message_latency_seconds',
        help: 'Message processing latency in seconds',
        labelNames: ['event'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
    });

    // Error metrics
    const errorCounter = new Counter({
        name: 'socket_server_errors_total',
        help: 'Total number of errors',
        labelNames: ['type', 'code']
    });

    // HTTP metrics
    const httpRequestDuration = new Histogram({
        name: 'socket_server_http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 5]
    });

    const httpRequestCounter = new Counter({
        name: 'socket_server_http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code']
    });

    // System metrics
    const eventLoopLag = new Gauge({
        name: 'socket_server_event_loop_lag_seconds',
        help: 'Lag of event loop in seconds'
    });

    const heapUsage = new Gauge({
        name: 'socket_server_heap_usage_bytes',
        help: 'Process heap usage in bytes',
        labelNames: ['type'],
        collect() {
            const memoryUsage = process.memoryUsage();
            this.set({ type: 'rss' }, memoryUsage.rss);
            this.set({ type: 'heapTotal' }, memoryUsage.heapTotal);
            this.set({ type: 'heapUsed' }, memoryUsage.heapUsed);
            this.set({ type: 'external' }, memoryUsage.external);
        }
    });

    // Instance metrics
    const instanceCount = new Gauge({
        name: 'socket_server_instance_count',
        help: 'Number of active server instances'
    });

    const instanceConnections = new Gauge({
        name: 'socket_server_instance_connections',
        help: 'Number of connections per instance',
        labelNames: ['instanceId']
    });

    const instanceLoad = new Gauge({
        name: 'socket_server_instance_load',
        help: 'Load score per instance (0-100)',
        labelNames: ['instanceId']
    });

    const instanceCpuUsage = new Gauge({
        name: 'socket_server_instance_cpu_usage',
        help: 'CPU usage percentage per instance',
        labelNames: ['instanceId']
    });

    const instanceMemoryUsage = new Gauge({
        name: 'socket_server_instance_memory_usage',
        help: 'Memory usage percentage per instance',
        labelNames: ['instanceId']
    });

    // Monitor event loop lag
    setInterval(() => {
        const start = Date.now();
        setImmediate(() => {
            const lag = (Date.now() - start) / 1000;
            eventLoopLag.set(lag);
        });
    }, 5000);

    // Expose metrics endpoint
    app.get('/metrics', async (req, res) => {
        try {
            res.set('Content-Type', register.contentType);
            res.end(await register.metrics());
        } catch (err) {
            metricsLogger.error('Error generating metrics', err as Error);
            res.status(500).end();
        }
    });

    // Add Socket.IO event listeners for metrics
    io.on('connection', (socket: Socket) => {
        // Record connection
        connectionRate.inc({
            authenticated: 'false',
            transport: socket.conn?.transport?.name || 'unknown'
        });

        // Update metrics when socket authenticates
        socket.on('register:ack', (data: any) => {
            if (data?.success) {
                connectionRate.inc({
                    authenticated: 'true',
                    transport: socket.conn?.transport?.name || 'unknown'
                });
            }
        });

        // Record disconnection
        socket.on('disconnect', (reason: string) => {
            disconnectionRate.inc({ reason });
        });

        // Monitor all events for metrics
        socket.onAny((event, ...args) => {
            // Skip internal events
            if (event.startsWith('_')) return;

            // Record message
            messageCounter.inc({ direction: 'incoming', event });

            // Estimate message size
            try {
                const size = JSON.stringify(args).length;
                messageSize.observe({ event }, size);
            } catch (e) {
                // Ignore serialization errors
            }
        });
    });

    metricsLogger.info('Metrics collection initialized');

    // Return metrics interface
    return {
        // Metrics objects
        activeConnections,
        connectionsByUser,
        connectionRate,
        disconnectionRate,
        roomCount,
        roomsByType,
        roomMemberCount,
        messageCounter,
        messageSize,
        messageLatency,
        errorCounter,
        httpRequestDuration,
        httpRequestCounter,
        eventLoopLag,
        heapUsage,

        // Instance metrics
        instanceCount,
        instanceConnections,
        instanceLoad,
        instanceCpuUsage,
        instanceMemoryUsage,

        // Utility methods
        observeMessageLatency(event: string, latency: number): void {
            messageLatency.observe({ event }, latency);
        },

        incrementMessageCounter(direction: string, event: string): void {
            messageCounter.inc({ direction, event });
        },

        recordMessageSize(event: string, size: number): void {
            messageSize.observe({ event }, size);
        },

        recordError(type: string, error?: Error): void {
            errorCounter.inc({
                type,
                code: error?.name || 'unknown'
            });
        },

        recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
            httpRequestDuration.observe({ method, route, status_code: statusCode.toString() }, duration);
            httpRequestCounter.inc({ method, route, status_code: statusCode.toString() });
        }
    };
}