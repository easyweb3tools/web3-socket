import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Logger } from '../logger';
import { retryWithBackoff, distributedRetryWithBackoff, CircuitBreaker, CircuitState } from '../utils/retry-with-backoff';
import { BackendServiceError, TimeoutError } from '../errors/error-types';

/**
 * Backend service options
 */
export interface BackendServiceOptions {
    /**
     * Base URL for the backend service
     */
    baseUrl: string;

    /**
     * Request timeout in milliseconds
     */
    timeoutMs?: number;

    /**
     * Maximum number of retry attempts
     */
    maxRetries?: number;

    /**
     * Initial delay in milliseconds for retries
     */
    initialDelayMs?: number;

    /**
     * Circuit breaker failure threshold
     */
    circuitBreakerFailureThreshold?: number;

    /**
     * Circuit breaker reset timeout in milliseconds
     */
    circuitBreakerResetTimeoutMs?: number;

    /**
     * Default headers to include in all requests
     */
    defaultHeaders?: Record<string, string>;

    /**
     * Redis client for distributed retries
     */
    redisClient?: any;

    /**
     * Instance ID for distributed retries
     */
    instanceId?: string;

    /**
     * Whether to use distributed retries
     */
    useDistributedRetries?: boolean;

    /**
     * Connection pool options
     */
    connectionPool?: {
        /**
         * Maximum number of concurrent connections
         */
        maxConnections?: number;

        /**
         * Maximum number of requests per connection
         */
        maxRequestsPerConnection?: number;

        /**
         * Connection timeout in milliseconds
         */
        connectionTimeoutMs?: number;

        /**
         * Whether to enable keep-alive
         */
        keepAlive?: boolean;

        /**
         * Keep-alive timeout in milliseconds
         */
        keepAliveTimeoutMs?: number;
    };
}

/**
 * Default backend service options
 */
const DEFAULT_OPTIONS: BackendServiceOptions = {
    baseUrl: 'http://localhost:8080',
    timeoutMs: 5000,
    maxRetries: 3,
    initialDelayMs: 100,
    circuitBreakerFailureThreshold: 5,
    circuitBreakerResetTimeoutMs: 30000,
    defaultHeaders: {
        'Content-Type': 'application/json'
    },
    connectionPool: {
        maxConnections: 100,
        maxRequestsPerConnection: 1000,
        connectionTimeoutMs: 60000,
        keepAlive: true,
        keepAliveTimeoutMs: 60000
    }
};

/**
 * Backend service client
 * Handles communication with the backend service with retry and circuit breaker patterns
 */
export class BackendService {
    private client: AxiosInstance;
    private circuitBreaker: CircuitBreaker;
    private logger: Logger;
    private options: BackendServiceOptions;

