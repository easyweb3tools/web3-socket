import { BackendService } from '../api/backend-service';
import axios from 'axios';
import { CircuitState } from '../utils/retry-with-backoff';
import { BackendServiceError, TimeoutError } from '../errors/error-types';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock timers
jest.useFakeTimers();

describe('Backend Service', () => {
    // Mock logger
    const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        child: jest.fn().mockReturnValue({
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        })
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock axios.create to return a mocked instance
        mockedAxios.create.mockReturnValue(mockedAxios as any);
    });

    it('should initialize with default options', () => {
        // Create backend service
        const backendService = new BackendService(mockLogger as any);

        // Verify axios.create was called with default options
        expect(mockedAxios.create).toHaveBeenCalledWith({
            baseURL: 'http://localhost:8080',
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    });

    it('should initialize with custom options', () => {
        // Create backend service with custom options
        const backendService = new BackendService(mockLogger as any, {
            baseUrl: 'https://api.example.com',
            timeoutMs: 10000,
            defaultHeaders: {
                'Content-Type': 'application/json',
                'X-API-Key': 'test-key'
            }
        });

        // Verify axios.create was called with custom options
        expect(mockedAxios.create).toHaveBeenCalledWith({
            baseURL: 'https://api.example.com',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': 'test-key'
            }
        });
    });

    it('should make successful GET request', async () => {
        // Mock successful response
        const mockResponse = { data: { success: true } };
        mockedAxios.request.mockResolvedValueOnce(mockResponse);

        // Create backend service
        const backendService = new BackendService(mockLogger as any);

        // Make GET request
        const response = await backendService.get('/test');

        // Verify axios.request was called with correct parameters
        expect(mockedAxios.request).toHaveBeenCalledWith({
            method: 'GET',
            url: '/test'
        });

        // Verify response
        expect(response).toBe(mockResponse);
    });

    it('should make successful POST request', async () => {
        // Mock successful response
        const mockResponse = { data: { success: true } };
        mockedAxios.request.mockResolvedValueOnce(mockResponse);

        // Create backend service
        const backendService = new BackendService(mockLogger as any);

        // Make POST request
        const response = await backendService.post('/test', { foo: 'bar' });

        // Verify axios.request was called with correct parameters
        expect(mockedAxios.request).toHaveBeenCalledWith({
            method: 'POST',
            url: '/test',
            data: { foo: 'bar' }
        });

        // Verify response
        expect(response).toBe(mockResponse);
    });

    it('should retry on network errors', async () => {
        // Mock network error then success
        const networkError = new Error('Network Error');
        (networkError as any).isAxiosError = true;

        const mockResponse = { data: { success: true } };
        mockedAxios.request
            .mockRejectedValueOnce(networkError)
            .mockResolvedValueOnce(mockResponse);

        // Create backend service
        const backendService = new BackendService(mockLogger as any, {
            maxRetries: 1,
            initialDelayMs: 100
        });

        // Make request
        const responsePromise = backendService.get('/test');

        // Fast-forward timers for retry
        jest.advanceTimersByTime(100);

        // Wait for response
        const response = await responsePromise;

        // Verify axios.request was called twice
        expect(mockedAxios.request).toHaveBeenCalledTimes(2);

        // Verify response
        expect(response).toBe(mockResponse);
    });

    it('should retry on 5xx errors', async () => {
        // Mock 500 error then success
        const serverError = new Error('Internal Server Error');
        (serverError as any).isAxiosError = true;
        (serverError as any).response = { status: 500, statusText: 'Internal Server Error' };

        const mockResponse = { data: { success: true } };
        mockedAxios.request
            .mockRejectedValueOnce(serverError)
            .mockResolvedValueOnce(mockResponse);

        // Create backend service
        const backendService = new BackendService(mockLogger as any, {
            maxRetries: 1,
            initialDelayMs: 100
        });

        // Make request
        const responsePromise = backendService.get('/test');

        // Fast-forward timers for retry
        jest.advanceTimersByTime(100);

        // Wait for response
        const response = await responsePromise;

        // Verify axios.request was called twice
        expect(mockedAxios.request).toHaveBeenCalledTimes(2);

        // Verify response
        expect(response).toBe(mockResponse);
    });

    it('should not retry on 4xx errors', async () => {
        // Mock 400 error
        const clientError = new Error('Bad Request');
        (clientError as any).isAxiosError = true;
        (clientError as any).response = { status: 400, statusText: 'Bad Request', data: { error: 'Invalid input' } };

        mockedAxios.request.mockRejectedValueOnce(clientError);

        // Create backend service
        const backendService = new BackendService(mockLogger as any, {
            maxRetries: 3,
            initialDelayMs: 100
        });

        // Make request and expect it to fail
        await expect(backendService.get('/test')).rejects.toThrow(BackendServiceError);

        // Verify axios.request was called only once
        expect(mockedAxios.request).toHaveBeenCalledTimes(1);
    });

    it('should transform timeout errors', async () => {
        // Mock timeout error
        const timeoutError = new Error('timeout of 5000ms exceeded');
        (timeoutError as any).isAxiosError = true;
        (timeoutError as any).code = 'ECONNABORTED';

        mockedAxios.request.mockRejectedValueOnce(timeoutError);

        // Create backend service
        const backendService = new BackendService(mockLogger as any, {
            maxRetries: 0
        });

        // Make request and expect it to fail with TimeoutError
        await expect(backendService.get('/test')).rejects.toThrow(TimeoutError);
    });

    it('should open circuit after failure threshold', async () => {
        // Mock network errors
        const networkError = new Error('Network Error');
        (networkError as any).isAxiosError = true;

        mockedAxios.request.mockRejectedValue(networkError);

        // Create backend service with low threshold
        const backendService = new BackendService(mockLogger as any, {
            maxRetries: 0,
            circuitBreakerFailureThreshold: 2
        });

        // Make requests until circuit opens
        await expect(backendService.get('/test')).rejects.toThrow(BackendServiceError);
        await expect(backendService.get('/test')).rejects.toThrow(BackendServiceError);

        // Next request should fail fast with circuit open error
        await expect(backendService.get('/test')).rejects.toThrow('Backend service is unavailable (circuit open)');

        // Verify axios.request was called only twice
        expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    });

    it('should reset circuit breaker', async () => {
        // Mock network errors
        const networkError = new Error('Network Error');
        (networkError as any).isAxiosError = true;

        mockedAxios.request.mockRejectedValue(networkError);

        // Create backend service with low threshold
        const backendService = new BackendService(mockLogger as any, {
            maxRetries: 0,
            circuitBreakerFailureThreshold: 1
        });

        // Make request to open circuit
        await expect(backendService.get('/test')).rejects.toThrow(BackendServiceError);

        // Next request should fail fast with circuit open error
        await expect(backendService.get('/test')).rejects.toThrow('Backend service is unavailable (circuit open)');

        // Reset circuit breaker
        backendService.resetCircuitBreaker();

        // Verify circuit state is closed
        expect(backendService.getCircuitBreakerState()).toBe(CircuitState.CLOSED);

        // Next request should try again
        await expect(backendService.get('/test')).rejects.toThrow(BackendServiceError);

        // Verify axios.request was called again
        expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    });

    it('should check if backend service is healthy', async () => {
        // Mock successful response
        mockedAxios.request.mockResolvedValueOnce({ data: { status: 'ok' } });

        // Create backend service
        const backendService = new BackendService(mockLogger as any);

        // Check health
        const isHealthy = await backendService.isHealthy();

        // Verify axios.request was called with correct parameters
        expect(mockedAxios.request).toHaveBeenCalledWith({
            method: 'GET',
            url: '/health'
        });

        // Verify result
        expect(isHealthy).toBe(true);
    });

    it('should return false if backend service is unhealthy', async () => {
        // Mock error response
        const error = new Error('Service Unavailable');
        (error as any).isAxiosError = true;
        (error as any).response = { status: 503, statusText: 'Service Unavailable' };

        mockedAxios.request.mockRejectedValueOnce(error);

        // Create backend service
        const backendService = new BackendService(mockLogger as any);

        // Check health
        const isHealthy = await backendService.isHealthy();

        // Verify result
        expect(isHealthy).toBe(false);
    });
});
it('should use distributed retry when enabled', async () => {
    // Mock Redis client
    const mockRedisClient = {
        set: jest.fn().mockResolvedValue('OK')
    };

    // Mock network error then success
    const networkError = new Error('Network Error');
    (networkError as any).isAxiosError = true;

    const mockResponse = { data: { success: true } };
    mockedAxios.request
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockResponse);

    // Create backend service with distributed retry
    const backendService = new BackendService(mockLogger as any, {
        maxRetries: 1,
        initialDelayMs: 100,
        useDistributedRetries: true,
        redisClient: mockRedisClient,
        instanceId: 'test-instance'
    });

    // Make request
    const responsePromise = backendService.get('/test');

    // Fast-forward timers for retry
    jest.advanceTimersByTime(100);

    // Wait for response
    const response = await responsePromise;

    // Verify axios.request was called twice
    expect(mockedAxios.request).toHaveBeenCalledTimes(2);

    // Verify Redis set was called for distributed retry
    expect(mockRedisClient.set).toHaveBeenCalled();
    expect(mockRedisClient.set.mock.calls[0][0]).toMatch(/^retry:GET:\/test:/);

    // Verify response
    expect(response).toBe(mockResponse);
});

