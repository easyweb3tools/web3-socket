import { Request, Response, NextFunction } from 'express';

/**
 * Async handler wrapper for Express routes
 * Automatically catches errors and passes them to the next middleware
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Async handler wrapper for Socket.IO event handlers
 * Automatically catches errors and emits them to the client
 */
export function socketAsyncHandler<T>(
    fn: (socket: any, data: T) => Promise<any>,
    eventName: string
) {
    return async (socket: any, data: T) => {
        try {
            await fn(socket, data);
        } catch (error) {
            // Emit error to client
            socket.emit('error', {
                event: eventName,
                message: error instanceof Error ? error.message : 'Unknown error',
                code: (error as any)?.code || 'SOCKET_EVENT_ERROR'
            });

            // Re-throw for the handler's error handling
            throw error;
        }
    };
}