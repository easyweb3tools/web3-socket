import { EventLoopOptimizer } from '../utils/event-loop-optimizer';

// Mock timers
jest.useFakeTimers();

describe('Event Loop Optimizer', () => {
    // Mock logger
    const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        child: jest.fn().mockReturnValue({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        })
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should initialize with default options', () => {
        const optimizer = new EventLoopOptimizer(mockLogger as any);
        expect(optimizer).toBeDefined();
    });

    it('should start and stop monitoring', () => {
        const optimizer = new EventLoopOptimizer(mockLogger as any);

        // Start monitoring
        optimizer.start();

        // Verify logger was called
        expect(mockLogger.child().info).toHaveBeenCalledWith('Starting event loop monitoring', expect.any(Object));

        // Stop monitoring
        optimizer.stop();

        // Verify logger was called
        expect(mockLogger.child().info).toHaveBeenCalledWith('Stopped event loop monitoring');
    });

    it('should measure current lag', async () => {
        const optimizer = new EventLoopOptimizer(mockLogger as any);

        // Mock setImmediate to simulate lag
        jest.spyOn(global, 'setImmediate').mockImplementation((callback: any) => {
            setTimeout(callback, 5);
            return 0 as any;
        });

        // Measure lag
        const lag = await optimizer.getCurrentLag();

        // Verify lag is a number
        expect(typeof lag).toBe('number');

        // Restore original setImmediate
        (global.setImmediate as jest.Mock).mockRestore();
    });

    it('should process items in chunks', async () => {
        const optimizer = new EventLoopOptimizer(mockLogger as any);

        // Create test items
        const items = Array.from({ length: 100 }, (_, i) => i);

        // Create processor function
        const processor = jest.fn().mockImplementation(async (item: number) => item * 2);

        // Process items in chunks
        const results = await optimizer.processInChunks(items, processor, 10);

        // Verify processor was called for each item
        expect(processor).toHaveBeenCalledTimes(100);

        // Verify results
        expect(results).toHaveLength(100);
        expect(results[0]).toBe(0);
        expect(results[99]).toBe(198);
    });

    it('should defer work', async () => {
        const optimizer = new EventLoopOptimizer(mockLogger as any);

        // Create work function
        const work = jest.fn().mockReturnValue(42);

        // Defer work
        const result = await optimizer.deferWork(work);

        // Verify work was called
        expect(work).toHaveBeenCalled();

        // Verify result
        expect(result).toBe(42);
    });

    it('should get system information', () => {
        const optimizer = new EventLoopOptimizer(mockLogger as any);

        // Get system info
        const info = optimizer.getSystemInfo();

        // Verify info
        expect(info.cpuCount).toBeGreaterThan(0);
        expect(typeof info.currentLag).toBe('number');
        expect(info.memoryUsage).toBeDefined();
    });
});