import { createSocketAuthMiddleware } from '../middleware/socket-auth';
import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('jsonwebtoken');

describe('Socket Authentication Middleware', () => {
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

    // Mock environment variables
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        process.env.JWT_SECRET = 'test_secret';
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('should allow connection without token and mark as unauthenticated', () => {
        // Create middleware
        const middleware = createSocketAuthMiddleware(mockLogger as any);

        // Mock socket without token
        const mockSocket = {
            id: 'socket123',
            handshake: {
                headers: {},
                address: '127.0.0.1',
                auth: {}
            },
            data: {}
        } as unknown as Socket;

        // Mock next function
        const next = jest.fn();

        // Call middleware
        middleware(mockSocket, next);

        // Verify socket is marked as unauthenticated
        expect(mockSocket.data.authenticated).toBe(false);
        expect(next).toHaveBeenCalledWith();
    });

    it('should authenticate socket with valid token in authorization header', () => {
        // Mock JWT verify
        (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user123' });

        // Create middleware
        const middleware = createSocketAuthMiddleware(mockLogger as any);

        // Mock socket with token in authorization header
        const mockSocket = {
            id: 'socket123',
            handshake: {
                headers: {
                    authorization: 'Bearer valid_token'
                },
                address: '127.0.0.1',
                auth: {}
            },
            data: {}
        } as unknown as Socket;

        // Mock next function
        const next = jest.fn();

        // Call middleware
        middleware(mockSocket, next);

        // Verify JWT was verified with correct parameters
        expect(jwt.verify).toHaveBeenCalledWith('valid_token', 'test_secret');

        // Verify socket is marked as authenticated
        expect(mockSocket.data.authenticated).toBe(true);
        expect(mockSocket.data.userId).toBe('user123');
        expect(mockSocket.data.token).toBe('valid_token');
        expect(next).toHaveBeenCalledWith();
    });

    it('should authenticate socket with valid token in auth object', () => {
        // Mock JWT verify
        (jwt.verify as jest.Mock).mockReturnValue({ sub: 'user456' });

        // Create middleware
        const middleware = createSocketAuthMiddleware(mockLogger as any);

        // Mock socket with token in auth object
        const mockSocket = {
            id: 'socket123',
            handshake: {
                headers: {},
                address: '127.0.0.1',
                auth: {
                    token: 'valid_token'
                }
            },
            data: {}
        } as unknown as Socket;

        // Mock next function
        const next = jest.fn();

        // Call middleware
        middleware(mockSocket, next);

        // Verify JWT was verified with correct parameters
        expect(jwt.verify).toHaveBeenCalledWith('valid_token', 'test_secret');

        // Verify socket is marked as authenticated
        expect(mockSocket.data.authenticated).toBe(true);
        expect(mockSocket.data.userId).toBe('user456');
        expect(mockSocket.data.token).toBe('valid_token');
        expect(next).toHaveBeenCalledWith();
    });

    it('should authenticate socket with valid token in cookie', () => {
        // Mock JWT verify
        (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user789' });

        // Create middleware
        const middleware = createSocketAuthMiddleware(mockLogger as any);

        // Mock socket with token in cookie
        const mockSocket = {
            id: 'socket123',
            handshake: {
                headers: {
                    cookie: 'token=valid_token; other=value'
                },
                address: '127.0.0.1',
                auth: {}
            },
            data: {}
        } as unknown as Socket;

        // Mock next function
        const next = jest.fn();

        // Call middleware
        middleware(mockSocket, next);

        // Verify JWT was verified with correct parameters
        expect(jwt.verify).toHaveBeenCalledWith('valid_token', 'test_secret');

        // Verify socket is marked as authenticated
        expect(mockSocket.data.authenticated).toBe(true);
        expect(mockSocket.data.userId).toBe('user789');
        expect(mockSocket.data.token).toBe('valid_token');
        expect(next).toHaveBeenCalledWith();
    });

    it('should handle invalid token and mark socket as unauthenticated', () => {
        // Mock JWT verify to throw error
        (jwt.verify as jest.Mock).mockImplementation(() => {
            throw new Error('Invalid token');
        });

        // Create middleware
        const middleware = createSocketAuthMiddleware(mockLogger as any);

        // Mock socket with invalid token
        const mockSocket = {
            id: 'socket123',
            handshake: {
                headers: {
                    authorization: 'Bearer invalid_token'
                },
                address: '127.0.0.1',
                auth: {}
            },
            data: {}
        } as unknown as Socket;

        // Mock next function
        const next = jest.fn();

        // Call middleware
        middleware(mockSocket, next);

        // Verify socket is marked as unauthenticated
        expect(mockSocket.data.authenticated).toBe(false);
        expect(next).toHaveBeenCalledWith();
    });

    it('should reject token without user identifier', () => {
        // Mock JWT verify to return object without userId or sub
        (jwt.verify as jest.Mock).mockReturnValue({ someOtherField: 'value' });

        // Create middleware
        const middleware = createSocketAuthMiddleware(mockLogger as any);

        // Mock socket with token missing user identifier
        const mockSocket = {
            id: 'socket123',
            handshake: {
                headers: {
                    authorization: 'Bearer incomplete_token'
                },
                address: '127.0.0.1',
                auth: {}
            },
            data: {}
        } as unknown as Socket;

        // Mock next function
        const next = jest.fn();

        // Call middleware
        middleware(mockSocket, next);

        // Verify error is passed to next
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toBe('Invalid token format');
    });
});