/**
 * Instance Manager for horizontal scaling support
 * Manages instance identification, load balancing compatibility, and shared state
 */
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { Logger } from '../logger';
import { InstanceInfo } from '../adapters/redis-adapter';

/**
 * Instance manager options
 */
export interface InstanceManagerOptions {
    /**
     * Instance ID (generated if not provided)
     */
    instanceId?: string;

    /**
     * Instance group name (for logical grouping)
     */
    groupName?: string;

    /**
     * Instance metadata
     */
    metadata?: Record<string, any>;

    /**
     * Health check interval in milliseconds
     */
    healthCheckIntervalMs?: number;

    /**
     * Whether to enable load balancing compatibility
     */
    enableLoadBalancing?: boolean;

    /**
     * Load balancing options
     */
    loadBalancing?: {
        /**
         * Maximum connections per instance
         */
        maxConnectionsPerInstance?: number;

        /**
         * Whether to report load to Redis
         */
        reportLoad?: boolean;

        /**
         * Load reporting interval in milliseconds
         */
        reportIntervalMs?: number;
    };
}

/**
 * Instance health status
 */
export interface InstanceHealth {
    /**
     * Instance ID
     */
    instanceId: string;

    /**
     * Whether the instance is healthy
     */
    healthy: boolean;

    /**
     * CPU usage percentage
     */
    cpuUsage: number;

    /**
     * Memory usage percentage
     */
    memoryUsage: number;

    /**
     * Number of active connections
     */
    connections: number;

    /**
     * Event loop lag in milliseconds
     */
    eventLoopLag: number;

    /**
     * Last updated timestamp
     */
    timestamp: number;
}

/**
 * Instance load information
 */
export interface InstanceLoad {
    /**
     * Instance ID
     */
    instanceId: string;

    /**
     * Number of active connections
     */
    connections: number;

    /**
     * CPU usage percentage
     */
    cpuUsage: number;

    /**
     * Memory usage percentage
     */
    memoryUsage: number;

    /**
     * Load score (0-100, higher means more loaded)
     */
    loadScore: number;

    /**
     * Last updated timestamp
     */
    timestamp: number;
}

/**
 * Default instance manager options
 */
const DEFAULT_OPTIONS: InstanceManagerOptions = {
    instanceId: uuidv4(),
    groupName: 'default',
    metadata: {},
    healthCheckIntervalMs: 30000,
    enableLoadBalancing: true,
    loadBalancing: {
        maxConnectionsPerInstance: 10000,
        reportLoad: true,
        reportIntervalMs: 10000
    }
};

/**
 * Instance Manager class
 */
export class InstanceManager {
    private instanceId: string;
    private groupName: string;
    private metadata: Record<string, any>;
    private startTime: number;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private loadReportInterval: NodeJS.Timeout | null = null;
    private health: InstanceHealth;
    private load: InstanceLoad;
    private moduleLogger: Logger;
    private options: InstanceManagerOptions;

    /**
     * Create a new instance manager
     * 
     * @param io Socket.IO server instance
     * @param logger Logger instance
     * @param options Instance manager options
     */
    constructor(
        private io: Server,
        private logger: Logger,
        options: InstanceManagerOptions = {}
    ) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.instanceId = this.options.instanceId || uuidv4();
        this.groupName = this.options.groupName || 'default';
        this.metadata = this.options.metadata || {};
        this.startTime = Date.now();
        this.moduleLogger = logger.child({ module: 'InstanceManager', instanceId: this.instanceId });

        // Initialize health and load
        this.health = {
            instanceId: this.instanceId,
            healthy: true,
            cpuUsage: 0,
            memoryUsage: 0,
            connections: 0,
            eventLoopLag: 0,
            timestamp: Date.now()
        };

        this.load = {
            instanceId: this.instanceId,
            connections: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            loadScore: 0,
            timestamp: Date.now()
        };

