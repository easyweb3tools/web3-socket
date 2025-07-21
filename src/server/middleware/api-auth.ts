import { Request, Response, NextFunction } from 'express';
import { Logger } from '../logger';
import crypto from 'crypto';

/**
 * API Authentication options
 */
export interface ApiAuthOptions {
    /**
     * Whether to require request signing
     */
    requireSigning?: boolean;

    /**
     * Maximum age of requests in seconds (to prevent replay attacks)
     */
    maxRequestAge?: number;

    /**
     * Whether to validate content type
     */
    validateContentType?: boolean;

    /**
     * Whether to enforce rate limiting
     */
    enableRateLimiting?: boolean;

    /**
     * Rate limit window in seconds
     */
    rateLimitWindowSec?: number;

    /**
     * Maximum requests per window
     */
    maxRequestsPerWindow?: number;
}

/**
 * Default API authentication options
 */
const DEFAULT_OPTIONS: ApiAuthOptions = {
    requireSigning: true,
    maxRequestAge: 300, // 5 minutes
    validateContentType: true,
    enableRateLimiting: true,
    rateLimitWindowSec: 60, // 1 minute
    maxRequestsPerWindow: 100 // 100 requests per minute
};

/**
 * Enhanced API authentication middleware
 */
export function createApiAuthMiddleware(logger: Logger, customOptions: ApiAuthOptions = {}) {
    // Merge default options with custom options
    const options = { ...DEFAULT_OPTIONS, ...customOptions };

    // API key from environment
    const apiKey = process.env.API_KEY || 'easyweb3.TOOLS';

    // API secret from environment (for request signing)
    const apiSecret = process.env.API_SECRET || 'easyweb3.TOOLS';

    // Rate limiting storage (IP -> timestamp[] of requests)
    const rateLimitStore: Map<string, number[]> = new Map();

    // Create module logger
    const moduleLogger = logger.child({ module: 'ApiAuthMiddleware' });

    moduleLogger.info('API authentication middleware initialized', {
        requireSigning: options.requireSigning,
        maxRequestAge: options.maxRequestAge,
        validateContentType: options.validateContentType,
        enableRateLimiting: options.enableRateLimiting,
        rateLimitWindowSec: options.rateLimitWindowSec,
        maxRequestsPerWindow: options.maxRequestsPerWindow
    });

    /**
     * Clean up old rate limit entries
     */
    function cleanupRateLimits() {
        const now = Date.now();
        const windowMs = options.rateLimitWindowSec! * 1000;

        for (const [ip, timestamps] of rateLimitStore.entries()) {
            // Filter out timestamps older than the window
            const validTimestamps = timestamps.filter(ts => now - ts < windowMs);

            if (validTimestamps.length === 0) {
                rateLimitStore.delete(ip);
            } else {
                rateLimitStore.set(ip, validTimestamps);
            }
        }
    }

    // Set up periodic cleanup of rate limit store
    if (options.enableRateLimiting) {
        setInterval(cleanupRateLimits, 60000); // Clean up every minute
    }

    /**
     * Check if a request is rate limited
     */
    function isRateLimited(req: Request): boolean {
        if (!options.enableRateLimiting) {
            return false;
        }

        const ip = req.ip;
        const now = Date.now();
        const windowMs = options.rateLimitWindowSec! * 1000;

        // Get existing timestamps for this IP
        let timestamps = rateLimitStore.get(ip) || [];

        // Filter out timestamps older than the window
        timestamps = timestamps.filter(ts => now - ts < windowMs);

        // Add current timestamp
        timestamps.push(now);

        // Update store
        rateLimitStore.set(ip, timestamps);

        // Check if over limit
        return timestamps.length > options.maxRequestsPerWindow!;
    }

    /**
     * Verify request signature
     */
    function verifySignature(req: Request): boolean {
        if (!options.requireSigning) {
            return true;
        }

        const signature = req.header('X-API-Signature');
        const timestamp = req.header('X-API-Timestamp');
        const nonce = req.header('X-API-Nonce');

        // Check if required headers are present
        if (!signature || !timestamp || !nonce) {
            return false;
        }

        // Check if timestamp is valid
        const requestTime = parseInt(timestamp, 10);
        const now = Math.floor(Date.now() / 1000);

        if (isNaN(requestTime) || now - requestTime > options.maxRequestAge!) {
            return false;
        }

        // Create signature string
        let signatureData = `${req.method.toUpperCase()}:${req.path}:${timestamp}:${nonce}`;

        // Add body to signature if present
        if (req.method !== 'GET' && req.body) {
            try {
                const bodyString = typeof req.body === 'string'
                    ? req.body
                    : JSON.stringify(req.body);
                signatureData += `:${bodyString}`;
            } catch (error) {
                moduleLogger.warn('Failed to stringify request body for signature verification', {
                    error: (error as Error).message,
                    path: req.path
                });
                return false;
            }
        }

        // Calculate expected signature
        const expectedSignature = crypto
            .createHmac('sha256', apiSecret)
            .update(signatureData)
            .digest('hex');

        // Compare signatures
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }

    /**
     * Validate content type
     */
    function validateContentType(req: Request): boolean {
        if (!options.validateContentType) {
            return true;
        }

        // Skip for GET and DELETE requests
        if (req.method === 'GET' || req.method === 'DELETE') {
            return true;
        }

        const contentType = req.header('Content-Type');

        // Check if content type is application/json
        return contentType?.includes('application/json') === true;
    }

    /**
     * The middleware function
     */
    return function apiAuthMiddleware(req: Request, res: Response, next: NextFunction) {
        // Generate request ID for tracking
        const requestId = req.header('X-Request-ID') || crypto.randomUUID();
        res.setHeader('X-Request-ID', requestId);

        // Check API key
        const providedKey = req.header('X-API-Key');

        if (!providedKey || providedKey !== apiKey) {
            moduleLogger.warn('Unauthorized API access attempt: invalid API key', {
                ip: req.ip,
                path: req.path,
                method: req.method,
                requestId
            });

            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Invalid API key',
                code: 'INVALID_API_KEY',
                requestId
            });
        }

        // Check rate limiting
        if (isRateLimited(req)) {
            moduleLogger.warn('Rate limit exceeded', {
                ip: req.ip,
                path: req.path,
                method: req.method,
                requestId
            });

            return res.status(429).json({
                success: false,
                error: 'Too many requests',
                code: 'RATE_LIMIT_EXCEEDED',
                requestId
            });
        }

        // Validate content type
        if (!validateContentType(req)) {
            moduleLogger.warn('Invalid content type', {
                ip: req.ip,
                path: req.path,
                method: req.method,
                contentType: req.header('Content-Type'),
                requestId
            });

            return res.status(415).json({
                success: false,
                error: 'Unsupported Media Type: Content-Type must be application/json',
                code: 'INVALID_CONTENT_TYPE',
                requestId
            });
        }

        // Verify signature
        if (options.requireSigning && !verifySignature(req)) {
            moduleLogger.warn('Invalid request signature', {
                ip: req.ip,
                path: req.path,
                method: req.method,
                requestId
            });

            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Invalid signature',
                code: 'INVALID_SIGNATURE',
                requestId
            });
        }

        // Log successful authentication
        moduleLogger.debug('API request authenticated', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            requestId
        });

        // Add request ID to request object for logging
        req.requestId = requestId;

        next();
    };
}

// Extend Express Request interface to include requestId
declare global {
    namespace Express {
        interface Request {
            requestId?: string;
        }
    }
}