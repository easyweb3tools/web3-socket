/**
 * Load management utility
 * This utility provides functions to monitor and manage system load
 */
import os from 'os';
import { EventEmitter } from 'events';
import { Logger } from '../logger';

/**
 * Load threshold levels
 */
export enum LoadLevel {
    NORMAL = 'normal',
    ELEVATED = 'elevated',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * Load threshold configuration
 */
export interface LoadThresholds {
    /**
     * CPU usage threshold percentages for each load level
     */
    cpu: {
        elevated: number;
        high: number;
        critical: number;
    };

    /**
     * Memory usage threshold percentages for each load level
     */
    memory: {
        elevated: number;
        high: number;
        critical: number;
    };

    /**
     * Socket connection count thresholds for each load level
     */
    connections: {
        elevated: number;
        high: number;
        critical: number;
    };

    /**
     * Event loop lag thresholds in milliseconds for each load level
     */
    eventLoopLag: {
        elevated: number;
        high: number;
        critical: number;
    };
}

/**
 * Default load thresholds
 */
const DEFAULT_THRESHOLDS: LoadThresholds = {
    cpu: {
        elevated: 70,
        high: 85,
        critical: 95
    },
    memory: {
        elevated: 70,
        high: 85,
        critical: 95
    },
    connections: {
        elevated: 1000,
        high: 5000,
        critical: 10000
    },
    eventLoopLag: {
        elevated: 100,
        high: 500,
        critical: 1000
    }
};

/**
 * Load manager options
 */
export interface LoadManagerOptions {
    /**
     * Load thresholds
     */
    thresholds?: Partial<LoadThresholds>;

    /**
     * Check interval in milliseconds
     */
    checkIntervalMs?: number;

    /**
     * Whether to enable automatic throttling
     */
    enableAutoThrottling?: boolean;

    /**
     * Maximum number of connections to allow when in critical load
     */
    maxConnectionsUnderLoad?: number;

    /**
     * Maximum message rate per second when in critical load
     */
    maxMessageRateUnderLoad?: number;
}

/**
 * Load manager state
 */
export interface LoadState {
    /**
     * Current load level
     */
    level: LoadLevel;

    /**
     * CPU usage percentage
     */
    cpuUsage: number;

    /**
     * Memory usage percentage
     */
    memoryUsage: number;

    /**
     * Current connection count
     */
    connectionCount: number;

    /**
     * Event loop lag in milliseconds
     */
    eventLoopLag: number;

    /**
     * Whether throttling is active
     */
    throttlingActive: boolean;

    /**
     * Timestamp of the measurement
     */
    timestamp: Date;
}

/**
 * Load manager for monitoring and managing system load
 */
export class LoadManager extends EventEmitter {
    private thresholds: LoadThresholds;
    private checkIntervalMs: number;
    private enableAutoThrottling: boolean;
    private maxConnectionsUnderLoad: number;
    private maxMessageRateUnderLoad: number;
    private logger: Logger;
    private state: LoadState;
    private checkInterval: NodeJS.Timeout | null = null;
    private previousCpuInfo: os.CpuInfo[] | null = null;
    private getConnectionCount: () => number;
    private throttleConnections: boolean = false;
    private throttleMessages: boolean = false;
    private messageCounters: Map<string, number> = new Map();
    private messageRateLimits: Map<string, number> = new Map();

    /**
     * Create a new load manager
     * 
     * @param logger Logger instance
     * @param getConnectionCount Function to get current connection count
     * @param options Load manager options
     */
    constructor(
        logger: Logger,
        getConnectionCount: () => number,
        options: LoadManagerOptions = {}
    ) {
        super();

        this.logger = logger.child({ module: 'LoadManager' });
        this.getConnectionCount = getConnectionCount;

        // Merge options with defaults
        this.thresholds = this.mergeThresholds(DEFAULT_THRESHOLDS, options.thresholds || {});
        this.checkIntervalMs = options.checkIntervalMs || 10000; // 10 seconds
        this.enableAutoThrottling = options.enableAutoThrottling !== false;
        this.maxConnectionsUnderLoad = options.maxConnectionsUnderLoad || 1000;
        this.maxMessageRateUnderLoad = options.maxMessageRateUnderLoad || 100;

        // Initialize state
        this.state = {
            level: LoadLevel.NORMAL,
            cpuUsage: 0,
            memoryUsage: 0,
            connectionCount: 0,
            eventLoopLag: 0,
            throttlingActive: false,
            timestamp: new Date()
        };

        this.logger.info('Load manager initialized', {
            checkIntervalMs: this.checkIntervalMs,
            enableAutoThrottling: this.enableAutoThrottling,
            maxConnectionsUnderLoad: this.maxConnectionsUnderLoad,
            maxMessageRateUnderLoad: this.maxMessageRateUnderLoad
        });
    }

    /**
     * Start load monitoring
     */
    public start(): void {
        if (this.checkInterval) {
            return;
        }

        // Get initial CPU info
        this.previousCpuInfo = os.cpus();

        // Start check interval
        this.checkInterval = setInterval(() => this.checkLoad(), this.checkIntervalMs);

        this.logger.info('Load monitoring started');
    }

