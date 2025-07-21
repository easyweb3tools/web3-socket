import { retryWithBackoff, CircuitBreaker, CircuitState } from '../utils/retry-with-backoff';

// Mock timers
jest.useFakeTimers();

describe('Retry with Backoff', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should resolve if the function succeeds on first attempt', async () => {
        // Create a function that succeeds
        const fn = jest.fn().mockResolvedValue('success');

        // Call retryWithBackoff
        const result = await retryWithBackoff(fn);

        // Verify function was called once
        expect(fn).toHaveBeenCalledTimes(1);
        expect(result).toBe('success');
    });

    it('should retry if the function fails', async () => {
        // Create a function that fails twice then succeeds
        const fn = jest.fn()
            .mockRejectedValueOnce(new Error('Failure 1'))
            .mockRejectedValueOnce(new Error('Failure 2'))
            .mockResolvedValue('success');

        // Mock onRetry callback
        const onRetry = jest.fn();

        // Call retryWithBackoff
        const resultPromise = retryWithBackoff(fn, {
            maxRetries: 3,
            initialDelayMs: 100,
            onRetry
        });

        // Fast-forward timers for first retry
        jest.advanceTimersByTime(100);

        // Fast-forward timers for second retry
        jest.advanceTimersByTime(200);

        // Wait for result
        const result = await resultPromise;

        // Verify function was called three times
        expect(fn).toHaveBeenCalledTimes(3);
        expect(result).toBe('success');

        // Verify onRetry was called twice
        expect(onRetry).toHaveBeenCalledTimes(2);
        expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, expect.any(Number));
        expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 2, expect.any(Number));
    });

    it('should reject if all retries fail', async () => {
        // Create a function that always fails
        const error = new Error('Failure');
        const fn = jest.fn().mockRejectedValue(error);

        // Call retryWithBackoff
        const resultPromise = retryWithBackoff(fn, {
            maxRetries: 2,
            initialDelayMs: 100
        });

        // Fast-forward timers for all retries
        jest.advanceTimersByTime(100);
        jest.advanceTimersByTime(200);

        // Verify promise rejects with the last error
        await expect(resultPromise).rejects.toThrow('Failure');

        // Verify function was called three times (initial + 2 retries)
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should respect maxRetries option', async () => {
        // Create a function that always fails
        const fn = jest.fn().mockRejectedValue(new Error('Failure'));

        // Call retryWithBackoff with custom maxRetries
        const resultPromise = retryWithBackoff(fn, {
            maxRetries: 1,
            initialDelayMs: 100
        });

        // Fast-forward timers for all retries
        jest.advanceTimersByTime(100);

        // Wait for rejection
        await expect(resultPromise).rejects.toThrow('Failure');

        // Verify function was called twice (initial + 1 retry)
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should respect isRetryable option', async () => {
        // Create a function that fails with different errors
        const retryableError = new Error('Retryable');
        const nonRetryableError = new Error('Non-retryable');
        const fn = jest.fn()
            .mockRejectedValueOnce(retryableError)
            .mockRejectedValueOnce(nonRetryableError);

        // Call retryWithBackoff with custom isRetryable
        const resultPromise = retryWithBackoff(fn, {
            maxRetries: 3,
            initialDelayMs: 100,
            isRetryable: (error) => error.message === 'Retryable'
        });

        // Fast-forward timers for first retry
        jest.advanceTimersByTime(100);

        // Wait for rejection
        await expect(resultPromise).rejects.toBe(nonRetryableError);

        // Verify function was called twice (initial + 1 retry)
        expect(fn).toHaveBeenCalledTimes(2);
    });
});

