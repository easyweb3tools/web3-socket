/**
 * Event loop optimizer for improving Node.js performance
 * This utility provides functions to optimize event loop utilization
 */
import { cpus } from 'os';
import { Logger } from '../logger';

/**
 * Event loop optimizer options
 */
export interface EventLoopOptimizerOptions {
    /**
     * Check interval in milliseconds
     */
    checkIntervalMs?: number;

    /**
     * High lag threshold in milliseconds
     */
    highLagThresholdMs?: number;

    /**
     * Critical lag threshold in milliseconds
     */
    criticalLagThresholdMs?: number;

    /**
     * Whether to enable automatic optimization
     */
    enableAutoOptimization?: boolean;

    /**
     * Callback function to execute when lag exceeds threshold
     */
    onHighLag?: (lag: number) => void;

    /**
     * Callback function to execute when lag exceeds critical threshold
     */
    onCriticalLag?: (lag: number) => void;
}

/**
 * Default event loop optimizer options
 */
const DEFAULT_OPTIONS: Required<EventLoopOptimizerOptions> = {
    checkIntervalMs: 5000,
    highLagThresholdMs: 100,
    criticalLagThresholdMs: 500,
    enableAutoOptimization: true,
    onHighLag: () => { },
    onCriticalLag: () => { }
};

/**
 * Event loop optimizer class
 */
export class EventLoopOptimizer {
    private options: Required<EventLoopOptimizerOptions>;
    private checkInterval: NodeJS.Timeout | null = null;
    private lastCheckTime: number = Date.now();
    private currentLag: number = 0;
    private logger: Logger;
    private cpuCount: number;

    /**
     * Create a new event loop optimizer
     * 
     * @param logger Logger instance
     * @param options Event loop optimizer options
     */
    constructor(logger: Logger, options: EventLoopOptimizerOptions = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.logger = logger.child({ module: 'EventLoopOptimizer' });
        this.cpuCount = cpus().length;
    }

    /**
     * Start monitoring event loop lag
     */
    public start(): void {
        if (this.checkInterval) {
            return;
        }

        this.logger.info('Starting event loop monitoring', {
            checkIntervalMs: this.options.checkIntervalMs,
            highLagThresholdMs: this.options.highLagThresholdMs,
            criticalLagThresholdMs: this.options.criticalLagThresholdMs,
            enableAutoOptimization: this.options.enableAutoOptimization
        });

        this.checkInterval = setInterval(() => this.checkEventLoopLag(), this.options.checkIntervalMs);
    }

    /**
     * Stop monitoring event loop lag
     */
    public stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            this.logger.info('Stopped event loop monitoring');
        }
    }

    /**
     * Check event loop lag
     */
    private checkEventLoopLag(): void {
        const start = Date.now();
        const checkTime = this.lastCheckTime;
        this.lastCheckTime = start;

        // Use setImmediate to measure event loop lag
        setImmediate(() => {
            const lag = Date.now() - start;
            this.currentLag = lag;

            // Calculate time since last check
            const timeSinceLastCheck = start - checkTime;

            // Log lag if significant
            if (lag >= this.options.highLagThresholdMs) {
                this.logger.warn(`High event loop lag detected: ${lag}ms`, {
                    lag: lag,
                    timeSinceLastCheck: timeSinceLastCheck
                } as any);

                // Execute high lag callback
                this.options.onHighLag(lag);

                // Apply automatic optimizations if enabled
                if (this.options.enableAutoOptimization) {
                    this.applyOptimizations(lag);
                }
            }

            // Handle critical lag
            if (lag >= this.options.criticalLagThresholdMs) {
                this.logger.error(`Critical event loop lag detected: ${lag}ms`, {
                    lag: lag,
                    timeSinceLastCheck: timeSinceLastCheck
                } as any);

                // Execute critical lag callback
                this.options.onCriticalLag(lag);
            }
        });
    }

    /**
     * Apply automatic optimizations
     * 
     * @param lag Current event loop lag in milliseconds
     */
    private applyOptimizations(lag: number): void {
        // Run garbage collection if available
        if (global.gc) {
            this.logger.info('Running garbage collection');
            global.gc();
        }

        // Suggest optimizations based on lag severity
        if (lag >= this.options.criticalLagThresholdMs) {
            this.logger.warn('Critical lag detected, consider reducing workload or scaling horizontally');
        }
    }

    /**
     * Get current event loop lag
     * 
     * @returns Promise that resolves with the current lag in milliseconds
     */
    public async getCurrentLag(): Promise<number> {
        return new Promise((resolve) => {
            const start = Date.now();
            setImmediate(() => {
                const lag = Date.now() - start;
                resolve(lag);
            });
        });
    }

    /**
     * Get event loop utilization
     * This uses Node.js performance API if available
     * 
     * @returns Event loop utilization or null if not available
     */
    public getEventLoopUtilization(): { idle: number, active: number, utilization: number } | null {
        // Check if performance API is available
        const perf = process as any;
        if (perf.performance?.eventLoopUtilization) {
            const elu = perf.performance.eventLoopUtilization();
            return {
                idle: elu.idle,
                active: elu.active,
                utilization: elu.utilization
            };
        }

        return null;
    }

    /**
     * Defer CPU-intensive work to avoid blocking the event loop
     * 
     * @param work Function to execute
     * @param priority Priority (higher means lower priority)
     * @returns Promise that resolves with the result of the work
     */
    public async deferWork<T>(work: () => T, priority: number = 1): Promise<T> {
        // For very low priority work, use setImmediate multiple times
        for (let i = 0; i < priority; i++) {
            await new Promise(resolve => setImmediate(resolve));
        }

        // Execute the work
        return work();
    }

    /**
     * Break up CPU-intensive work into smaller chunks
     * 
     * @param items Items to process
     * @param processor Function to process each item
     * @param chunkSize Number of items to process in each chunk
     * @param delayMs Delay between chunks in milliseconds
     * @returns Promise that resolves when all items are processed
     */
    public async processInChunks<T, R>(
        items: T[],
        processor: (item: T) => Promise<R>,
        chunkSize: number = 100,
        delayMs: number = 0
    ): Promise<R[]> {
        const results: R[] = [];

        // Process items in chunks
        for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);

            // Process chunk
            const chunkResults = await Promise.all(chunk.map(processor));
            results.push(...chunkResults);

            // Add delay between chunks if specified
            if (delayMs > 0 && i + chunkSize < items.length) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else if (i + chunkSize < items.length) {
                // Yield to event loop even without delay
                await new Promise(resolve => setImmediate(resolve));
            }
        }

        return results;
    }

    /**
     * Get system information
     * 
     * @returns System information
     */
    public getSystemInfo(): {
        cpuCount: number;
        currentLag: number;
        memoryUsage: NodeJS.MemoryUsage;
        eventLoopUtilization: { idle: number, active: number, utilization: number } | null;
    } {
        return {
            cpuCount: this.cpuCount,
            currentLag: this.currentLag,
            memoryUsage: process.memoryUsage(),
            eventLoopUtilization: this.getEventLoopUtilization()
        };
    }
}

// Add global.gc type definition
declare global {
    namespace NodeJS {
        interface Global {
            gc?: () => void;
        }
    }

}