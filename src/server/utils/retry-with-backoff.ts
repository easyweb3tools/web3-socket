/**
 * Retry utility with exponential backoff
 * This utility provides functions to retry operations with exponential backoff
 */

/**
 * Retry options
 */
export interface RetryOptions {
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

    /**
     * Backoff factor (multiplier for each retry)
     */
    backoffFactor?: number;

    /**
     * Jitter factor (0-1) to add randomness to delay
     */
    jitterFactor?: number;

    /**
     * Function to determine if an error is retryable
     */
    isRetryable?: (error: Error) => boolean;

    /**
     * Callback function to execute before each retry
     */
    onRetry?: (error: Error, attempt: number, delay: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 10000,
    backoffFactor: 2,
    jitterFactor: 0.1,
    isRetryable: () => true,
    onRetry: () => { }
};

/**
 * Retry a function with exponential backoff
 * 
 * @param fn Function to retry
 * @param options Retry options
 * @returns Promise that resolves with the function result or rejects with the last error
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    // Merge options with defaults
    const opts: Required<RetryOptions> = {
        ...DEFAULT_RETRY_OPTIONS,
        ...options
    };

    let lastError: Error;

    // Try the operation up to maxRetries + 1 times (initial attempt + retries)
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            // Execute the function
            return await fn();
        } catch (error) {
            lastError = error as Error;

            // Check if we've reached the maximum number of retries
            if (attempt >= opts.maxRetries) {
                break;
            }

            // Check if the error is retryable
            if (!opts.isRetryable(lastError)) {
                break;
            }

            // Calculate delay with exponential backoff and jitter
            const baseDelay = opts.initialDelayMs * Math.pow(opts.backoffFactor, attempt);
            const jitter = opts.jitterFactor * baseDelay * (Math.random() * 2 - 1);
            const delay = Math.min(opts.maxDelayMs, baseDelay + jitter);

            // Execute onRetry callback
            opts.onRetry(lastError, attempt + 1, delay);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // If we get here, all retries failed
    throw lastError;
}

/**
 * Circuit breaker state
 */
export enum CircuitState {
    CLOSED, // Normal operation, requests go through
    OPEN,   // Circuit is open, requests fail fast
    HALF_OPEN // Testing if the service is back
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
    /**
     * Failure threshold (number of failures before opening circuit)
     */
    failureThreshold?: number;

    /**
     * Reset timeout in milliseconds (time before trying half-open state)
     */
    resetTimeoutMs?: number;

    /**
     * Function to determine if an error should count as a failure
     */
    isFailure?: (error: Error) => boolean;

    /**
     * Callback function to execute when circuit state changes
     */
    onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

/**
 * Default circuit breaker options
 */
const DEFAULT_CIRCUIT_BREAKER_OPTIONS: Required<CircuitBreakerOptions> = {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    isFailure: () => true,
    onStateChange: () => { }
};

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private options: Required<CircuitBreakerOptions>;

    /**
     * Create a new circuit breaker
     * 
     * @param options Circuit breaker options
     */
    constructor(options: CircuitBreakerOptions = {}) {
        this.options = {
            ...DEFAULT_CIRCUIT_BREAKER_OPTIONS,
            ...options
        };
    }

    /**
     * Execute a function with circuit breaker protection
     * 
     * @param fn Function to execute
     * @returns Promise that resolves with the function result or rejects with an error
     */
    public async execute<T>(fn: () => Promise<T>): Promise<T> {
        // Check if circuit is open
        if (this.state === CircuitState.OPEN) {
            // Check if it's time to try half-open state
            if (Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs) {
                this.transitionTo(CircuitState.HALF_OPEN);
            } else {
                throw new Error('Circuit is open');
            }
        }

        try {
            // Execute the function
            const result = await fn();

            // If successful and in half-open state, close the circuit
            if (this.state === CircuitState.HALF_OPEN) {
                this.transitionTo(CircuitState.CLOSED);
            }

            // Reset failure count on success
            this.failureCount = 0;

            return result;
        } catch (error) {
            // Handle failure
            return this.handleFailure(error as Error);
        }
    }

    /**
     * Handle a failure
     * 
     * @param error Error that occurred
     */
    private handleFailure<T>(error: Error): never {
        // Check if this error counts as a failure
        if (this.options.isFailure(error)) {
            this.failureCount++;
            this.lastFailureTime = Date.now();

            // If we've reached the failure threshold, open the circuit
            if (
                (this.state === CircuitState.CLOSED && this.failureCount >= this.options.failureThreshold) ||
                this.state === CircuitState.HALF_OPEN
            ) {
                this.transitionTo(CircuitState.OPEN);
            }
        }

        // Re-throw the error
        throw error;
    }