        this.moduleLogger.info('Instance manager initialized', {
            instanceId: this.instanceId,
            groupName: this.groupName,
            hostname: os.hostname(),
            pid: process.pid
        });
    }

    /**
     * Start the instance manager
     */
    public start(): void {
        // Start health check interval
        this.healthCheckInterval = setInterval(() => {
            this.checkHealth();
        }, this.options.healthCheckIntervalMs);

        // Start load reporting interval if enabled
        if (this.options.enableLoadBalancing && this.options.loadBalancing?.reportLoad) {
            this.loadReportInterval = setInterval(() => {
                this.reportLoad();
            }, this.options.loadBalancing?.reportIntervalMs);
        }

        this.moduleLogger.info('Instance manager started');
    }

    /**
     * Stop the instance manager
     */
    public stop(): void {
        // Clear intervals
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        if (this.loadReportInterval) {
            clearInterval(this.loadReportInterval);
            this.loadReportInterval = null;
        }

        this.moduleLogger.info('Instance manager stopped');
    }

    /**
     * Get instance ID
     */
    public getInstanceId(): string {
        return this.instanceId;
    }

    /**
     * Get instance group name
     */
    public getGroupName(): string {
        return this.groupName;
    }

    /**
     * Get instance metadata
     */
    public getMetadata(): Record<string, any> {
        return { ...this.metadata };
    }

    /**
     * Get instance uptime in seconds
     */
    public getUptime(): number {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    /**
     * Get instance health
     */
    public getHealth(): InstanceHealth {
        return { ...this.health };
    }

    /**
     * Get instance load
     */
    public getLoad(): InstanceLoad {
        return { ...this.load };
    }

    /**
     * Get instance information
     */
    public getInstanceInfo(): InstanceInfo {
        return {
            id: this.instanceId,
            hostname: os.hostname(),
            pid: process.pid,
            startTime: this.startTime,
            connections: this.io.engine.clientsCount,
            uptime: this.getUptime(),
            lastHeartbeat: Date.now()
        };
    }

    /**
     * Check if this instance can accept more connections
     */
    public canAcceptConnections(): boolean {
        if (!this.options.enableLoadBalancing) {
            return true;
        }

        const maxConnections = this.options.loadBalancing?.maxConnectionsPerInstance || 10000;
        return this.io.engine.clientsCount < maxConnections;
    }

    /**
     * Get all instances (if Redis adapter is enabled)
     */
    public async getAllInstances(): Promise<InstanceInfo[]> {
        if ((this.io as any).getActiveInstances) {
            return await (this.io as any).getActiveInstances();
        }

        return [this.getInstanceInfo()];
    }

    /**
     * Check instance health
     */
    private async checkHealth(): Promise<void> {
        try {
            // Get CPU usage (this is an approximation)
            const cpuUsage = await this.getCpuUsage();

            // Get memory usage
            const memoryUsage = this.getMemoryUsage();

            // Get event loop lag
            const eventLoopLag = await this.getEventLoopLag();

            // Update health
            this.health = {
                instanceId: this.instanceId,
                healthy: true,
                cpuUsage,
                memoryUsage,
                connections: this.io.engine.clientsCount,
                eventLoopLag,
                timestamp: Date.now()
            };

            // Log health if significant changes
            if (
                Math.abs(cpuUsage - this.load.cpuUsage) > 10 ||
                Math.abs(memoryUsage - this.load.memoryUsage) > 10 ||
                Math.abs(this.health.connections - this.load.connections) > 100
            ) {
                this.moduleLogger.info('Instance health updated', {
                    cpuUsage: Math.round(cpuUsage),
                    memoryUsage: Math.round(memoryUsage),
                    connections: this.health.connections,
                    eventLoopLag: Math.round(eventLoopLag)
                });
            }
        } catch (error) {
            this.moduleLogger.error('Error checking instance health', error as Error);
        }
    }

    /**
     * Report instance load to Redis (if enabled)
     */
    private async reportLoad(): Promise<void> {
        try {
            // Calculate load score (0-100)
            const cpuWeight = 0.4;
            const memoryWeight = 0.3;
            const connectionsWeight = 0.3;

            const maxConnections = this.options.loadBalancing?.maxConnectionsPerInstance || 10000;
            const connectionsPercentage = (this.health.connections / maxConnections) * 100;

            const loadScore = Math.min(100, Math.max(0,
                (this.health.cpuUsage * cpuWeight) +
                (this.health.memoryUsage * memoryWeight) +
                (connectionsPercentage * connectionsWeight)
            ));

            // Update load
            this.load = {
                instanceId: this.instanceId,
                connections: this.health.connections,
                cpuUsage: this.health.cpuUsage,
                memoryUsage: this.health.memoryUsage,
                loadScore,
                timestamp: Date.now()
            };

            // Report load to Redis if adapter is available
            if ((this.io as any).crossInstanceBroadcast) {
                (this.io as any).crossInstanceBroadcast('instance:load', this.load);
            }
        } catch (error) {
            this.moduleLogger.error('Error reporting instance load', error as Error);
        }
    }

    /**
     * Get CPU usage percentage
     */
    private async getCpuUsage(): Promise<number> {
        return new Promise((resolve) => {
            // This is a simple approximation
            const startUsage = process.cpuUsage();

            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const userCpuSeconds = endUsage.user / 1000000;
                const systemCpuSeconds = endUsage.system / 1000000;
                const totalCpuSeconds = userCpuSeconds + systemCpuSeconds;

                // Convert to percentage (0-100)
                const cpuPercentage = (totalCpuSeconds / 0.1) * 100;
                resolve(Math.min(100, cpuPercentage));
            }, 100);
        });
    }

    /**
     * Get memory usage percentage
     */
    private getMemoryUsage(): number {
        const memoryUsage = process.memoryUsage();
        const totalMemory = os.totalmem();

        // Use resident set size as memory usage
        return (memoryUsage.rss / totalMemory) * 100;
    }

    /**
     * Get event loop lag in milliseconds
     */
    private async getEventLoopLag(): Promise<number> {
        return new Promise((resolve) => {
            const start = Date.now();

            setImmediate(() => {
                const lag = Date.now() - start;
                resolve(lag);
            });
        });
    }
}