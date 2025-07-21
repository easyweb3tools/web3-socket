import { Server } from 'socket.io';
import { InstanceManager, InstanceManagerOptions } from '../utils/instance-manager';
import { Logger } from '../logger';

// Mock dependencies
jest.mock('socket.io');
jest.mock('os', () => ({
    hostname: jest.fn().mockReturnValue('test-host'),
    totalmem: jest.fn().mockReturnValue(8589934592) // 8GB
}));

describe('Instance Manager', () => {
    // Setup mocks
    const mockServer = {
        engine: {
            clientsCount: 0
        }
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

    // Reset mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Initialization', () => {
        it('should initialize with default options', () => {
            const instanceManager = new InstanceManager(mockServer, mockLogger);

            expect(instanceManager.getInstanceId()).toBeDefined();
            expect(instanceManager.getGroupName()).toBe('default');
            expect(instanceManager.getMetadata()).toEqual({});
            expect(mockLogger.child).toHaveBeenCalledWith(expect.objectContaining({
                module: 'InstanceManager',
                instanceId: expect.any(String)
            }));
        });

        it('should initialize with custom options', () => {
            const options: InstanceManagerOptions = {
                instanceId: 'custom-id',
                groupName: 'custom-group',
                metadata: { region: 'us-east-1' }
            };

            const instanceManager = new InstanceManager(mockServer, mockLogger, options);

            expect(instanceManager.getInstanceId()).toBe('custom-id');
            expect(instanceManager.getGroupName()).toBe('custom-group');
            expect(instanceManager.getMetadata()).toEqual({ region: 'us-east-1' });
        });
    });

    describe('Instance Information', () => {
        it('should provide instance information', () => {
            const instanceManager = new InstanceManager(mockServer, mockLogger, {
                instanceId: 'test-instance'
            });

            const info = instanceManager.getInstanceInfo();

            expect(info.id).toBe('test-instance');
            expect(info.hostname).toBe('test-host');
            expect(info.pid).toBe(process.pid);
            expect(info.startTime).toBeLessThanOrEqual(Date.now());
            expect(info.connections).toBe(0);
            expect(info.uptime).toBe(0);
            expect(info.lastHeartbeat).toBeLessThanOrEqual(Date.now());
        });

        it('should calculate uptime correctly', () => {
            const instanceManager = new InstanceManager(mockServer, mockLogger);

            // Fast-forward time by 60 seconds
            jest.advanceTimersByTime(60000);

            expect(instanceManager.getUptime()).toBe(60);
        });
    });

    describe('Health and Load', () => {
        it('should provide health information', () => {
            const instanceManager = new InstanceManager(mockServer, mockLogger);

            const health = instanceManager.getHealth();

            expect(health.instanceId).toBe(instanceManager.getInstanceId());
            expect(health.healthy).toBe(true);
            expect(health.cpuUsage).toBe(0);
            expect(health.memoryUsage).toBe(0);
            expect(health.connections).toBe(0);
            expect(health.eventLoopLag).toBe(0);
            expect(health.timestamp).toBeLessThanOrEqual(Date.now());
        });

        it('should provide load information', () => {
            const instanceManager = new InstanceManager(mockServer, mockLogger);

            const load = instanceManager.getLoad();

            expect(load.instanceId).toBe(instanceManager.getInstanceId());
            expect(load.connections).toBe(0);
            expect(load.cpuUsage).toBe(0);
            expect(load.memoryUsage).toBe(0);
            expect(load.loadScore).toBe(0);
            expect(load.timestamp).toBeLessThanOrEqual(Date.now());
        });
    });

    describe('Connection Management', () => {
        it('should check if instance can accept connections', () => {
            const instanceManager = new InstanceManager(mockServer, mockLogger, {
                enableLoadBalancing: true,
                loadBalancing: {
                    maxConnectionsPerInstance: 100
                }
            });

            // Mock client count
            (mockServer.engine as any).clientsCount = 50;

            expect(instanceManager.canAcceptConnections()).toBe(true);

            // Exceed max connections
            (mockServer.engine as any).clientsCount = 150;

            expect(instanceManager.canAcceptConnections()).toBe(false);
        });

        it('should always accept connections if load balancing is disabled', () => {
            const instanceManager = new InstanceManager(mockServer, mockLogger, {
                enableLoadBalancing: false
            });

            // Mock client count
            (mockServer.engine as any).clientsCount = 50000;

            expect(instanceManager.canAcceptConnections()).toBe(true);
        });
    });

    describe('Lifecycle Management', () => {
        it('should start and stop health check interval', () => {
            const instanceManager = new InstanceManager(mockServer, mockLogger, {
                healthCheckIntervalMs: 5000
            });

            // Start instance manager
            instanceManager.start();

            // Fast-forward time
            jest.advanceTimersByTime(5000);

            // Stop instance manager
            instanceManager.stop();

            // Fast-forward time again
            jest.advanceTimersByTime(5000);

            // Expect health check to have been called once
            expect(mockLogger.child().info).toHaveBeenCalledWith('Instance manager started');
            expect(mockLogger.child().info).toHaveBeenCalledWith('Instance manager stopped');
        });
    });

    describe('Multi-instance Support', () => {
        it('should get all instances when Redis adapter is available', async () => {
            const mockGetActiveInstances = jest.fn().mockResolvedValue([
                { id: 'instance-1', connections: 10 },
                { id: 'instance-2', connections: 20 }
            ]);

            const mockServerWithRedis = {
                ...mockServer,
                getActiveInstances: mockGetActiveInstances
            };

            const instanceManager = new InstanceManager(mockServerWithRedis as unknown as Server, mockLogger);

            const instances = await instanceManager.getAllInstances();

            expect(instances).toHaveLength(2);
            expect(instances[0].id).toBe('instance-1');
            expect(instances[1].id).toBe('instance-2');
        });

        it('should return only current instance when Redis adapter is not available', async () => {
            const instanceManager = new InstanceManager(mockServer, mockLogger, {
                instanceId: 'single-instance'
            });

            const instances = await instanceManager.getAllInstances();

            expect(instances).toHaveLength(1);
            expect(instances[0].id).toBe('single-instance');
        });
    });
});