    /**
     * Transition to a new state
     * 
     * @param newState New circuit state
     */
    private transitionTo(newState: CircuitState): void {
        if (this.state !== newState) {
            const oldState = this.state;
            this.state = newState;
            this.options.onStateChange(oldState, newState);
        }
    }

    /**
     * Get the current circuit state
     */
    public getState(): CircuitState {
        return this.state;
    }

    /**
     * Reset the circuit breaker to closed state
     */
    public reset(): void {
        this.transitionTo(CircuitState.CLOSED);
        this.failureCount = 0;
    }
}

/**
 * Distributed retry options
 * Used for coordinating retries across multiple instances
 */
export interface DistributedRetryOptions extends RetryOptions {
    /**
     * Unique key for this operation (used for coordination)
     */
    key: string;

    /**
     * Redis client for coordination
     */
    redisClient: any;

    /**
     * TTL for retry lock in seconds
     */
    lockTtlSeconds?: number;

    /**
     * Whether to use instance-specific jitter
     */
    useInstanceJitter?: boolean;

    /**
     * Instance ID (used for jitter calculation)
     */
    instanceId?: string;
}

/**
 * Default distributed retry options
 */
const DEFAULT_DISTRIBUTED_RETRY_OPTIONS: Partial<DistributedRetryOptions> = {
    lockTtlSeconds: 60,
    useInstanceJitter: true
};

/**
 * Retry a function with exponential backoff, coordinated across multiple instances
 * This prevents the "thundering herd" problem when multiple instances try to retry at the same time
 * 
 * @param fn Function to retry
 * @param options Distributed retry options
 * @returns Promise that resolves with the function result or rejects with the last error
 */
export async function distributedRetryWithBackoff<T>(
    fn: () => Promise<T>,
    options: DistributedRetryOptions
): Promise<T> {
    // Merge options with defaults
    const opts: Required<RetryOptions> & DistributedRetryOptions = {
        ...DEFAULT_RETRY_OPTIONS,
        ...DEFAULT_DISTRIBUTED_RETRY_OPTIONS,
        ...options
    };

    if (!opts.redisClient) {
        throw new Error('Redis client is required for distributed retry');
    }

    let lastError: Error;

    // Try the operation up to maxRetries + 1 times (initial attempt + retries)
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            // Execute the function
            return await fn();
        } catch (error) {
            lastError = error as Error;

            // Check if we've reached the maximum number of retries
            if (attempt >= opts.maxRetries) {
                break;
            }

            // Check if the error is retryable
            if (!opts.isRetryable(lastError)) {
                break;
            }

            // Calculate base delay with exponential backoff
            const baseDelay = opts.initialDelayMs * Math.pow(opts.backoffFactor, attempt);

            // Add instance-specific jitter if enabled
            let jitter = opts.jitterFactor * baseDelay * (Math.random() * 2 - 1);

            if (opts.useInstanceJitter && opts.instanceId) {
                // Use instance ID to create deterministic jitter
                const instanceNumber = parseInt(opts.instanceId.replace(/\D/g, '').substring(0, 4) || '0', 10);
                const instanceJitter = (instanceNumber % 100) / 100; // 0-1 range
                jitter += baseDelay * instanceJitter * 0.5; // Add up to 50% more jitter based on instance ID
            }

            const delay = Math.min(opts.maxDelayMs, baseDelay + jitter);

            // Execute onRetry callback
            opts.onRetry(lastError, attempt + 1, delay);

            // Coordinate retry with Redis
            const lockKey = `retry:${opts.key}:${attempt}`;
            const lockValue = Date.now().toString();

            try {
                // Try to acquire lock with TTL
                const acquired = await opts.redisClient.set(
                    lockKey,
                    lockValue,
                    'NX',
                    'EX',
                    opts.lockTtlSeconds
                );

                if (acquired) {
                    // This instance is the first to retry, wait the full delay
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // Another instance is already retrying, add some jitter and wait less time
                    const reducedDelay = delay * 0.5 + (Math.random() * delay * 0.3);
                    await new Promise(resolve => setTimeout(resolve, reducedDelay));
                }
            } catch (redisError) {
                // If Redis fails, fall back to regular retry
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // If we get here, all retries failed
    throw lastError;
}