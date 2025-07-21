/**
 * Message batcher for optimizing message delivery
 * This utility batches messages to reduce overhead and improve performance
 */

/**
 * Message batch options
 */
export interface MessageBatchOptions {
    /**
     * Maximum batch size (number of messages)
     */
    maxBatchSize?: number;

    /**
     * Maximum batch delay in milliseconds
     */
    maxDelayMs?: number;

    /**
     * Maximum payload size in bytes
     */
    maxPayloadBytes?: number;

    /**
     * Whether to enable compression for large batches
     */
    enableCompression?: boolean;

    /**
     * Compression threshold in bytes
     */
    compressionThresholdBytes?: number;

    /**
     * Callback function to execute when a batch is ready
     */
    onBatchReady?: (batch: any[]) => Promise<void>;
}

/**
 * Default message batch options
 */
const DEFAULT_BATCH_OPTIONS: Required<MessageBatchOptions> = {
    maxBatchSize: 100,
    maxDelayMs: 50,
    maxPayloadBytes: 1024 * 1024, // 1MB
    enableCompression: true,
    compressionThresholdBytes: 10 * 1024, // 10KB
    onBatchReady: async () => { }
};

/**
 * Message batcher class
 */
export class MessageBatcher<T = any> {
    private options: Required<MessageBatchOptions>;
    private batch: T[] = [];
    private batchSize: number = 0;
    private timer: NodeJS.Timeout | null = null;
    private processing: boolean = false;

    /**
     * Create a new message batcher
     * 
     * @param options Message batch options
     */
    constructor(options: MessageBatchOptions = {}) {
        this.options = { ...DEFAULT_BATCH_OPTIONS, ...options };
    }

    /**
     * Add a message to the batch
     * 
     * @param message Message to add
     * @returns Promise that resolves when the message is processed
     */
    public async add(message: T): Promise<void> {
        // Calculate message size
        const messageSize = this.getMessageSize(message);

        // Check if adding this message would exceed the max payload size
        if (this.batchSize + messageSize > this.options.maxPayloadBytes) {
            // Process current batch before adding this message
            await this.flush();
        }

        // Add message to batch
        this.batch.push(message);
        this.batchSize += messageSize;

        // Start timer if not already started
        if (!this.timer && !this.processing) {
            this.timer = setTimeout(() => this.flush(), this.options.maxDelayMs);
        }

        // Check if batch is full
        if (this.batch.length >= this.options.maxBatchSize) {
            await this.flush();
        }
    }

    /**
     * Flush the batch
     * 
     * @returns Promise that resolves when the batch is processed
     */
    public async flush(): Promise<void> {
        // Clear timer
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        // Skip if batch is empty or already processing
        if (this.batch.length === 0 || this.processing) {
            return;
        }

        // Mark as processing
        this.processing = true;

        // Get current batch
        const currentBatch = [...this.batch];

        // Clear batch
        this.batch = [];
        this.batchSize = 0;

        try {
            // Process batch
            await this.options.onBatchReady(currentBatch);
        } catch (error) {
            console.error('Error processing batch:', error);

            // Re-add failed messages to the batch
            // This could lead to out-of-order delivery, but ensures messages aren't lost
            for (const message of currentBatch) {
                await this.add(message);
            }
        } finally {
            // Mark as not processing
            this.processing = false;

            // Check if there are more messages to process
            if (this.batch.length > 0) {
                // Start timer for next batch
                this.timer = setTimeout(() => this.flush(), this.options.maxDelayMs);
            }
        }
    }

    /**
     * Get the size of a message in bytes
     * 
     * @param message Message to measure
     * @returns Size in bytes
     */
    private getMessageSize(message: any): number {
        try {
            // Convert message to JSON string and get its length
            const json = JSON.stringify(message);
            return Buffer.byteLength(json, 'utf8');
        } catch (error) {
            // If serialization fails, use a conservative estimate
            return 1024; // 1KB
        }
    }

    /**
     * Get the current batch
     */
    public getBatch(): T[] {
        return [...this.batch];
    }

    /**
     * Get the current batch size in bytes
     */
    public getBatchSize(): number {
        return this.batchSize;
    }

    /**
     * Get the current batch length
     */
    public getBatchLength(): number {
        return this.batch.length;
    }

    /**
     * Check if the batch is empty
     */
    public isEmpty(): boolean {
        return this.batch.length === 0;
    }

    /**
     * Clear the batch
     */
    public clear(): void {
        this.batch = [];
        this.batchSize = 0;

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
}

/**
 * Create a message batcher for a specific target
 * 
 * @param target Target identifier
 * @param options Message batch options
 * @returns Message batcher instance
 */
export function createMessageBatcher<T>(
    target: string,
    options: MessageBatchOptions = {}
): MessageBatcher<T> {
    return new MessageBatcher<T>(options);
}

/**
 * Message batch manager
 * Manages multiple message batchers for different targets
 */
export class MessageBatchManager<T = any> {
    private batchers: Map<string, MessageBatcher<T>> = new Map();
    private defaultOptions: MessageBatchOptions;

    /**
     * Create a new message batch manager
     * 
     * @param defaultOptions Default message batch options
     */
    constructor(defaultOptions: MessageBatchOptions = {}) {
        this.defaultOptions = defaultOptions;
    }

    /**
     * Get or create a batcher for a target
     * 
     * @param target Target identifier
     * @param options Message batch options (overrides default options)
     * @returns Message batcher instance
     */
    public getBatcher(target: string, options: MessageBatchOptions = {}): MessageBatcher<T> {
        if (!this.batchers.has(target)) {
            this.batchers.set(
                target,
                new MessageBatcher<T>({ ...this.defaultOptions, ...options })
            );
        }

        return this.batchers.get(target)!;
    }

    /**
     * Add a message to a target batch
     * 
     * @param target Target identifier
     * @param message Message to add
     * @returns Promise that resolves when the message is processed
     */
    public async add(target: string, message: T): Promise<void> {
        const batcher = this.getBatcher(target);
        await batcher.add(message);
    }

    /**
     * Flush a target batch
     * 
     * @param target Target identifier
     * @returns Promise that resolves when the batch is processed
     */
    public async flush(target: string): Promise<void> {
        if (this.batchers.has(target)) {
            await this.batchers.get(target)!.flush();
        }
    }

    /**
     * Flush all batches
     * 
     * @returns Promise that resolves when all batches are processed
     */
    public async flushAll(): Promise<void> {
        const promises = Array.from(this.batchers.values()).map(batcher => batcher.flush());
        await Promise.all(promises);
    }

    /**
     * Clear a target batch
     * 
     * @param target Target identifier
     */
    public clear(target: string): void {
        if (this.batchers.has(target)) {
            this.batchers.get(target)!.clear();
        }
    }

    /**
     * Clear all batches
     */
    public clearAll(): void {
        for (const batcher of this.batchers.values()) {
            batcher.clear();
        }
    }

    /**
     * Get all targets
     */
    public getTargets(): string[] {
        return Array.from(this.batchers.keys());
    }

    /**
     * Get the number of batchers
     */
    public getBatcherCount(): number {
        return this.batchers.size;
    }
}