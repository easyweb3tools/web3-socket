/**
 * Performance tests for Socket.IO server
 * These tests evaluate the performance of the server under various loads
 */
import { Server } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { createServer } from 'http';
import { EventLoopOptimizer } from '../utils/event-loop-optimizer';
import { MessageBatchManager } from '../utils/message-batcher';
import { BackendService } from '../api/backend-service';

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

describe('Performance Tests', () => {
    let httpServer: any;
    let ioServer: Server;
    let clientSockets: ClientSocket[] = [];
    let port: number;
    let eventLoopOptimizer: EventLoopOptimizer;
    let messageBatchManager: MessageBatchManager;
    let backendService: BackendService;

    beforeAll((done) => {
        // Create HTTP server
        httpServer = createServer();

        // Create Socket.IO server
        ioServer = new Server(httpServer);

        // Initialize event loop optimizer
        eventLoopOptimizer = new EventLoopOptimizer(mockLogger as any);

        // Initialize message batch manager
        messageBatchManager = new MessageBatchManager();

        // Initialize backend service
        backendService = new BackendService(mockLogger as any, {
            baseUrl: 'http://localhost:8080',
            connectionPool: {
                maxConnections: 100,
                keepAlive: true
            }
        });

        // Start server on random port
        httpServer.listen(() => {
            port = (httpServer.address() as any).port;
            done();
        });
    });

    afterAll((done) => {
        // Close all client connections
        clientSockets.forEach(socket => {
            socket.disconnect();
        });

        // Close server
        ioServer.close(() => {
            httpServer.close(done);
        });
    });

    /**
     * Helper function to create multiple client connections
     */
    async function createClients(count: number): Promise<ClientSocket[]> {
        const clients: ClientSocket[] = [];

        for (let i = 0; i < count; i++) {
            const socket = ioc(`http://localhost:${port}`, {
                transports: ['websocket'],
                forceNew: true
            });

            clients.push(socket);
            clientSockets.push(socket);

            // Wait for connection
            await new Promise<void>((resolve) => {
                socket.on('connect', () => {
                    resolve();
                });
            });
        }

        return clients;
    }

    /**
     * Helper function to measure execution time
     */
    async function measureTime(fn: () => Promise<void>): Promise<number> {
        const start = Date.now();
        await fn();
        return Date.now() - start;
    }

    /**
     * Test: Message throughput
     * Measures how many messages per second the server can handle
     */
    it('should handle high message throughput', async () => {
        // Skip in CI environment
        if (process.env.CI) {
            console.log('Skipping performance test in CI environment');
            return;
        }

        // Create test clients
        const clientCount = 10;
        const messageCount = 100;
        const clients = await createClients(clientCount);

        // Set up message handler on server
        let receivedCount = 0;
        ioServer.on('connection', (socket) => {
            socket.on('test:message', (data) => {
                receivedCount++;
                socket.emit('test:response', { received: true });
            });
        });

        // Measure time to send messages
        const duration = await measureTime(async () => {
            // Send messages from all clients
            const promises = clients.map(async (client) => {
                for (let i = 0; i < messageCount; i++) {
                    await new Promise<void>((resolve) => {
                        client.emit('test:message', { index: i });
                        client.once('test:response', () => {
                            resolve();
                        });
                    });
                }
            });

            // Wait for all messages to be sent and responses received
            await Promise.all(promises);
        });

        // Calculate messages per second
        const totalMessages = clientCount * messageCount;
        const messagesPerSecond = Math.round((totalMessages / duration) * 1000);

        console.log(`Message throughput: ${messagesPerSecond} messages/second`);
        console.log(`Total time: ${duration}ms for ${totalMessages} messages`);

        // Verify all messages were received
        expect(receivedCount).toBe(totalMessages);

        // Expect reasonable performance (adjust threshold based on environment)
        expect(messagesPerSecond).toBeGreaterThan(100);
    }, 30000);

    /**
     * Test: Connection scalability
     * Measures how quickly the server can handle multiple connections
     */
    it('should handle multiple connections efficiently', async () => {
        // Skip in CI environment
        if (process.env.CI) {
            console.log('Skipping performance test in CI environment');
            return;
        }

        // Measure time to create connections
        const connectionCount = 50;
        const duration = await measureTime(async () => {
            await createClients(connectionCount);
        });

        console.log(`Connection time: ${duration}ms for ${connectionCount} connections`);
        console.log(`Average connection time: ${Math.round(duration / connectionCount)}ms per connection`);

        // Expect reasonable performance (adjust threshold based on environment)
        expect(duration / connectionCount).toBeLessThan(100);
    }, 30000);

    /**
     * Test: Message batching performance
     * Measures the performance improvement from message batching
     */
    it('should improve performance with message batching', async () => {
        // Skip in CI environment
        if (process.env.CI) {
            console.log('Skipping performance test in CI environment');
            return;
        }

        // Create test client
        const client = (await createClients(1))[0];

        // Set up message handler on server
        ioServer.on('connection', (socket) => {
            socket.on('test:batch', (data) => {
                socket.emit('test:batch:response', { received: true });
            });
        });

        // Test without batching
        const withoutBatchingTime = await measureTime(async () => {
            for (let i = 0; i < 100; i++) {
                await new Promise<void>((resolve) => {
                    client.emit('test:batch', { index: i });
                    client.once('test:batch:response', () => {
                        resolve();
                    });
                });
            }
        });

        // Test with batching
        const batcher = messageBatchManager.getBatcher('test', {
            maxBatchSize: 10,
            maxDelayMs: 50,
            onBatchReady: async (batch) => {
                for (const message of batch) {
                    await new Promise<void>((resolve) => {
                        client.emit('test:batch', message);
                        client.once('test:batch:response', () => {
                            resolve();
                        });
                    });
                }
            }
        });

        const withBatchingTime = await measureTime(async () => {
            const promises = [];

            for (let i = 0; i < 100; i++) {
                promises.push(batcher.add({ index: i }));
            }

            await Promise.all(promises);
            await batcher.flush();
        });

        console.log(`Without batching: ${withoutBatchingTime}ms`);
        console.log(`With batching: ${withBatchingTime}ms`);
        console.log(`Performance improvement: ${Math.round((withoutBatchingTime - withBatchingTime) / withoutBatchingTime * 100)}%`);

        // Expect batching to be faster (or at least not significantly slower)
        expect(withBatchingTime).toBeLessThanOrEqual(withoutBatchingTime * 1.1);
    }, 30000);

    /**
     * Test: Event loop optimization
     * Measures the impact of event loop optimization on CPU-intensive tasks
     */
    it('should optimize CPU-intensive tasks', async () => {
        // Skip in CI environment
        if (process.env.CI) {
            console.log('Skipping performance test in CI environment');
            return;
        }

        // CPU-intensive function (calculate fibonacci)
        function fibonacci(n: number): number {
            if (n <= 1) return n;
            return fibonacci(n - 1) + fibonacci(n - 2);
        }

        // Test without optimization
        const withoutOptimizationTime = await measureTime(async () => {
            for (let i = 0; i < 5; i++) {
                fibonacci(35); // CPU-intensive calculation
            }
        });

        // Test with optimization
        const withOptimizationTime = await measureTime(async () => {
            for (let i = 0; i < 5; i++) {
                await eventLoopOptimizer.deferWork(() => fibonacci(35));
            }
        });

        console.log(`Without optimization: ${withoutOptimizationTime}ms`);
        console.log(`With optimization: ${withOptimizationTime}ms`);

        // Measure event loop lag during CPU-intensive task
        let lagWithoutOptimization = 0;
        let lagWithOptimization = 0;

        // Measure lag without optimization
        const lagCheckPromise1 = new Promise<void>((resolve) => {
            const interval = setInterval(async () => {
                const lag = await eventLoopOptimizer.getCurrentLag();
                lagWithoutOptimization = Math.max(lagWithoutOptimization, lag);
            }, 10);

            setTimeout(() => {
                clearInterval(interval);
                resolve();
            }, 1000);

            // Run CPU-intensive task
            fibonacci(35);
        });

        await lagCheckPromise1;

        // Measure lag with optimization
        const lagCheckPromise2 = new Promise<void>((resolve) => {
            const interval = setInterval(async () => {
                const lag = await eventLoopOptimizer.getCurrentLag();
                lagWithOptimization = Math.max(lagWithOptimization, lag);
            }, 10);

            setTimeout(() => {
                clearInterval(interval);
                resolve();
            }, 1000);

            // Run CPU-intensive task with optimization
            eventLoopOptimizer.deferWork(() => fibonacci(35));
        });

        await lagCheckPromise2;

        console.log(`Event loop lag without optimization: ${lagWithoutOptimization}ms`);
        console.log(`Event loop lag with optimization: ${lagWithOptimization}ms`);

        // Expect optimization to reduce event loop lag
        expect(lagWithOptimization).toBeLessThan(lagWithoutOptimization);
    }, 30000);

    /**
     * Test: Connection pooling
     * Measures the performance improvement from connection pooling
     */
    it('should improve performance with connection pooling', async () => {
        // Skip in CI environment
        if (process.env.CI) {
            console.log('Skipping performance test in CI environment');
            return;
        }

        // Mock HTTP server for testing
        const mockServer = createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });

        // Start mock server on random port
        let mockPort: number;
        await new Promise<void>((resolve) => {
            mockServer.listen(0, () => {
                mockPort = (mockServer.address() as any).port;
                resolve();
            });
        });

        // Create backend service with connection pooling
        const backendWithPooling = new BackendService(mockLogger as any, {
            baseUrl: `http://localhost:${mockPort}`,
            connectionPool: {
                maxConnections: 10,
                keepAlive: true
            }
        });

        // Create backend service without connection pooling
        const backendWithoutPooling = new BackendService(mockLogger as any, {
            baseUrl: `http://localhost:${mockPort}`,
            connectionPool: {
                maxConnections: 1,
                keepAlive: false
            }
        });

        // Test with connection pooling
        const withPoolingTime = await measureTime(async () => {
            const promises = [];

            for (let i = 0; i < 50; i++) {
                promises.push(backendWithPooling.get('/test'));
            }

            await Promise.all(promises);
        });

        // Test without connection pooling
        const withoutPoolingTime = await measureTime(async () => {
            const promises = [];

            for (let i = 0; i < 50; i++) {
                promises.push(backendWithoutPooling.get('/test'));
            }

            await Promise.all(promises);
        });

        console.log(`With connection pooling: ${withPoolingTime}ms`);
        console.log(`Without connection pooling: ${withoutPoolingTime}ms`);
        console.log(`Performance improvement: ${Math.round((withoutPoolingTime - withPoolingTime) / withoutPoolingTime * 100)}%`);

        // Close mock server
        await new Promise<void>((resolve) => {
            mockServer.close(() => resolve());
        });

        // Expect pooling to be faster
        expect(withPoolingTime).toBeLessThan(withoutPoolingTime);
    }, 30000);
});