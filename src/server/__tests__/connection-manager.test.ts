import { ConnectionManager, ConnectionDetails } from '../connection-manager';
import { Server, Socket } from 'socket.io';
import { Logger } from '../logger';

// Mock dependencies
jest.mock('socket.io');
jest.mock('../logger');

describe('ConnectionManager', () => {
    let connectionManager: ConnectionManager;
    let mockIo: jest.Mocked<Server>;
    let mockLogger: jest.Mocked<Logger>;
    let mockSocket: jest.Mocked<Socket>;

    beforeEach(() => {
        // Setup mocks
        mockIo = {
            sockets: {
                sockets: new Map(),
                adapter: {
                    rooms: new Map()
                }
            }
        } as unknown as jest.Mocked<Server>;

        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        } as jest.Mocked<Logger>;

        mockSocket = {
            id: 'socket-123',
            handshake: {
                headers: {
                    'user-agent': 'test-agent'
                },
                address: '127.0.0.1'
            },
            data: {},
            join: jest.fn(),
            leave: jest.fn(),
            emit: jest.fn(),
            disconnect: jest.fn()
        } as unknown as jest.Mocked<Socket>;

        // Add mock socket to io.sockets.sockets
        mockIo.sockets.sockets.set(mockSocket.id, mockSocket);

        // Create connection manager instance
        connectionManager = new ConnectionManager(mockIo, mockLogger);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('registerUser', () => {
        it('should register a user successfully without token', async () => {
            const userId = 'user-123';

            const result = await connectionManager.registerUser(mockSocket, userId);

            expect(result).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(`User ${userId} registered`),
                expect.any(Object)
            );
            expect(mockSocket.data.userId).toBe(userId);
            expect(mockSocket.data.authenticated).toBe(true);
        });

        it('should store connection details correctly', async () => {
            const userId = 'user-123';

            await connectionManager.registerUser(mockSocket, userId);

            const storedUserId = connectionManager.getUserId(mockSocket.id);
            expect(storedUserId).toBe(userId);

            const connectionDetails = connectionManager.getConnectionDetails(mockSocket.id);
            expect(connectionDetails).toBeDefined();
            expect(connectionDetails?.userId).toBe(userId);
            expect(connectionDetails?.socketId).toBe(mockSocket.id);
            expect(connectionDetails?.metadata).toBeDefined();
            expect(connectionDetails?.metadata.userAgent).toBe('test-agent');
            expect(connectionDetails?.metadata.ip).toBe('127.0.0.1');
        });
    });

    describe('removeUser', () => {
        it('should remove a user connection', async () => {
            const userId = 'user-123';

            await connectionManager.registerUser(mockSocket, userId);
            connectionManager.removeUser(mockSocket);

            const storedUserId = connectionManager.getUserId(mockSocket.id);
            expect(storedUserId).toBeNull();

            const connectionDetails = connectionManager.getConnectionDetails(mockSocket.id);
            expect(connectionDetails).toBeNull();
        });
    });

    describe('getSocketsForUser', () => {
        it('should return sockets for a user', async () => {
            const userId = 'user-123';

            await connectionManager.registerUser(mockSocket, userId);

            const sockets = connectionManager.getSocketsForUser(userId);
            expect(sockets).toHaveLength(1);
            expect(sockets[0]).toBe(mockSocket);
        });

        it('should return empty array for unknown user', () => {
            const sockets = connectionManager.getSocketsForUser('unknown-user');
            expect(sockets).toHaveLength(0);
        });
    });

    describe('isAuthenticated', () => {
        it('should return true for authenticated socket', async () => {
            const userId = 'user-123';

            await connectionManager.registerUser(mockSocket, userId);

            const isAuthenticated = connectionManager.isAuthenticated(mockSocket);
            expect(isAuthenticated).toBe(true);
        });

        it('should return false for unauthenticated socket', () => {
            const isAuthenticated = connectionManager.isAuthenticated(mockSocket);
            expect(isAuthenticated).toBe(false);
        });
    });

    describe('updateActivity', () => {
        it('should update last activity timestamp', async () => {
            const userId = 'user-123';

            await connectionManager.registerUser(mockSocket, userId);

            // Get initial timestamp
            const initialDetails = connectionManager.getConnectionDetails(mockSocket.id);
            const initialTimestamp = initialDetails?.metadata.lastActivity;

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 10));

            // Update activity
            connectionManager.updateActivity(mockSocket.id);

            // Get updated timestamp
            const updatedDetails = connectionManager.getConnectionDetails(mockSocket.id);
            const updatedTimestamp = updatedDetails?.metadata.lastActivity;

            expect(updatedTimestamp).toBeDefined();
            expect(initialTimestamp).toBeDefined();
            expect(updatedTimestamp!.getTime()).toBeGreaterThan(initialTimestamp!.getTime());
        });
    });

    describe('getInactiveConnections', () => {
        it('should return inactive connections', async () => {
            const userId = 'user-123';

            await connectionManager.registerUser(mockSocket, userId);

            // Manually set last activity to 10 minutes ago
            const connectionDetails = connectionManager.getConnectionDetails(mockSocket.id);
            if (connectionDetails) {
                connectionDetails.metadata.lastActivity = new Date(Date.now() - 10 * 60 * 1000);
            }

            // Get inactive connections (5 minutes threshold)
            const inactiveConnections = connectionManager.getInactiveConnections(5);

            expect(inactiveConnections).toHaveLength(1);
            expect(inactiveConnections[0].socketId).toBe(mockSocket.id);
        });

        it('should not return active connections', async () => {
            const userId = 'user-123';

            await connectionManager.registerUser(mockSocket, userId);

            // Get inactive connections (5 minutes threshold)
            const inactiveConnections = connectionManager.getInactiveConnections(5);

            expect(inactiveConnections).toHaveLength(0);
        });
    });
});