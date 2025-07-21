import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { createRedisAdapter, testRedisConnection, RedisAdapterOptions } from '../adapters/redis-adapter';
import { Logger } from '../logger';

// Mock dependencies
jest.mock('socket.io');
jest.mock('redis');
jest.mock('@socket.io/redis-adapter');

describe('Redis Adapter', () => {
    // Setup mocks
    const mockServer = {
        adapter: jest.fn()
    } as unknown as Server;

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
    } as unknown as Logger;

    const mockPubClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        duplicate: jest.fn(),
        ping: jest.fn().mockResolvedValue('PONG'),
        disconnect: jest.fn().mockResolvedValue(undefined)
    };

    const mockSubClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn()
    };

    // Reset mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();
        (createClient as jest.Mock).mockReturnValue(mockPubClient);
        mockPubClient.duplicate.mockReturnValue(mockSubClient);
        (createAdapter as jest.Mock).mockReturnValue('mock-adapter');
    });

    describe('createRedisAdapter', () => {
        it('should initialize Redis adapter with default options', async () => {
            await createRedisAdapter(mockServer, mockLogger);

            expect(createClient).toHaveBeenCalledWith(expect.objectContaining({
                socket: expect.objectContaining({
                    host: 'localhost',
                    port: 6379
                })
            }));

            expect(mockPubClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(mockPubClient.on).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockSubClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(mockSubClient.on).toHaveBeenCalledWith('error', expect.any(Function));

            expect(createAdapter).toHaveBeenCalledWith(mockPubClient, mockSubClient, {
                key: 'socket.io'
            });

            expect(mockServer.adapter).toHaveBeenCalledWith('mock-adapter');
        });

        it('should initialize Redis adapter with custom options', async () => {
            const options: RedisAdapterOptions = {
                host: 'redis-server',
                port: 6380,
                password: 'secret',
                db: 1,
                prefix: 'custom-prefix',
                tls: true
            };

            await createRedisAdapter(mockServer, mockLogger, options);

            expect(createClient).toHaveBeenCalledWith(expect.objectContaining({
                socket: expect.objectContaining({
                    host: 'redis-server',
                    port: 6380,
                    tls: true
                }),
                password: 'secret',
                database: 1
            }));

            expect(createAdapter).toHaveBeenCalledWith(mockPubClient, mockSubClient, {
                key: 'custom-prefix'
            });
        });

        it('should initialize Redis adapter with URL', async () => {
            const options: RedisAdapterOptions = {
                url: 'redis://user:pass@redis-server:6380',
                tls: true
            };

            await createRedisAdapter(mockServer, mockLogger, options);

            expect(createClient).toHaveBeenCalledWith(expect.objectContaining({
                url: 'redis://user:pass@redis-server:6380',
                socket: expect.objectContaining({
                    tls: true
                })
            }));
        });

        it('should handle connection errors', async () => {
            const error = new Error('Connection failed');
            mockPubClient.connect.mockRejectedValue(error);

            await expect(createRedisAdapter(mockServer, mockLogger)).rejects.toThrow('Connection failed');

            expect(mockLogger.child().error).toHaveBeenCalledWith('Failed to initialize Redis adapter', error);
        });
    });

    describe('testRedisConnection', () => {
        it('should test connection successfully', async () => {
            const result = await testRedisConnection({}, mockLogger);

            expect(result).toBe(true);
            expect(mockPubClient.connect).toHaveBeenCalled();
            expect(mockPubClient.ping).toHaveBeenCalled();
            expect(mockPubClient.disconnect).toHaveBeenCalled();
        });

        it('should handle connection failure', async () => {
            const error = new Error('Connection failed');
            mockPubClient.connect.mockRejectedValue(error);

            const result = await testRedisConnection({}, mockLogger);

            expect(result).toBe(false);
            expect(mockLogger.child().error).toHaveBeenCalledWith('Redis connection test failed', error);
        });
    });

    describe('Cross-instance messaging', () => {
        it('should support cross-instance messaging through Redis adapter', async () => {
            // This is more of an integration test concept, but we can verify the adapter is set up correctly
            await createRedisAdapter(mockServer, mockLogger);

            expect(mockServer.adapter).toHaveBeenCalledWith('mock-adapter');
            expect(createAdapter).toHaveBeenCalledWith(mockPubClient, mockSubClient, expect.any(Object));
        });
    });

    describe('Connection state sharing', () => {
        it('should enable connection state sharing through Redis adapter', async () => {
            // This is more of an integration test concept, but we can verify the adapter is set up correctly
            await createRedisAdapter(mockServer, mockLogger);

            expect(mockServer.adapter).toHaveBeenCalledWith('mock-adapter');
        });
    });
});