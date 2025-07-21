import { Request, Response, NextFunction } from 'express';
import { Logger } from '../logger';
import { validationResult, ValidationChain } from 'express-validator';
import sanitizeHtml from 'sanitize-html';

/**
 * Sanitization options
 */
export interface SanitizationOptions {
    /**
     * Fields to sanitize
     */
    fields?: string[];

    /**
     * Whether to sanitize all string fields
     */
    sanitizeAll?: boolean;

    /**
     * Whether to remove HTML tags
     */
    removeHtml?: boolean;

    /**
     * Maximum field length
     */
    maxLength?: number;
}

/**
 * Default sanitization options
 */
const DEFAULT_SANITIZE_OPTIONS: SanitizationOptions = {
    sanitizeAll: true,
    removeHtml: true,
    maxLength: 10000 // 10KB
};

/**
 * Create validation middleware
 */
export function createValidationMiddleware(validations: ValidationChain[], logger: Logger) {
    const moduleLogger = logger.child({ module: 'ValidationMiddleware' });

    return async function validationMiddleware(req: Request, res: Response, next: NextFunction) {
        // Run all validations
        await Promise.all(validations.map(validation => validation.run(req)));

        // Check for validation errors
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            moduleLogger.warn('Validation failed', {
                path: req.path,
                method: req.method,
                errors: errors.array(),
                requestId: req.requestId
            });

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: errors.array(),
                requestId: req.requestId
            });
        }

        next();
    };
}

/**
 * Create sanitization middleware
 */
export function createSanitizationMiddleware(options: SanitizationOptions = {}, logger: Logger) {
    // Merge default options with custom options
    const sanitizeOptions = { ...DEFAULT_SANITIZE_OPTIONS, ...options };
    const moduleLogger = logger.child({ module: 'SanitizationMiddleware' });

    /**
     * Sanitize a value
     */
    function sanitizeValue(value: any): any {
        if (value === null || value === undefined) {
            return value;
        }

        // Handle strings
        if (typeof value === 'string') {
            let sanitized = value;

            // Remove HTML if configured
            if (sanitizeOptions.removeHtml) {
                sanitized = sanitizeHtml(sanitized, {
                    allowedTags: [],
                    allowedAttributes: {}
                });
            }

            // Truncate if too long
            if (sanitizeOptions.maxLength && sanitized.length > sanitizeOptions.maxLength) {
                sanitized = sanitized.substring(0, sanitizeOptions.maxLength);
            }

            return sanitized;
        }

        // Handle arrays
        if (Array.isArray(value)) {
            return value.map(item => sanitizeValue(item));
        }

        // Handle objects
        if (typeof value === 'object') {
            const result: Record<string, any> = {};

            for (const [key, val] of Object.entries(value)) {
                result[key] = sanitizeValue(val);
            }

            return result;
        }

        // Return other types as is
        return value;
    }

    return function sanitizationMiddleware(req: Request, res: Response, next: NextFunction) {
        try {
            // Skip sanitization for GET and DELETE requests
            if (req.method === 'GET' || req.method === 'DELETE') {
                return next();
            }

            // Sanitize specific fields if configured
            if (sanitizeOptions.fields && sanitizeOptions.fields.length > 0) {
                for (const field of sanitizeOptions.fields) {
                    if (req.body && req.body[field] !== undefined) {
                        req.body[field] = sanitizeValue(req.body[field]);
                    }
                }
            }
            // Sanitize all fields if configured
            else if (sanitizeOptions.sanitizeAll && req.body) {
                req.body = sanitizeValue(req.body);
            }

            next();
        } catch (error) {
            moduleLogger.error('Error during sanitization', error as Error, {
                path: req.path,
                method: req.method,
                requestId: req.requestId
            });

            next();
        }
    };
}