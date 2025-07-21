import { createValidationMiddleware, createSanitizationMiddleware } from '../middleware/validation';
import { Request, Response } from 'express';
import { body } from 'express-validator';

describe('Validation Middleware', () => {
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

    describe('Validation Middleware', () => {
        it('should pass validation for valid data', async () => {
            // Create validation rules
            const validations = [
                body('name').isString().notEmpty(),
                body('age').isInt({ min: 0 })
            ];

            // Create middleware
            const middleware = createValidationMiddleware(validations, mockLogger as any);

            // Mock request with valid data
            const req = {
                body: {
                    name: 'John Doe',
                    age: 30
                },
                requestId: 'test-request-id'
            } as unknown as Request;

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            } as unknown as Response;

            const next = jest.fn();

            // Call middleware
            await middleware(req, res, next);

            // Verify next was called
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
        });

        it('should reject validation for invalid data', async () => {
            // Create validation rules
            const validations = [
                body('name').isString().notEmpty(),
                body('age').isInt({ min: 0 })
            ];

            // Create middleware
            const middleware = createValidationMiddleware(validations, mockLogger as any);

            // Mock request with invalid data
            const req = {
                body: {
                    name: '',
                    age: -5
                },
                requestId: 'test-request-id',
                path: '/api/test',
                method: 'POST'
            } as unknown as Request;

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            } as unknown as Response;

            const next = jest.fn();

            // Call middleware
            await middleware(req, res, next);

            // Verify response
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: expect.any(Array)
            }));

            // Verify details contain both errors
            const details = res.json.mock.calls[0][0].details;
            expect(details.length).toBe(2);
            expect(details.some(d => d.path === 'name')).toBe(true);
            expect(details.some(d => d.path === 'age')).toBe(true);
        });
    });

    describe('Sanitization Middleware', () => {
        it('should sanitize HTML in string fields', () => {
            // Create middleware
            const middleware = createSanitizationMiddleware({
                removeHtml: true
            }, mockLogger as any);

            // Mock request with HTML in fields
            const req = {
                method: 'POST',
                body: {
                    name: '<script>alert("XSS")</script>John Doe',
                    description: '<p>This is a <strong>description</strong></p>',
                    tags: ['<b>tag1</b>', '<i>tag2</i>'],
                    nested: {
                        html: '<div>Nested HTML</div>'
                    }
                }
            } as unknown as Request;

            const res = {} as unknown as Response;
            const next = jest.fn();

            // Call middleware
            middleware(req, res, next);

            // Verify HTML was removed
            expect(req.body.name).toBe('alert("XSS")John Doe');
            expect(req.body.description).toBe('This is a description');
            expect(req.body.tags).toEqual(['tag1', 'tag2']);
            expect(req.body.nested.html).toBe('Nested HTML');

            // Verify next was called
            expect(next).toHaveBeenCalled();
        });

        it('should truncate long strings', () => {
            // Create middleware
            const middleware = createSanitizationMiddleware({
                maxLength: 10
            }, mockLogger as any);

            // Mock request with long strings
            const req = {
                method: 'POST',
                body: {
                    shortString: 'Short',
                    longString: 'This is a very long string that should be truncated',
                    nested: {
                        longString: 'Another very long string that should be truncated'
                    }
                }
            } as unknown as Request;

            const res = {} as unknown as Response;
            const next = jest.fn();

            // Call middleware
            middleware(req, res, next);

            // Verify strings were truncated
            expect(req.body.shortString).toBe('Short');
            expect(req.body.longString).toBe('This is a ');
            expect(req.body.nested.longString).toBe('Another ve');

            // Verify next was called
            expect(next).toHaveBeenCalled();
        });

        it('should sanitize only specific fields if configured', () => {
            // Create middleware
            const middleware = createSanitizationMiddleware({
                fields: ['name', 'nested.html'],
                removeHtml: true,
                sanitizeAll: false
            }, mockLogger as any);

            // Mock request with HTML in fields
            const req = {
                method: 'POST',
                body: {
                    name: '<script>alert("XSS")</script>John Doe',
                    description: '<p>This is a <strong>description</strong></p>',
                    nested: {
                        html: '<div>Nested HTML</div>'
                    }
                }
            } as unknown as Request;

            const res = {} as unknown as Response;
            const next = jest.fn();

            // Call middleware
            middleware(req, res, next);

            // Verify only specified fields were sanitized
            expect(req.body.name).toBe('alert("XSS")John Doe');
            expect(req.body.description).toBe('<p>This is a <strong>description</strong></p>');
            expect(req.body.nested.html).toBe('Nested HTML');

            // Verify next was called
            expect(next).toHaveBeenCalled();
        });

        it('should skip sanitization for GET requests', () => {
            // Create middleware
            const middleware = createSanitizationMiddleware({
                removeHtml: true
            }, mockLogger as any);

            // Mock GET request
            const req = {
                method: 'GET',
                body: {
                    name: '<script>alert("XSS")</script>John Doe'
                }
            } as unknown as Request;

            const res = {} as unknown as Response;
            const next = jest.fn();

            // Call middleware
            middleware(req, res, next);

            // Verify body was not modified
            expect(req.body.name).toBe('<script>alert("XSS")</script>John Doe');

            // Verify next was called
            expect(next).toHaveBeenCalled();
        });
    });
});