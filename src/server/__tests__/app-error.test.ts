import { AppError } from '../errors/app-error';
import {
    AuthenticationError,
    ValidationError,
    NotFoundError,
    SocketEventError
} from '../errors/error-types';

describe('AppError', () => {
    it('should create a basic AppError with default values', () => {
        const error = new AppError('Test error');

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('AppError');
        expect(error.message).toBe('Test error');
        expect(error.statusCode).toBe(500);
        expect(error.code).toBe('INTERNAL_ERROR');
        expect(error.isOperational).toBe(true);
        expect(error.details).toBeUndefined();
        expect(error.cause).toBeUndefined();
        expect(error.stack).toBeDefined();
    });

    it('should create an AppError with custom values', () => {
        const details = { field: 'username', reason: 'required' };
        const cause = new Error('Original error');
        const error = new AppError(
            'Custom error',
            400,
            'CUSTOM_ERROR',
            false,
            details,
            cause
        );

        expect(error.message).toBe('Custom error');
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('CUSTOM_ERROR');
        expect(error.isOperational).toBe(false);
        expect(error.details).toEqual(details);
        expect(error.cause).toBe(cause);
    });

    it('should convert to JSON representation', () => {
        const error = new AppError('Test error', 400, 'TEST_ERROR');
        const json = error.toJSON();

        expect(json).toEqual({
            error: {
                name: 'AppError',
                message: 'Test error',
                code: 'TEST_ERROR',
                statusCode: 400,
                isOperational: true
            }
        });
    });

    it('should convert to HTTP response format', () => {
        const error = new AppError('Test error', 400, 'TEST_ERROR');
        const response = error.toResponse('req-123');

        expect(response).toEqual({
            success: false,
            error: {
                message: 'Test error',
                code: 'TEST_ERROR',
                requestId: 'req-123'
            }
        });
    });

    it('should include details in JSON and response', () => {
        const details = { field: 'username', reason: 'required' };
        const error = new AppError('Test error', 400, 'TEST_ERROR', true, details);

        const json = error.toJSON();
        expect(json.error.details).toEqual(details);

        const response = error.toResponse();
        expect(response.error.details).toEqual(details);
    });
});

describe('Error Types', () => {
    it('should create AuthenticationError with correct defaults', () => {
        const error = new AuthenticationError();

        expect(error).toBeInstanceOf(AppError);
        expect(error.name).toBe('AuthenticationError');
        expect(error.message).toBe('Authentication failed');
        expect(error.statusCode).toBe(401);
        expect(error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should create ValidationError with correct defaults', () => {
        const error = new ValidationError();

        expect(error).toBeInstanceOf(AppError);
        expect(error.name).toBe('ValidationError');
        expect(error.message).toBe('Validation failed');
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should create NotFoundError with correct defaults', () => {
        const error = new NotFoundError();

        expect(error).toBeInstanceOf(AppError);
        expect(error.name).toBe('NotFoundError');
        expect(error.message).toBe('Resource not found');
        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
    });

    it('should create SocketEventError with correct defaults', () => {
        const error = new SocketEventError();

        expect(error).toBeInstanceOf(AppError);
        expect(error.name).toBe('SocketEventError');
        expect(error.message).toBe('Socket event error');
        expect(error.statusCode).toBe(500);
        expect(error.code).toBe('SOCKET_EVENT_ERROR');
    });

    it('should allow custom messages and details', () => {
        const details = { userId: '123', event: 'connect' };
        const error = new AuthenticationError('Invalid token', details);

        expect(error.message).toBe('Invalid token');
        expect(error.details).toEqual(details);
    });

    it('should wrap original errors', () => {
        const originalError = new Error('Database connection failed');
        const error = new SocketEventError('Failed to process event', { eventName: 'message' }, originalError);

        expect(error.message).toBe('Failed to process event');
        expect(error.details).toEqual({ eventName: 'message' });
        expect(error.cause).toBe(originalError);
    });
});