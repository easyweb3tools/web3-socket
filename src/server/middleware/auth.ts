import { Request, Response, NextFunction } from 'express';
import { Logger } from '../logger';

/**
 * Authentication middleware for API endpoints
 */
export function createAuthMiddleware(logger: Logger) {
    const apiKey = process.env.API_KEY || 'easyweb3.TOOLS';

    return function authMiddleware(req: Request, res: Response, next: NextFunction) {
        const providedKey = req.header('X-API-Key');

        if (!providedKey || providedKey !== apiKey) {
            logger.warn('Unauthorized API access attempt', {
                ip: req.ip,
                path: req.path,
                method: req.method
            });

            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                code: 'UNAUTHORIZED'
            });
        }

        next();
    };
}