    /**
     * Create a new backend service client
     * 
     * @param logger Logger instance
     * @param options Backend service options
     */
    constructor(logger: Logger, options: Partial<BackendServiceOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.logger = logger.child({ module: 'BackendService' });

        // Configure connection pooling
        const http = require('http');
        const https = require('https');

        const isHttps = this.options.baseUrl.startsWith('https');
        const poolConfig = this.options.connectionPool || {};

        // Create HTTP/HTTPS agent with connection pooling
        const agent = isHttps
            ? new https.Agent({
                keepAlive: poolConfig.keepAlive !== false,
                keepAliveMsecs: poolConfig.keepAliveTimeoutMs || 60000,
                maxSockets: poolConfig.maxConnections || 100,
                maxFreeSockets: Math.max(10, (poolConfig.maxConnections || 100) / 2),
                timeout: poolConfig.connectionTimeoutMs || 60000
            })
            : new http.Agent({
                keepAlive: poolConfig.keepAlive !== false,
                keepAliveMsecs: poolConfig.keepAliveTimeoutMs || 60000,
                maxSockets: poolConfig.maxConnections || 100,
                maxFreeSockets: Math.max(10, (poolConfig.maxConnections || 100) / 2),
                timeout: poolConfig.connectionTimeoutMs || 60000
            });

        // Create Axios client with connection pooling
        this.client = axios.create({
            baseURL: this.options.baseUrl,
            timeout: this.options.timeoutMs,
            headers: this.options.defaultHeaders,
            httpAgent: !isHttps ? agent : undefined,
            httpsAgent: isHttps ? agent : undefined,
            maxRedirects: 5
        });

        // Log connection pool configuration
        this.logger.info('Connection pool configured', {
            isHttps,
            keepAlive: poolConfig.keepAlive !== false,
            maxConnections: poolConfig.maxConnections || 100,
            connectionTimeoutMs: poolConfig.connectionTimeoutMs || 60000
        });

        // Create circuit breaker
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: this.options.circuitBreakerFailureThreshold,
            resetTimeoutMs: this.options.circuitBreakerResetTimeoutMs,
            isFailure: (error: Error) => {
                // Consider all errors as failures except for 4xx responses (client errors)
                if (axios.isAxiosError(error) && error.response && error.response.status >= 400 && error.response.status < 500) {
                    return false;
                }
                return true;
            },
            onStateChange: (from: CircuitState, to: CircuitState) => {
                this.logger.warn(`Circuit breaker state changed from ${CircuitState[from]} to ${CircuitState[to]}`, {
                    baseUrl: this.options.baseUrl
                });
            }
        });

        this.logger.info('Backend service client initialized', {
            baseUrl: this.options.baseUrl,
            timeoutMs: this.options.timeoutMs,
            maxRetries: this.options.maxRetries
        });
    }

    /**
     * Send a request to the backend service with retry and circuit breaker
     * 
     * @param config Axios request config
     * @returns Promise that resolves with the response or rejects with an error
     */
    public async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        try {
            // Execute request with circuit breaker
            return await this.circuitBreaker.execute(async () => {
                // Create the request function
                const requestFn = async () => {
                    try {
                        return await this.client.request<T>(config);
                    } catch (error) {
                        // Transform Axios errors to application errors
                        if (axios.isAxiosError(error)) {
                            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                                throw new TimeoutError('Request timed out', {
                                    url: config.url,
                                    method: config.method
                                }, error);
                            }

                            if (error.response) {
                                // Server responded with an error status
                                throw new BackendServiceError(
                                    `Backend service error: ${error.response.status} ${error.response.statusText}`,
                                    {
                                        url: config.url,
                                        method: config.method,
                                        status: error.response.status,
                                        data: error.response.data
                                    },
                                    error
                                );
                            }

                            // Network error or other Axios error
                            throw new BackendServiceError(
                                `Backend service error: ${error.message}`,
                                {
                                    url: config.url,
                                    method: config.method
                                },
                                error
                            );
                        }

                        // Re-throw other errors
                        throw error;
                    }
                };

                // Common retry options
                const retryOptions = {
                    maxRetries: this.options.maxRetries,
                    initialDelayMs: this.options.initialDelayMs,
                    isRetryable: (error: Error) => {
                        // Only retry on network errors, timeouts, and 5xx responses
                        if (axios.isAxiosError(error)) {
                            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                                return true;
                            }

                            if (error.response && error.response.status >= 500) {
                                return true;
                            }

                            if (!error.response) {
                                // Network error
                                return true;
                            }

                            // Don't retry on 4xx responses (client errors)
                            return false;
                        }

                        return false;
                    },
                    onRetry: (error: Error, attempt: number, delay: number) => {
                        this.logger.warn(`Retrying request (attempt ${attempt})`, {
                            url: config.url,
                            method: config.method,
                            delay,
                            error: error.message,
                            distributed: this.options.useDistributedRetries
                        });
                    }
                };

                // Use distributed retry if enabled and Redis client is available
                if (this.options.useDistributedRetries && this.options.redisClient) {
                    // Generate a unique key for this request
                    const requestKey = `${config.method || 'GET'}:${config.url}:${Date.now().toString(36)}`;

                    this.logger.debug('Using distributed retry for request', {
                        url: config.url,
                        method: config.method,
                        requestKey
                    });

                    return await distributedRetryWithBackoff(requestFn, {
                        ...retryOptions,
                        key: requestKey,
                        redisClient: this.options.redisClient,
                        instanceId: this.options.instanceId,
                        useInstanceJitter: true
                    });
                } else {
                    // Use regular retry
                    return await retryWithBackoff(requestFn, retryOptions);
                }
            });
        } catch (error) {
            // Transform circuit breaker errors
            if ((error as Error).message === 'Circuit is open') {
                throw new BackendServiceError('Backend service is unavailable (circuit open)', {
                    url: config.url,
                    method: config.method
                });
            }

            // Re-throw other errors
            throw error;
        }
    }

    /**
     * Send a GET request to the backend service
     * 
     * @param url URL path
     * @param config Additional Axios request config
     * @returns Promise that resolves with the response or rejects with an error
     */
    public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.request<T>({ ...config, method: 'GET', url });
    }

    /**
     * Send a POST request to the backend service
     * 
     * @param url URL path
     * @param data Request body
     * @param config Additional Axios request config
     * @returns Promise that resolves with the response or rejects with an error
     */
    public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.request<T>({ ...config, method: 'POST', url, data });
    }

    /**
     * Send a PUT request to the backend service
     * 
     * @param url URL path
     * @param data Request body
     * @param config Additional Axios request config
     * @returns Promise that resolves with the response or rejects with an error
     */
    public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.request<T>({ ...config, method: 'PUT', url, data });
    }

    /**
     * Send a DELETE request to the backend service
     * 
     * @param url URL path
     * @param config Additional Axios request config
     * @returns Promise that resolves with the response or rejects with an error
     */
    public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.request<T>({ ...config, method: 'DELETE', url });
    }

    /**
     * Check if the backend service is healthy
     * 
     * @returns Promise that resolves with true if healthy or rejects with an error
     */
    public async isHealthy(): Promise<boolean> {
        try {
            await this.get('/health');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Reset the circuit breaker
     */
    public resetCircuitBreaker(): void {
        this.circuitBreaker.reset();
        this.logger.info('Circuit breaker reset');
    }

    /**
     * Get the current circuit breaker state
     */
    public getCircuitBreakerState(): CircuitState {
        return this.circuitBreaker.getState();
    }
}