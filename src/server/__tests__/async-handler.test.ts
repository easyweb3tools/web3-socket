import { asyncHandler, socketAsyncHandler } from '../errors/async-handler';
import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../errors/error-types';

describe('Async Handler', () => {
    describe('Express asyncHandler', () => {
        it('should pass through successful responses', async () => {
            // Create mock request, response, and next function
            const req = {} as Request;
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            } as unknown as Response;
            const next = jest.fn() as NextFunction;

            // Create async handler function that succeeds
            const handler = asyncHandler(async (req, res, next) => {
                res.status(200).json({ success: true });
            });

            // Call handler
            await handler(req, res, next);

            // Verify response was sent
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ success: true });
            expect(next).not.toHaveBeenCalled();
        });

        it('should pass errors to next function', async () => {
            // Create mock request, response, and next function
            const req = {} as Request;
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            } as unknown as Response;
            const next = jest.fn() as NextFunction;

            // Create error to throw
            const error = new ValidationError('Invalid input');

            // Create async handler function that throws
            const handler = asyncHandler(async (req, res, next) => {
                throw error;
            });

            // Call handler
            await handler(req, res, next);

            // Verify error was passed to next
            expect(next).toHaveBeenCalledWith(error);
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
        });
    });

    describe('Socket.IO socketAsyncHandler', () => {
        it('should pass through successful responses', async () => {
            // Create mock socket
            const socket = {
                emit: jest.fn()
            };

            // Create async handler function that succeeds
            const handler = socketAsyncHandler(async (socket, data) => {
                return { success: true };
            }, 'test-event');

            // Call handler
            const result = await handler(socket, { test: 'data' });

            // Verify no error was emitted
            expect(socket.emit).not.toHaveBeenCalled();
        });

        it('should emit errors to the socket', async () => {
            // Create mock socket
            const socket = {
                emit: jest.fn()
            };

            // Create error to throw
            const error = new ValidationError('Invalid input');

            // Create async handler function that throws
            const handler = socketAsyncHandler(async (socket, data) => {
                throw error;
            }, 'test-event');

            // Call handler and expect it to throw
            await expect(handler(socket, { test: 'data' })).rejects.toThrow(error);

            // Verify error was emitted to socket
            expect(socket.emit).toHaveBeenCalledWith('error', {
                event: 'test-event',
                message: 'Invalid input',
                code: 'VALIDATION_ERROR'
            });
        });

        it('should handle non-AppError errors', async () => {
            // Create mock socket
            const socket = {
                emit: jest.fn()
            };

            // Create error to throw
            const error = new Error('Generic error');

            // Create async handler function that throws
            const handler = socketAsyncHandler(async (socket, data) => {
                throw error;
            }, 'test-event');

            // Call handler and expect it to throw
            await expect(handler(socket, { test: 'data' })).rejects.toThrow(error);

            // Verify error was emitted to socket
            expect(socket.emit).toHaveBeenCalledWith('error', {
                event: 'test-event',
                message: 'Generic error',
                code: 'SOCKET_EVENT_ERROR'
            });
        });
    });
});