it('should fall back to regular retry if Redis fails', async () => {
    // Mock Redis client that fails
    const mockRedisClient = {
        set: jest.fn().mockRejectedValue(new Error('Redis error'))
    };

    // Mock network error then success
    const networkError = new Error('Network Error');
    (networkError as any).isAxiosError = true;

    const mockResponse = { data: { success: true } };
    mockedAxios.request
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockResponse);

    // Create backend service with distributed retry
    const backendService = new BackendService(mockLogger as any, {
        maxRetries: 1,
        initialDelayMs: 100,
        useDistributedRetries: true,
        redisClient: mockRedisClient,
        instanceId: 'test-instance'
    });

    // Make request
    const responsePromise = backendService.get('/test');

    // Fast-forward timers for retry
    jest.advanceTimersByTime(100);

    // Wait for response
    const response = await responsePromise;

    // Verify axios.request was called twice
    expect(mockedAxios.request).toHaveBeenCalledTimes(2);

    // Verify Redis set was called
    expect(mockRedisClient.set).toHaveBeenCalled();

    // Verify response
    expect(response).toBe(mockResponse);
});

it('should use regular retry when distributed retry is disabled', async () => {
    // Mock Redis client
    const mockRedisClient = {
        set: jest.fn().mockResolvedValue('OK')
    };

    // Mock network error then success
    const networkError = new Error('Network Error');
    (networkError as any).isAxiosError = true;

    const mockResponse = { data: { success: true } };
    mockedAxios.request
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockResponse);

    // Create backend service with distributed retry disabled
    const backendService = new BackendService(mockLogger as any, {
        maxRetries: 1,
        initialDelayMs: 100,
        useDistributedRetries: false,
        redisClient: mockRedisClient,
        instanceId: 'test-instance'
    });

    // Make request
    const responsePromise = backendService.get('/test');

    // Fast-forward timers for retry
    jest.advanceTimersByTime(100);

    // Wait for response
    const response = await responsePromise;

    // Verify axios.request was called twice
    expect(mockedAxios.request).toHaveBeenCalledTimes(2);

    // Verify Redis set was NOT called
    expect(mockRedisClient.set).not.toHaveBeenCalled();

    // Verify response
    expect(response).toBe(mockResponse);
});
});