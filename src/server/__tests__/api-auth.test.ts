import { createApiAuthMiddleware } from '../middleware/api-auth';
import { Request, Response } from 'express';
import crypto from 'crypto';

describe('API Authentication Middleware', () => {
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
        process.env.API_KEY = 'test_api_key';
        process.env.API_SECRET = 'test_api_secret';
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('should reject requests without API key', () => {
        // Create middleware
        const middleware = createApiAuthMiddleware(mockLogger as any);

        // Mock request and response
        const req = {
            ip: '127.0.0.1',
            path: '/api/test',
            method: 'GET',
            header: jest.fn().mockReturnValue(null)
        } as unknown as Request;

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn()
        } as unknown as Response;

        const next = jest.fn();

        // Call middleware
        middleware(req, res, next);

        // Verify response
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            error: expect.stringContaining('Invalid API key'),
            code: 'INVALID_API_KEY'
        }));
        expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid API key', () => {
        // Create middleware
        const middleware = createApiAuthMiddleware(mockLogger as any);

        // Mock request and response
        const req = {
            ip: '127.0.0.1',
            path: '/api/test',
            method: 'GET',
            header: jest.fn().mockImplementation(name => {
                if (name === 'X-API-Key') return 'invalid_key';
                return null;
            })
        } as unknown as Request;

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn()
        } as unknown as Response;

        const next = jest.fn();

        // Call middleware
        middleware(req, res, next);

        // Verify response
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            error: expect.stringContaining('Invalid API key'),
            code: 'INVALID_API_KEY'
        }));
        expect(next).not.toHaveBeenCalled();
    });

    it('should accept requests with valid API key when signing is disabled', () => {
        // Create middleware with signing disabled
        const middleware = createApiAuthMiddleware(mockLogger as any, {
            requireSigning: false
        });

        // Mock request and response
        const req = {
            ip: '127.0.0.1',
            path: '/api/test',
            method: 'GET',
            header: jest.fn().mockImplementation(name => {
                if (name === 'X-API-Key') return 'test_api_key';
                return null;
            }),
            requestId: undefined
        } as unknown as Request;

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn()
        } as unknown as Response;

        const next = jest.fn();

        // Call middleware
        middleware(req, res, next);

        // Verify next was called
        expect(next).toHaveBeenCalled();
        expect(req.requestId).toBeDefined();
    });

    it('should reject requests with invalid content type', () => {
        // Create middleware with content type validation
        const middleware = createApiAuthMiddleware(mockLogger as any, {
            requireSigning: false,
            validateContentType: true
        });

        // Mock request and response
        const req = {
            ip: '127.0.0.1',
            path: '/api/test',
            method: 'POST',
            header: jest.fn().mockImplementation(name => {
                if (name === 'X-API-Key') return 'test_api_key';
                if (name === 'Content-Type') return 'text/plain';
                return null;
            })
        } as unknown as Request;

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn()
        } as unknown as Response;

        const next = jest.fn();

        // Call middleware
        middleware(req, res, next);

        // Verify response
        expect(res.status).toHaveBeenCalledWith(415);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            error: expect.stringContaining('Content-Type'),
            code: 'INVALID_CONTENT_TYPE'
        }));
        expect(next).not.toHaveBeenCalled();
    });

    it('should accept requests with valid signature', () => {
        // Create middleware with signing required
        const middleware = createApiAuthMiddleware(mockLogger as any, {
            requireSigning: true
        });

        // Current timestamp
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = 'test_nonce';

        // Create signature
        const signatureData = `GET:/api/test:${timestamp}:${nonce}`;
        const signature = crypto
            .createHmac('sha256', 'test_api_secret')
            .update(signatureData)
            .digest('hex');

        // Mock request and response
        const req = {
            ip: '127.0.0.1',
            path: '/api/test',
            method: 'GET',
            header: jest.fn().mockImplementation(name => {
                if (name === 'X-API-Key') return 'test_api_key';
                if (name === 'X-API-Signature') return signature;
                if (name === 'X-API-Timestamp') return timestamp;
                if (name === 'X-API-Nonce') return nonce;
                return null;
            }),
            requestId: undefined
        } as unknown as Request;

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn()
        } as unknown as Response;

        const next = jest.fn();

        // Call middleware
        middleware(req, res, next);

        // Verify next was called
        expect(next).toHaveBeenCalled();
    });

    it('should reject requests with invalid signature', () => {
        // Create middleware with signing required
        const middleware = createApiAuthMiddleware(mockLogger as any, {
            requireSigning: true
        });

        // Current timestamp
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = 'test_nonce';

        // Invalid signature
        const signature = 'invalid_signature';

        // Mock request and response
        const req = {
            ip: '127.0.0.1',
            path: '/api/test',
            method: 'GET',
            header: jest.fn().mockImplementation(name => {
                if (name === 'X-API-Key') return 'test_api_key';
                if (name === 'X-API-Signature') return signature;
                if (name === 'X-API-Timestamp') return timestamp;
                if (name === 'X-API-Nonce') return nonce;
                return null;
            })
        } as unknown as Request;

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn()
        } as unknown as Response;

        const next = jest.fn();

        // Call middleware
        middleware(req, res, next);

        // Verify response
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            error: expect.stringContaining('Invalid signature'),
            code: 'INVALID_SIGNATURE'
        }));
        expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with expired timestamp', () => {
        // Create middleware with signing required
        const middleware = createApiAuthMiddleware(mockLogger as any, {
            requireSigning: true,
            maxRequestAge: 60 // 1 minute
        });

        // Expired timestamp (10 minutes ago)
        const timestamp = (Math.floor(Date.now() / 1000) - 600).toString();
        const nonce = 'test_nonce';

        // Create signature
        const signatureData = `GET:/api/test:${timestamp}:${nonce}`;
        const signature = crypto
            .createHmac('sha256', 'test_api_secret')
            .update(signatureData)
            .digest('hex');

        // Mock request and response
        const req = {
            ip: '127.0.0.1',
            path: '/api/test',
            method: 'GET',
            header: jest.fn().mockImplementation(name => {
                if (name === 'X-API-Key') return 'test_api_key';
                if (name === 'X-API-Signature') return signature;
                if (name === 'X-API-Timestamp') return timestamp;
                if (name === 'X-API-Nonce') return nonce;
                return null;
            })
        } as unknown as Request;

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn()
        } as unknown as Response;

        const next = jest.fn();

        // Call middleware
        middleware(req, res, next);

        // Verify response
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            error: expect.stringContaining('Invalid signature'),
            code: 'INVALID_SIGNATURE'
        }));
        expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests when rate limit is exceeded', () => {
        // Create middleware with rate limiting
        const middleware = createApiAuthMiddleware(mockLogger as any, {
            requireSigning: false,
            enableRateLimiting: true,
            maxRequestsPerWindow: 2,
            rateLimitWindowSec: 60
        });

        // Mock request and response
        const req = {
            ip: '127.0.0.1',
            path: '/api/test',
            method: 'GET',
            header: jest.fn().mockImplementation(name => {
                if (name === 'X-API-Key') return 'test_api_key';
                return null;
            })
        } as unknown as Request;

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn()
        } as unknown as Response;

        const next = jest.fn();

        // First request should pass
        middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);

        // Reset mocks
        jest.clearAllMocks();

        // Second request should pass
        middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);

        // Reset mocks
        jest.clearAllMocks();

        // Third request should be rate limited
        middleware(req, res, next);

        // Verify response
        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            error: expect.stringContaining('Too many requests'),
            code: 'RATE_LIMIT_EXCEEDED'
        }));
        expect(next).not.toHaveBeenCalled();
    });
});