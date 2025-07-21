import { MessageBatcher, MessageBatchManager } from '../utils/message-batcher';

// Mock timers
jest.useFakeTimers();

describe('Message Batcher', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should batch messages', async () => {
        // Mock batch handler
        const onBatchReady = jest.fn().mockResolvedValue(undefined);

        // Create batcher
        const batcher = new MessageBatcher({
            maxBatchSize: 3,
            maxDelayMs: 100,
            onBatchReady
        });

        // Add messages
        await batcher.add({ id: 1, text: 'Message 1' });
        await batcher.add({ id: 2, text: 'Message 2' });

        // Verify batch is not processed yet
        expect(onBatchReady).not.toHaveBeenCalled();

        // Add one more message to reach max batch size
        await batcher.add({ id: 3, text: 'Message 3' });

        // Verify batch is processed
        expect(onBatchReady).toHaveBeenCalledWith([
            { id: 1, text: 'Message 1' },
            { id: 2, text: 'Message 2' },
            { id: 3, text: 'Message 3' }
        ]);
    });

    it('should flush batch after delay', async () => {
        // Mock batch handler
        const onBatchReady = jest.fn().mockResolvedValue(undefined);

        // Create batcher
        const batcher = new MessageBatcher({
            maxBatchSize: 10,
            maxDelayMs: 100,
            onBatchReady
        });

        // Add messages
        await batcher.add({ id: 1, text: 'Message 1' });
        await batcher.add({ id: 2, text: 'Message 2' });

        // Verify batch is not processed yet
        expect(onBatchReady).not.toHaveBeenCalled();

        // Fast-forward time
        jest.advanceTimersByTime(100);

        // Verify batch is processed
        expect(onBatchReady).toHaveBeenCalledWith([
            { id: 1, text: 'Message 1' },
            { id: 2, text: 'Message 2' }
        ]);
    });

    it('should flush batch when payload size exceeds limit', async () => {
        // Mock batch handler
        const onBatchReady = jest.fn().mockResolvedValue(undefined);

        // Create batcher with small payload limit
        const batcher = new MessageBatcher({
            maxBatchSize: 10,
            maxDelayMs: 100,
            maxPayloadBytes: 50, // Small limit to force flush
            onBatchReady
        });

        // Add message with large payload
        await batcher.add({ id: 1, text: 'This is a message with a large payload that should exceed the limit' });

        // Verify batch is processed
        expect(onBatchReady).toHaveBeenCalledWith([
            { id: 1, text: 'This is a message with a large payload that should exceed the limit' }
        ]);

        // Reset mock
        onBatchReady.mockClear();

        // Add more messages
        await batcher.add({ id: 2, text: 'Message 2' });
        await batcher.add({ id: 3, text: 'Message 3' });

        // Verify batch is not processed yet
        expect(onBatchReady).not.toHaveBeenCalled();

        // Add message with large payload
        await batcher.add({ id: 4, text: 'This is another message with a large payload that should exceed the limit' });

        // Verify first batch is processed
        expect(onBatchReady).toHaveBeenCalledWith([
            { id: 2, text: 'Message 2' },
            { id: 3, text: 'Message 3' }
        ]);

        // Reset mock
        onBatchReady.mockClear();

        // Fast-forward time
        jest.advanceTimersByTime(100);

        // Verify second batch is processed
        expect(onBatchReady).toHaveBeenCalledWith([
            { id: 4, text: 'This is another message with a large payload that should exceed the limit' }
        ]);
    });

    it('should manually flush batch', async () => {
        // Mock batch handler
        const onBatchReady = jest.fn().mockResolvedValue(undefined);

        // Create batcher
        const batcher = new MessageBatcher({
            maxBatchSize: 10,
            maxDelayMs: 100,
            onBatchReady
        });

        // Add messages
        await batcher.add({ id: 1, text: 'Message 1' });
        await batcher.add({ id: 2, text: 'Message 2' });

        // Verify batch is not processed yet
        expect(onBatchReady).not.toHaveBeenCalled();

        // Manually flush batch
        await batcher.flush();

        // Verify batch is processed
        expect(onBatchReady).toHaveBeenCalledWith([
            { id: 1, text: 'Message 1' },
            { id: 2, text: 'Message 2' }
        ]);
    });

    it('should handle errors in batch processing', async () => {
        // Mock batch handler that fails
        const onBatchReady = jest.fn().mockRejectedValue(new Error('Batch processing failed'));

        // Mock console.error
        const originalConsoleError = console.error;
        console.error = jest.fn();

        try {
            // Create batcher
            const batcher = new MessageBatcher({
                maxBatchSize: 2,
                maxDelayMs: 100,
                onBatchReady
            });

            // Add messages
            await batcher.add({ id: 1, text: 'Message 1' });
            await batcher.add({ id: 2, text: 'Message 2' });

            // Verify batch processing was attempted
            expect(onBatchReady).toHaveBeenCalledWith([
                { id: 1, text: 'Message 1' },
                { id: 2, text: 'Message 2' }
            ]);

            // Verify error was logged
            expect(console.error).toHaveBeenCalled();

            // Verify messages are re-added to the batch
            expect(batcher.getBatchLength()).toBe(2);

            // Reset mock
            onBatchReady.mockClear();
            onBatchReady.mockResolvedValue(undefined);

            // Manually flush batch
            await batcher.flush();

            // Verify batch is processed
            expect(onBatchReady).toHaveBeenCalledWith([
                { id: 1, text: 'Message 1' },
                { id: 2, text: 'Message 2' }
            ]);
        } finally {
            // Restore console.error
            console.error = originalConsoleError;
        }
    });

    it('should clear batch', async () => {
        // Mock batch handler
        const onBatchReady = jest.fn().mockResolvedValue(undefined);

        // Create batcher
        const batcher = new MessageBatcher({
            maxBatchSize: 10,
            maxDelayMs: 100,
            onBatchReady
        });

        // Add messages
        await batcher.add({ id: 1, text: 'Message 1' });
        await batcher.add({ id: 2, text: 'Message 2' });

        // Verify batch is not empty
        expect(batcher.isEmpty()).toBe(false);
        expect(batcher.getBatchLength()).toBe(2);

        // Clear batch
        batcher.clear();

        // Verify batch is empty
        expect(batcher.isEmpty()).toBe(true);
        expect(batcher.getBatchLength()).toBe(0);

        // Fast-forward time
        jest.advanceTimersByTime(100);

        // Verify batch was not processed
        expect(onBatchReady).not.toHaveBeenCalled();
    });
});

