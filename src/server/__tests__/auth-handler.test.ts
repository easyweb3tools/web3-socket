import { AuthHandler } from '../handlers/auth-handler';
import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('jsonwebtoken');

describe('AuthHandler', () => {
    // Mock dependencies
    const mockIo = {
        sockets: {
            sockets: new Map()
        }
    };

    const mockConnectionManager = {
        registerUser: jest.fn(),
        getUserId: jest.fn(),
        updateActivity: jest.fn(),
        isAuthenticated: jest.fn()
    };

    const mockRoomManager = {
        addToRoom: jest.fn(),
        getUserRoom: jest.fn()
    };

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

    // Mock RoomManager static method
    jest.spyOn(mockRoomManager, 'getUserRoom').mockImplementation((userId) => `user:${userId}`);

    // Create handler instance
    let authHandler: AuthHandler;

    // Mock environment variables
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        process.env.JWT_SECRET = 'test_secret';

        // Create handler
        authHandler = new AuthHandler(
            mockIo as any,
            mockConnectionManager as any,
            mockRoomManager as any,
            mockLogger as any
        );

        // Initialize handler
        authHandler.initialize();
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('handleRegister', () => {
        it('should handle registration with pre-authenticated socket', async () => {
            // Mock socket with pre-authenticated data
            const mockSocket = {
                id: 'socket123',
                data: {
                    authenticated: true,
                    userId: 'user123',
                    token: 'valid_token'
                },
                emit: jest.fn()
            } as unknown as Socket;

            // Mock successful registration
            mockConnectionManager.registerUser.mockResolvedValue(true);

            // Call register event handler
            await authHandler.handleEvent(mockSocket, 'register', { userId: 'user123' });

            // Verify user was registered
            expect(mockConnectionManager.registerUser).toHaveBeenCalledWith(
                mockSocket,
                'user123',
                'valid_token'
            );

            // Verify user was added to room
            expect(mockRoomManager.addToRoom).toHaveBeenCalledWith(
                mockSocket,
                'user:user123',
                'user'
            );

            // Verify acknowledgement was sent
            expect(mockSocket.emit).toHaveBeenCalledWith('register:ack', {
                success: true,
                method: 'jwt'
            });
        });

        it('should handle registration with token', async () => {
            // Mock socket
            const mockSocket = {
                id: 'socket123',
                data: {},
                emit: jest.fn()
            } as unknown as Socket;

            // Mock successful registration
            mockConnectionManager.registerUser.mockResolvedValue(true);

            // Call register event handler
            await authHandler.handleEvent(mockSocket, 'register', {
                userId: 'user456',
                token: 'valid_token'
            });

            // Verify user was registered
            expect(mockConnectionManager.registerUser).toHaveBeenCalledWith(
                mockSocket,
                'user456',
                'valid_token'
            );

            // Verify user was added to room
            expect(mockRoomManager.addToRoom).toHaveBeenCalledWith(
                mockSocket,
                'user:user456',
                'user'
            );

            // Verify acknowledgement was sent
            expect(mockSocket.emit).toHaveBeenCalledWith('register:ack', {
                success: true,
                method: 'token'
            });
        });

        it('should handle registration without token (legacy)', async () => {
            // Mock socket
            const mockSocket = {
                id: 'socket123',
                data: {},
                emit: jest.fn()
            } as unknown as Socket;

            // Mock successful registration
            mockConnectionManager.registerUser.mockResolvedValue(true);

            // Call register event handler
            await authHandler.handleEvent(mockSocket, 'register', { userId: 'user789' });

            // Verify user was registered
            expect(mockConnectionManager.registerUser).toHaveBeenCalledWith(
                mockSocket,
                'user789',
                undefined
            );

            // Verify user was added to room
            expect(mockRoomManager.addToRoom).toHaveBeenCalledWith(
                mockSocket,
                'user:user789',
                'user'
            );

            // Verify acknowledgement was sent
            expect(mockSocket.emit).toHaveBeenCalledWith('register:ack', {
                success: true,
                method: 'legacy'
            });
        });

        it('should handle failed registration', async () => {
            // Mock socket
            const mockSocket = {
                id: 'socket123',
                data: {},
                emit: jest.fn(),
                disconnect: jest.fn()
            } as unknown as Socket;

            // Mock failed registration
            mockConnectionManager.registerUser.mockResolvedValue(false);

            // Mock setTimeout
            jest.useFakeTimers();

            // Call register event handler
            await authHandler.handleEvent(mockSocket, 'register', {
                userId: 'user123',
                token: 'invalid_token'
            });

            // Verify acknowledgement was sent
            expect(mockSocket.emit).toHaveBeenCalledWith('register:ack', {
                success: false,
                error: 'Authentication failed'
            });

            // Fast-forward timers
            jest.runAllTimers();

            // Verify socket was disconnected
            expect(mockSocket.disconnect).toHaveBeenCalledWith(true);

            // Restore timers
            jest.useRealTimers();
        });

        it('should handle missing userId', async () => {
            // Mock socket
            const mockSocket = {
                id: 'socket123',
                data: {},
                emit: jest.fn()
            } as unknown as Socket;

            // Call register event handler
            await authHandler.handleEvent(mockSocket, 'register', {});

            // Verify error response was sent
            expect(mockSocket.emit).toHaveBeenCalledWith('register:ack', {
                success: false,
                error: 'Missing userId'
            });

            // Verify user was not registered
            expect(mockConnectionManager.registerUser).not.toHaveBeenCalled();
        });
    });

    describe('handleAuthenticate', () => {
        it('should authenticate with valid token', async () => {
            // Mock socket
            const mockSocket = {
                id: 'socket123',
                data: {},
                emit: jest.fn()
            } as unknown as Socket;

            // Mock JWT verify
            (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user123' });

            // Mock successful registration
            mockConnectionManager.registerUser.mockResolvedValue(true);

            // Call authenticate event handler
            await authHandler.handleEvent(mockSocket, 'authenticate', { token: 'valid_token' });

            // Verify token was verified
            expect(jwt.verify).toHaveBeenCalledWith('valid_token', 'test_secret');

            // Verify socket data was updated
            expect(mockSocket.data).toEqual({
                userId: 'user123',
                authenticated: true,
                token: 'valid_token'
            });

            // Verify user was registered
            expect(mockConnectionManager.registerUser).toHaveBeenCalledWith(
                mockSocket,
                'user123',
                'valid_token'
            );

            // Verify user was added to room
            expect(mockRoomManager.addToRoom).toHaveBeenCalledWith(
                mockSocket,
                'user:user123',
                'user'
            );

            // Verify acknowledgement was sent
            expect(mockSocket.emit).toHaveBeenCalledWith('authenticate:ack', {
                success: true,
                userId: 'user123'
            });
        });

        it('should handle missing token', async () => {
            // Mock socket
            const mockSocket = {
                id: 'socket123',
                data: {},
                emit: jest.fn()
            } as unknown as Socket;

            // Call authenticate event handler
            await authHandler.handleEvent(mockSocket, 'authenticate', {});

            // Verify error response was sent
            expect(mockSocket.emit).toHaveBeenCalledWith('authenticate:ack', {
                success: false,
                error: 'Missing token'
            });

            // Verify JWT was not verified
            expect(jwt.verify).not.toHaveBeenCalled();
        });

        it('should handle invalid token', async () => {
            // Mock socket
            const mockSocket = {
                id: 'socket123',
                data: {},
                emit: jest.fn()
            } as unknown as Socket;

            // Mock JWT verify to throw error
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw new Error('Invalid token');
            });

            // Call authenticate event handler
            await authHandler.handleEvent(mockSocket, 'authenticate', { token: 'invalid_token' });

            // Verify error response was sent
            expect(mockSocket.emit).toHaveBeenCalledWith('authenticate:ack', {
                success: false,
                error: 'Invalid token'
            });
        });

        it('should handle token without user identifier', async () => {
            // Mock socket
            const mockSocket = {
                id: 'socket123',
                data: {},
                emit: jest.fn()
            } as unknown as Socket;

            // Mock JWT verify to return object without userId or sub
            (jwt.verify as jest.Mock).mockReturnValue({ someOtherField: 'value' });

            // Call authenticate event handler
            await authHandler.handleEvent(mockSocket, 'authenticate', { token: 'incomplete_token' });

            // Verify error response was sent
            expect(mockSocket.emit).toHaveBeenCalledWith('authenticate:ack', {
                success: false,
                error: 'Invalid token format'
            });
        });
    });

    describe('handleVerifyToken', () => {
        it('should verify valid token and return expiration', async () => {
            // Mock socket
            const mockSocket = {
                id: 'socket123',
                data: {},
                emit: jest.fn()
            } as unknown as Socket;

            // Current time for testing
            const now = Date.now();

            // Mock Date.now
            jest.spyOn(Date, 'now').mockReturnValue(now);

            // Mock JWT verify with expiration
            (jwt.verify as jest.Mock).mockReturnValue({
                userId: 'user123',
                exp: Math.floor((now + 3600000) / 1000) // 1 hour from now
            });

            // Call verify-token event handler
            await authHandler.handleEvent(mockSocket, 'verify-token', { token: 'valid_token' });

            // Verify token was verified
            expect(jwt.verify).toHaveBeenCalledWith('valid_token', 'test_secret');

            // Verify response was sent with expiration
            expect(mockSocket.emit).toHaveBeenCalledWith('verify-token:ack', {
                success: true,
                userId: 'user123',
                expiresIn: 3600000 // 1 hour in milliseconds
            });
        });

        it('should handle missing token', async () => {
            // Mock socket
            const mockSocket = {
                id: 'socket123',
                data: {},
                emit: jest.fn()
            } as unknown as Socket;

            // Call verify-token event handler
            await authHandler.handleEvent(mockSocket, 'verify-token', {});

            // Verify error response was sent
            expect(mockSocket.emit).toHaveBeenCalledWith('verify-token:ack', {
                success: false,
                error: 'Missing token'
            });
        });

        it('should handle invalid token', async () => {
            // Mock socket
            const mockSocket = {
                id: 'socket123',
                data: {},
                emit: jest.fn()
            } as unknown as Socket;

            // Mock JWT verify to throw error
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw new Error('Invalid token');
            });

            // Call verify-token event handler
            await authHandler.handleEvent(mockSocket, 'verify-token', { token: 'invalid_token' });

            // Verify error response was sent
            expect(mockSocket.emit).toHaveBeenCalledWith('verify-token:ack', {
                success: false,
                error: 'Invalid token'
            });
        });
    });

    describe('handlePing', () => {
        it('should respond to ping with authentication status', async () => {
            // Mock socket
            const mockSocket = {
                id: 'socket123',
                data: {
                    authenticated: true
                },
                emit: jest.fn()
            } as unknown as Socket;

            // Mock Date for consistent testing
            const mockDate = new Date('2023-01-01T12:00:00Z');
            jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

            // Call ping event handler
            await authHandler.handleEvent(mockSocket, 'ping', { test: 'data' });

            // Verify activity was updated
            expect(mockConnectionManager.updateActivity).toHaveBeenCalledWith('socket123');

            // Verify pong response was sent
            expect(mockSocket.emit).toHaveBeenCalledWith('pong', {
                timestamp: '2023-01-01T12:00:00.000Z',
                echo: { test: 'data' },
                authenticated: true
            });
        });

        it('should respond to ping with unauthenticated status', async () => {
            // Mock socket
            const mockSocket = {
                id: 'socket123',
                data: {
                    authenticated: false
                },
                emit: jest.fn()
            } as unknown as Socket;

            // Mock Date for consistent testing
            const mockDate = new Date('2023-01-01T12:00:00Z');
            jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

            // Call ping event handler
            await authHandler.handleEvent(mockSocket, 'ping', { test: 'data' });

            // Verify activity was updated
            expect(mockConnectionManager.updateActivity).toHaveBeenCalledWith('socket123');

            // Verify pong response was sent
            expect(mockSocket.emit).toHaveBeenCalledWith('pong', {
                timestamp: '2023-01-01T12:00:00.000Z',
                echo: { test: 'data' },
                authenticated: false
            });
        });
    });
});