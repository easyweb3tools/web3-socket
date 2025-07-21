import { LoadManager, LoadLevel } from '../utils/load-manager';
import os from 'os';

// Mock os module
jest.mock('os', () => ({
    cpus: jest.fn(),
    totalmem: jest.fn(),
    freemem: jest.fn()
}));

// Mock timers
jest.useFakeTimers();

describe('Load Manager', () => {
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

    // Mock connection count function
    const mockGetConnectionCount = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock os.cpus
        const mockCpuInfo = [
            {
                model: 'Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz',
                speed: 2600,
                times: { user: 1000, nice: 0, sys: 500, idle: 8500, irq: 0 }
            },
            {
                model: 'Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz',
                speed: 2600,
                times: { user: 1000, nice: 0, sys: 500, idle: 8500, irq: 0 }
            }
        ];

        (os.cpus as jest.Mock).mockReturnValue(mockCpuInfo);

        // Mock os.totalmem and os.freemem
        (os.totalmem as jest.Mock).mockReturnValue(16 * 1024 * 1024 * 1024); // 16GB
        (os.freemem as jest.Mock).mockReturnValue(8 * 1024 * 1024 * 1024); // 8GB

        // Mock connection count
        mockGetConnectionCount.mockReturnValue(100);
    });

    it('should initialize with default options', () => {
        // Create load manager
        const loadManager = new LoadManager(mockLogger as any, mockGetConnectionCount);

        // Verify initialization
        expect(mockLogger.child).toHaveBeenCalledWith({ module: 'LoadManager' });
        expect(mockLogger.child().info).toHaveBeenCalledWith('Load manager initialized', expect.any(Object));
    });

    it('should start and stop load monitoring', () => {
        // Create load manager with short check interval
        const loadManager = new LoadManager(mockLogger as any, mockGetConnectionCount, {
            checkIntervalMs: 1000
        });

        // Start monitoring
        loadManager.start();

        // Verify logger called
        expect(mockLogger.child().info).toHaveBeenCalledWith('Load monitoring started');

        // Verify setInterval was called
        expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);

        // Stop monitoring
        loadManager.stop();

        // Verify logger called
        expect(mockLogger.child().info).toHaveBeenCalledWith('Load monitoring stopped');
    });

    it('should check load and determine load level', async () => {
        // Create load manager
        const loadManager = new LoadManager(mockLogger as any, mockGetConnectionCount);

        // Mock Date.now for event loop lag calculation
        const originalDateNow = Date.now;
        Date.now = jest.fn()
            .mockReturnValueOnce(1000) // First call in getEventLoopLag
            .mockReturnValueOnce(1010); // Second call in getEventLoopLag (10ms lag)

        // Check load
        const state = await loadManager.checkLoad();

        // Restore Date.now
        Date.now = originalDateNow;

        // Verify state
        expect(state.level).toBe(LoadLevel.NORMAL);
        expect(state.cpuUsage).toBeGreaterThanOrEqual(0);
        expect(state.memoryUsage).toBeCloseTo(50); // 8GB free out of 16GB total = 50% usage
        expect(state.connectionCount).toBe(100);
        expect(state.eventLoopLag).toBeGreaterThanOrEqual(0);
        expect(state.throttlingActive).toBe(false);
    });

    it('should emit event when load level changes', async () => {
        // Create load manager
        const loadManager = new LoadManager(mockLogger as any, mockGetConnectionCount);

        // Mock event listener
        const onLoadLevelChanged = jest.fn();
        loadManager.on('loadLevelChanged', onLoadLevelChanged);

        // Initial load check (NORMAL)
        await loadManager.checkLoad();

        // Change connection count to trigger ELEVATED load level
        mockGetConnectionCount.mockReturnValue(2000);

        // Check load again
        await loadManager.checkLoad();

        // Verify event was emitted
        expect(onLoadLevelChanged).toHaveBeenCalledWith(expect.objectContaining({
            level: LoadLevel.ELEVATED,
            connectionCount: 2000
        }));

        // Verify logger called
        expect(mockLogger.child().info).toHaveBeenCalledWith(
            'Load level changed from normal to elevated',
            expect.any(Object)
        );
    });

    it('should apply throttling when load is critical', async () => {
        // Create load manager with auto throttling enabled
        const loadManager = new LoadManager(mockLogger as any, mockGetConnectionCount, {
            enableAutoThrottling: true
        });

        // Mock event listener
        const onThrottlingChanged = jest.fn();
        loadManager.on('throttlingChanged', onThrottlingChanged);

        // Change connection count to trigger CRITICAL load level
        mockGetConnectionCount.mockReturnValue(15000);

        // Check load
        await loadManager.checkLoad();

        // Verify throttling was enabled
        expect(loadManager.getState().throttlingActive).toBe(true);

        // Verify event was emitted
        expect(onThrottlingChanged).toHaveBeenCalled();

        // Verify logger called
        expect(mockLogger.child().info).toHaveBeenCalledWith(
            'Connection throttling enabled',
            expect.any(Object)
        );
        expect(mockLogger.child().info).toHaveBeenCalledWith(
            'Message throttling enabled',
            expect.any(Object)
        );
    });

    it('should reject connections when throttling is active', async () => {
        // Create load manager
        const loadManager = new LoadManager(mockLogger as any, mockGetConnectionCount);

        // Enable connection throttling
        loadManager.setConnectionThrottling(true);

        // Set connection count above limit
        mockGetConnectionCount.mockReturnValue(1500);

        // Check if connection should be allowed
        const shouldAllow = loadManager.shouldAllowConnection();

        // Verify connection is rejected
        expect(shouldAllow).toBe(false);
    });

    it('should allow connections when below limit', async () => {
        // Create load manager
        const loadManager = new LoadManager(mockLogger as any, mockGetConnectionCount, {
            maxConnectionsUnderLoad: 2000
        });

        // Enable connection throttling
        loadManager.setConnectionThrottling(true);

        // Set connection count below limit
        mockGetConnectionCount.mockReturnValue(1500);

        // Check if connection should be allowed
        const shouldAllow = loadManager.shouldAllowConnection();

        // Verify connection is allowed
        expect(shouldAllow).toBe(true);
    });

    it('should throttle messages when message throttling is active', () => {
        // Create load manager
        const loadManager = new LoadManager(mockLogger as any, mockGetConnectionCount, {
            maxMessageRateUnderLoad: 5
        });

        // Enable message throttling
        loadManager.setMessageThrottling(true);

        // Send messages
        const userId = 'user123';
        const eventName = 'chat:message';

        // First 5 messages should be allowed
        for (let i = 0; i < 5; i++) {
            expect(loadManager.shouldAllowMessage(userId, eventName)).toBe(true);
            loadManager.incrementMessageCounter(userId, eventName);
        }

        // 6th message should be throttled
        expect(loadManager.shouldAllowMessage(userId, eventName)).toBe(false);

        // Reset counters
        loadManager['resetMessageCounters']();

        // Messages should be allowed again
        expect(loadManager.shouldAllowMessage(userId, eventName)).toBe(true);
    });

    it('should set custom message rate limits', () => {
        // Create load manager
        const loadManager = new LoadManager(mockLogger as any, mockGetConnectionCount, {
            maxMessageRateUnderLoad: 5
        });

        // Enable message throttling
        loadManager.setMessageThrottling(true);

        // Set custom rate limit for specific event
        loadManager.setMessageRateLimit('chat:message', 10);

        // Send messages
        const userId = 'user123';
        const eventName = 'chat:message';

        // First 10 messages should be allowed (custom limit)
        for (let i = 0; i < 10; i++) {
            expect(loadManager.shouldAllowMessage(userId, eventName)).toBe(true);
            loadManager.incrementMessageCounter(userId, eventName);
        }

        // 11th message should be throttled
        expect(loadManager.shouldAllowMessage(userId, eventName)).toBe(false);
    });
});