describe('Message Batch Manager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should manage multiple batchers', async () => {
        // Mock batch handlers
        const onBatchReady1 = jest.fn().mockResolvedValue(undefined);
        const onBatchReady2 = jest.fn().mockResolvedValue(undefined);

        // Create batch manager
        const manager = new MessageBatchManager({
            maxBatchSize: 2,
            maxDelayMs: 100
        });

        // Get batchers for different targets
        const batcher1 = manager.getBatcher('target1', { onBatchReady: onBatchReady1 });
        const batcher2 = manager.getBatcher('target2', { onBatchReady: onBatchReady2 });

        // Add messages to target1
        await batcher1.add({ id: 1, text: 'Message 1 for target1' });
        await batcher1.add({ id: 2, text: 'Message 2 for target1' });

        // Add messages to target2
        await batcher2.add({ id: 1, text: 'Message 1 for target2' });

        // Verify batch1 is processed
        expect(onBatchReady1).toHaveBeenCalledWith([
            { id: 1, text: 'Message 1 for target1' },
            { id: 2, text: 'Message 2 for target1' }
        ]);

        // Verify batch2 is not processed yet
        expect(onBatchReady2).not.toHaveBeenCalled();

        // Fast-forward time
        jest.advanceTimersByTime(100);

        // Verify batch2 is processed
        expect(onBatchReady2).toHaveBeenCalledWith([
            { id: 1, text: 'Message 1 for target2' }
        ]);
    });

    it('should add messages directly through manager', async () => {
        // Mock batch handler
        const onBatchReady = jest.fn().mockResolvedValue(undefined);

        // Create batch manager
        const manager = new MessageBatchManager({
            maxBatchSize: 2,
            maxDelayMs: 100,
            onBatchReady
        });

        // Add messages to different targets
        await manager.add('target1', { id: 1, text: 'Message 1 for target1' });
        await manager.add('target1', { id: 2, text: 'Message 2 for target1' });
        await manager.add('target2', { id: 1, text: 'Message 1 for target2' });

        // Verify batch for target1 is processed
        expect(onBatchReady).toHaveBeenCalledWith([
            { id: 1, text: 'Message 1 for target1' },
            { id: 2, text: 'Message 2 for target1' }
        ]);

        // Reset mock
        onBatchReady.mockClear();

        // Fast-forward time
        jest.advanceTimersByTime(100);

        // Verify batch for target2 is processed
        expect(onBatchReady).toHaveBeenCalledWith([
            { id: 1, text: 'Message 1 for target2' }
        ]);
    });

    it('should flush all batches', async () => {
        // Mock batch handlers
        const onBatchReady1 = jest.fn().mockResolvedValue(undefined);
        const onBatchReady2 = jest.fn().mockResolvedValue(undefined);

        // Create batch manager
        const manager = new MessageBatchManager();

        // Get batchers for different targets
        const batcher1 = manager.getBatcher('target1', { onBatchReady: onBatchReady1 });
        const batcher2 = manager.getBatcher('target2', { onBatchReady: onBatchReady2 });

        // Add messages
        await batcher1.add({ id: 1, text: 'Message 1 for target1' });
        await batcher2.add({ id: 1, text: 'Message 1 for target2' });

        // Verify batches are not processed yet
        expect(onBatchReady1).not.toHaveBeenCalled();
        expect(onBatchReady2).not.toHaveBeenCalled();

        // Flush all batches
        await manager.flushAll();

        // Verify batches are processed
        expect(onBatchReady1).toHaveBeenCalledWith([
            { id: 1, text: 'Message 1 for target1' }
        ]);
        expect(onBatchReady2).toHaveBeenCalledWith([
            { id: 1, text: 'Message 1 for target2' }
        ]);
    });

    it('should clear all batches', async () => {
        // Mock batch handlers
        const onBatchReady1 = jest.fn().mockResolvedValue(undefined);
        const onBatchReady2 = jest.fn().mockResolvedValue(undefined);

        // Create batch manager
        const manager = new MessageBatchManager();

        // Get batchers for different targets
        const batcher1 = manager.getBatcher('target1', { onBatchReady: onBatchReady1 });
        const batcher2 = manager.getBatcher('target2', { onBatchReady: onBatchReady2 });

        // Add messages
        await batcher1.add({ id: 1, text: 'Message 1 for target1' });
        await batcher2.add({ id: 1, text: 'Message 1 for target2' });

        // Verify batches are not empty
        expect(batcher1.isEmpty()).toBe(false);
        expect(batcher2.isEmpty()).toBe(false);

        // Clear all batches
        manager.clearAll();

        // Verify batches are empty
        expect(batcher1.isEmpty()).toBe(true);
        expect(batcher2.isEmpty()).toBe(true);

        // Fast-forward time
        jest.advanceTimersByTime(100);

        // Verify batches were not processed
        expect(onBatchReady1).not.toHaveBeenCalled();
        expect(onBatchReady2).not.toHaveBeenCalled();
    });

    it('should get targets and batcher count', async () => {
        // Create batch manager
        const manager = new MessageBatchManager();

        // Get batchers for different targets
        manager.getBatcher('target1');
        manager.getBatcher('target2');
        manager.getBatcher('target3');

        // Verify targets
        expect(manager.getTargets()).toEqual(['target1', 'target2', 'target3']);
        expect(manager.getBatcherCount()).toBe(3);
    });
});