    /**
     * Stop load monitoring
     */
    public stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            this.logger.info('Load monitoring stopped');
        }
    }

    /**
     * Check current system load
     */
    public async checkLoad(): Promise<LoadState> {
        try {
            // Get CPU usage
            const cpuUsage = await this.getCpuUsage();

            // Get memory usage
            const memoryUsage = this.getMemoryUsage();

            // Get connection count
            const connectionCount = this.getConnectionCount();

            // Get event loop lag
            const eventLoopLag = await this.getEventLoopLag();

            // Determine load level
            const level = this.determineLoadLevel(cpuUsage, memoryUsage, connectionCount, eventLoopLag);

            // Update state
            const previousLevel = this.state.level;
            this.state = {
                level,
                cpuUsage,
                memoryUsage,
                connectionCount,
                eventLoopLag,
                throttlingActive: this.throttleConnections || this.throttleMessages,
                timestamp: new Date()
            };

            // Log state change
            if (level !== previousLevel) {
                this.logger.info(`Load level changed from ${previousLevel} to ${level}`, {
                    cpuUsage: Math.round(cpuUsage),
                    memoryUsage: Math.round(memoryUsage),
                    connectionCount,
                    eventLoopLag: Math.round(eventLoopLag)
                });

                // Emit event
                this.emit('loadLevelChanged', this.state);
            }

            // Apply throttling if needed
            if (this.enableAutoThrottling) {
                this.applyThrottling(level);
            }

            return this.state;
        } catch (error) {
            this.logger.error('Error checking load', error as Error);
            return this.state;
        }
    }

    /**
     * Get current load state
     */
    public getState(): LoadState {
        return { ...this.state };
    }

    /**
     * Check if a new connection should be allowed
     */
    public shouldAllowConnection(): boolean {
        if (!this.throttleConnections) {
            return true;
        }

        return this.state.connectionCount < this.maxConnectionsUnderLoad;
    }

    /**
     * Check if a message should be allowed
     * 
     * @param userId User ID
     * @param eventName Event name
     */
    public shouldAllowMessage(userId: string, eventName: string): boolean {
        if (!this.throttleMessages) {
            return true;
        }

        const key = `${userId}:${eventName}`;
        const count = this.messageCounters.get(key) || 0;
        const limit = this.messageRateLimits.get(eventName) || this.maxMessageRateUnderLoad;

        return count < limit;
    }

    /**
     * Increment message counter for rate limiting
     * 
     * @param userId User ID
     * @param eventName Event name
     */
    public incrementMessageCounter(userId: string, eventName: string): void {
        if (!this.throttleMessages) {
            return;
        }

        const key = `${userId}:${eventName}`;
        const count = this.messageCounters.get(key) || 0;
        this.messageCounters.set(key, count + 1);
    }

    /**
     * Set message rate limit for a specific event
     * 
     * @param eventName Event name
     * @param limit Rate limit per second
     */
    public setMessageRateLimit(eventName: string, limit: number): void {
        this.messageRateLimits.set(eventName, limit);
    }

    /**
     * Reset message counters (called periodically)
     */
    public resetMessageCounters(): void {
        this.messageCounters.clear();
    }

    /**
     * Enable or disable connection throttling
     * 
     * @param enable Whether to enable throttling
     */
    public setConnectionThrottling(enable: boolean): void {
        this.throttleConnections = enable;
        this.state.throttlingActive = this.throttleConnections || this.throttleMessages;

        this.logger.info(`Connection throttling ${enable ? 'enabled' : 'disabled'}`, {
            maxConnections: this.maxConnectionsUnderLoad
        });

        this.emit('throttlingChanged', {
            connectionThrottling: this.throttleConnections,
            messageThrottling: this.throttleMessages
        });
    }

    /**
     * Enable or disable message throttling
     * 
     * @param enable Whether to enable throttling
     */
    public setMessageThrottling(enable: boolean): void {
        this.throttleMessages = enable;
        this.state.throttlingActive = this.throttleConnections || this.throttleMessages;

        this.logger.info(`Message throttling ${enable ? 'enabled' : 'disabled'}`, {
            maxMessageRate: this.maxMessageRateUnderLoad
        });

        this.emit('throttlingChanged', {
            connectionThrottling: this.throttleConnections,
            messageThrottling: this.throttleMessages
        });

        // Start or stop message counter reset interval
        if (enable) {
            setInterval(() => this.resetMessageCounters(), 1000);
        }
    }

    /**
     * Apply throttling based on load level
     * 
     * @param level Current load level
     */
    private applyThrottling(level: LoadLevel): void {
        switch (level) {
            case LoadLevel.CRITICAL:
                // Enable both connection and message throttling
                if (!this.throttleConnections) {
                    this.setConnectionThrottling(true);
                }
                if (!this.throttleMessages) {
                    this.setMessageThrottling(true);
                }
                break;

            case LoadLevel.HIGH:
                // Enable message throttling only
                if (this.throttleConnections) {
                    this.setConnectionThrottling(false);
                }
                if (!this.throttleMessages) {
                    this.setMessageThrottling(true);
                }
                break;

            case LoadLevel.ELEVATED:
            case LoadLevel.NORMAL:
                // Disable all throttling
                if (this.throttleConnections) {
                    this.setConnectionThrottling(false);
                }
                if (this.throttleMessages) {
                    this.setMessageThrottling(false);
                }
                break;
        }
    }

    /**
     * Determine load level based on metrics
     */
    private determineLoadLevel(
        cpuUsage: number,
        memoryUsage: number,
        connectionCount: number,
        eventLoopLag: number
    ): LoadLevel {
        // Check critical thresholds
        if (
            cpuUsage >= this.thresholds.cpu.critical ||
            memoryUsage >= this.thresholds.memory.critical ||
            connectionCount >= this.thresholds.connections.critical ||
            eventLoopLag >= this.thresholds.eventLoopLag.critical
        ) {
            return LoadLevel.CRITICAL;
        }

        // Check high thresholds
        if (
            cpuUsage >= this.thresholds.cpu.high ||
            memoryUsage >= this.thresholds.memory.high ||
            connectionCount >= this.thresholds.connections.high ||
            eventLoopLag >= this.thresholds.eventLoopLag.high
        ) {
            return LoadLevel.HIGH;
        }

        // Check elevated thresholds
        if (
            cpuUsage >= this.thresholds.cpu.elevated ||
            memoryUsage >= this.thresholds.memory.elevated ||
            connectionCount >= this.thresholds.connections.elevated ||
            eventLoopLag >= this.thresholds.eventLoopLag.elevated
        ) {
            return LoadLevel.ELEVATED;
        }

        // Otherwise, load is normal
        return LoadLevel.NORMAL;
    }

    /**
     * Get CPU usage percentage
     */
    private async getCpuUsage(): Promise<number> {
        return new Promise<number>((resolve) => {
            // Get current CPU info
            const currentCpuInfo = os.cpus();

            // If no previous info, return 0
            if (!this.previousCpuInfo) {
                this.previousCpuInfo = currentCpuInfo;
                resolve(0);
                return;
            }

            let totalUser = 0;
            let totalSystem = 0;
            let totalIdle = 0;
            let totalTick = 0;

            // Calculate CPU usage across all cores
            for (let i = 0; i < currentCpuInfo.length; i++) {
                const prevCpu = this.previousCpuInfo[i];
                const currentCpu = currentCpuInfo[i];

                // Calculate difference in CPU times
                const userDiff = currentCpu.times.user - prevCpu.times.user;
                const systemDiff = currentCpu.times.sys - prevCpu.times.sys;
                const idleDiff = currentCpu.times.idle - prevCpu.times.idle;
                const totalDiff = userDiff + systemDiff + idleDiff;

                totalUser += userDiff;
                totalSystem += systemDiff;
                totalIdle += idleDiff;
                totalTick += totalDiff;
            }

            // Update previous CPU info
            this.previousCpuInfo = currentCpuInfo;

            // Calculate CPU usage percentage
            const cpuUsage = totalTick > 0 ? ((totalUser + totalSystem) / totalTick) * 100 : 0;

            resolve(cpuUsage);
        });
    }

    /**
     * Get memory usage percentage
     */
    private getMemoryUsage(): number {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;

        return (usedMemory / totalMemory) * 100;
    }

    /**
     * Get event loop lag in milliseconds
     */
    private async getEventLoopLag(): Promise<number> {
        return new Promise<number>((resolve) => {
            const start = Date.now();

            // Schedule a task on the event loop
            setImmediate(() => {
                const lag = Date.now() - start;
                resolve(lag);
            });
        });
    }

    /**
     * Merge default thresholds with custom thresholds
     */
    private mergeThresholds(defaults: LoadThresholds, custom: Partial<LoadThresholds>): LoadThresholds {
        return {
            cpu: {
                elevated: custom.cpu?.elevated ?? defaults.cpu.elevated,
                high: custom.cpu?.high ?? defaults.cpu.high,
                critical: custom.cpu?.critical ?? defaults.cpu.critical
            },
            memory: {
                elevated: custom.memory?.elevated ?? defaults.memory.elevated,
                high: custom.memory?.high ?? defaults.memory.high,
                critical: custom.memory?.critical ?? defaults.memory.critical
            },
            connections: {
                elevated: custom.connections?.elevated ?? defaults.connections.elevated,
                high: custom.connections?.high ?? defaults.connections.high,
                critical: custom.connections?.critical ?? defaults.connections.critical
            },
            eventLoopLag: {
                elevated: custom.eventLoopLag?.elevated ?? defaults.eventLoopLag.elevated,
                high: custom.eventLoopLag?.high ?? defaults.eventLoopLag.high,
                critical: custom.eventLoopLag?.critical ?? defaults.eventLoopLag.critical
            }
        };
    }
}