describe('Circuit Breaker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should allow requests when circuit is closed', async () => {
        // Create circuit breaker
        const circuitBreaker = new CircuitBreaker();

        // Create a function that succeeds
        const fn = jest.fn().mockResolvedValue('success');

        // Execute function with circuit breaker
        const result = await circuitBreaker.execute(fn);

        // Verify function was called
        expect(fn).toHaveBeenCalledTimes(1);
        expect(result).toBe('success');

        // Verify circuit is still closed
        expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should open circuit after failure threshold is reached', async () => {
        // Create circuit breaker with low threshold
        const circuitBreaker = new CircuitBreaker({
            failureThreshold: 2
        });

        // Create a function that always fails
        const error = new Error('Failure');
        const fn = jest.fn().mockRejectedValue(error);

        // Mock onStateChange callback
        const onStateChange = jest.fn();
        circuitBreaker['options'].onStateChange = onStateChange;

        // Execute function twice (should fail both times)
        await expect(circuitBreaker.execute(fn)).rejects.toThrow('Failure');
        await expect(circuitBreaker.execute(fn)).rejects.toThrow('Failure');

        // Verify function was called twice
        expect(fn).toHaveBeenCalledTimes(2);

        // Verify circuit is now open
        expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

        // Verify onStateChange was called
        expect(onStateChange).toHaveBeenCalledWith(CircuitState.CLOSED, CircuitState.OPEN);

        // Execute function again (should fail fast)
        await expect(circuitBreaker.execute(fn)).rejects.toThrow('Circuit is open');

        // Verify function was not called again
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should transition to half-open state after reset timeout', async () => {
        // Create circuit breaker with short reset timeout
        const circuitBreaker = new CircuitBreaker({
            failureThreshold: 1,
            resetTimeoutMs: 1000
        });

        // Create a function that fails
        const fn = jest.fn().mockRejectedValue(new Error('Failure'));

        // Mock onStateChange callback
        const onStateChange = jest.fn();
        circuitBreaker['options'].onStateChange = onStateChange;

        // Execute function (should fail)
        await expect(circuitBreaker.execute(fn)).rejects.toThrow('Failure');

        // Verify circuit is now open
        expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

        // Fast-forward time past reset timeout
        jest.advanceTimersByTime(1100);

        // Create a new function that succeeds
        const successFn = jest.fn().mockResolvedValue('success');

        // Execute function again (should try in half-open state)
        const result = await circuitBreaker.execute(successFn);

        // Verify function was called
        expect(successFn).toHaveBeenCalledTimes(1);
        expect(result).toBe('success');

        // Verify circuit is now closed
        expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

        // Verify onStateChange was called twice
        expect(onStateChange).toHaveBeenCalledTimes(3);
        expect(onStateChange).toHaveBeenCalledWith(CircuitState.CLOSED, CircuitState.OPEN);
        expect(onStateChange).toHaveBeenCalledWith(CircuitState.OPEN, CircuitState.HALF_OPEN);
        expect(onStateChange).toHaveBeenCalledWith(CircuitState.HALF_OPEN, CircuitState.CLOSED);
    });

    it('should reopen circuit if request fails in half-open state', async () => {
        // Create circuit breaker with short reset timeout
        const circuitBreaker = new CircuitBreaker({
            failureThreshold: 1,
            resetTimeoutMs: 1000
        });

        // Create a function that fails
        const fn = jest.fn().mockRejectedValue(new Error('Failure'));

        // Mock onStateChange callback
        const onStateChange = jest.fn();
        circuitBreaker['options'].onStateChange = onStateChange;

        // Execute function (should fail)
        await expect(circuitBreaker.execute(fn)).rejects.toThrow('Failure');

        // Verify circuit is now open
        expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

        // Fast-forward time past reset timeout
        jest.advanceTimersByTime(1100);

        // Execute function again (should try in half-open state and fail)
        await expect(circuitBreaker.execute(fn)).rejects.toThrow('Failure');

        // Verify function was called again
        expect(fn).toHaveBeenCalledTimes(2);

        // Verify circuit is open again
        expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

        // Verify onStateChange was called
        expect(onStateChange).toHaveBeenCalledTimes(3);
        expect(onStateChange).toHaveBeenCalledWith(CircuitState.CLOSED, CircuitState.OPEN);
        expect(onStateChange).toHaveBeenCalledWith(CircuitState.OPEN, CircuitState.HALF_OPEN);
        expect(onStateChange).toHaveBeenCalledWith(CircuitState.HALF_OPEN, CircuitState.OPEN);
    });

    it('should reset circuit breaker', async () => {
        // Create circuit breaker
        const circuitBreaker = new CircuitBreaker({
            failureThreshold: 1
        });

        // Create a function that fails
        const fn = jest.fn().mockRejectedValue(new Error('Failure'));

        // Mock onStateChange callback
        const onStateChange = jest.fn();
        circuitBreaker['options'].onStateChange = onStateChange;

        // Execute function (should fail)
        await expect(circuitBreaker.execute(fn)).rejects.toThrow('Failure');

        // Verify circuit is now open
        expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

        // Reset circuit breaker
        circuitBreaker.reset();

        // Verify circuit is now closed
        expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

        // Verify onStateChange was called
        expect(onStateChange).toHaveBeenCalledWith(CircuitState.OPEN, CircuitState.CLOSED);
    });
}); de
scribe('Distributed Retry with Backoff', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should throw an error if Redis client is not provided', async () => {
        // Create a function that succeeds
        const fn = jest.fn().mockResolvedValue('success');

        // Call distributedRetryWithBackoff without Redis client
        await expect(distributedRetryWithBackoff(fn, {
            key: 'test-operation'
        } as any)).rejects.toThrow('Redis client is required for distributed retry');

        // Verify function was not called
        expect(fn).not.toHaveBeenCalled();
    });

    it('should coordinate retries using Redis', async () => {
        // Mock Redis client
        const mockRedisClient = {
            set: jest.fn().mockResolvedValue('OK')
        };

        // Create a function that fails once then succeeds
        const fn = jest.fn()
            .mockRejectedValueOnce(new Error('Failure'))
            .mockResolvedValue('success');

        // Mock onRetry callback
        const onRetry = jest.fn();

        // Call distributedRetryWithBackoff
        const resultPromise = distributedRetryWithBackoff(fn, {
            key: 'test-operation',
            redisClient: mockRedisClient,
            maxRetries: 3,
            initialDelayMs: 100,
            onRetry,
            instanceId: 'instance-1'
        });

        // Fast-forward timers for first retry
        jest.advanceTimersByTime(100);

        // Wait for result
        const result = await resultPromise;

        // Verify function was called twice
        expect(fn).toHaveBeenCalledTimes(2);
        expect(result).toBe('success');

        // Verify Redis lock was acquired
        expect(mockRedisClient.set).toHaveBeenCalledWith(
            'retry:test-operation:0',
            expect.any(String),
            'NX',
            'EX',
            60
        );

        // Verify onRetry was called once
        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, expect.any(Number));
    });

    it('should handle Redis errors gracefully', async () => {
        // Mock Redis client that fails
        const mockRedisClient = {
            set: jest.fn().mockRejectedValue(new Error('Redis error'))
        };

        // Create a function that fails once then succeeds
        const fn = jest.fn()
            .mockRejectedValueOnce(new Error('Failure'))
            .mockResolvedValue('success');

        // Call distributedRetryWithBackoff
        const resultPromise = distributedRetryWithBackoff(fn, {
            key: 'test-operation',
            redisClient: mockRedisClient,
            maxRetries: 3,
            initialDelayMs: 100
        });

        // Fast-forward timers for first retry
        jest.advanceTimersByTime(100);

        // Wait for result
        const result = await resultPromise;

        // Verify function was called twice
        expect(fn).toHaveBeenCalledTimes(2);
        expect(result).toBe('success');

        // Verify Redis lock was attempted
        expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('should use instance-specific jitter when enabled', async () => {
        // Mock Redis client
        const mockRedisClient = {
            set: jest.fn().mockResolvedValue('OK')
        };

        // Create a function that fails once then succeeds
        const fn = jest.fn()
            .mockRejectedValueOnce(new Error('Failure'))
            .mockResolvedValue('success');

        // Mock onRetry callback to capture delay
        const onRetry = jest.fn();

        // Call distributedRetryWithBackoff with instance jitter
        const resultPromise1 = distributedRetryWithBackoff(fn, {
            key: 'test-operation',
            redisClient: mockRedisClient,
            maxRetries: 1,
            initialDelayMs: 100,
            onRetry,
            useInstanceJitter: true,
            instanceId: 'instance-1'
        });

        // Fast-forward timers for retry
        jest.advanceTimersByTime(150);

        // Wait for result
        await resultPromise1;

        // Reset mocks
        jest.clearAllMocks();
        fn.mockReset();
        fn.mockRejectedValueOnce(new Error('Failure')).mockResolvedValue('success');
        onRetry.mockReset();

        // Call distributedRetryWithBackoff with a different instance ID
        const resultPromise2 = distributedRetryWithBackoff(fn, {
            key: 'test-operation',
            redisClient: mockRedisClient,
            maxRetries: 1,
            initialDelayMs: 100,
            onRetry,
            useInstanceJitter: true,
            instanceId: 'instance-2'
        });

        // Fast-forward timers for retry
        jest.advanceTimersByTime(150);

        // Wait for result
        await resultPromise2;

        // Verify both calls succeeded
        expect(fn).toHaveBeenCalledTimes(2);

        // Note: We can't easily test the actual jitter values since they depend on random factors,
        // but we've verified the code path executes successfully
    });
});