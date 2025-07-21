import { AppError } from './app-error';

/**
 * Authentication error
 * Used when authentication fails
 */
export class AuthenticationError extends AppError {
    constructor(
        message: string = 'Authentication failed',
        details?: Record<string, any>,
        cause?: Error
    ) {
        super(message, 401, 'AUTHENTICATION_ERROR', true, details, cause);
    }
}

/**
 * Authorization error
 * Used when a user doesn't have permission to perform an action
 */
export class AuthorizationError extends AppError {
    constructor(
        message: string = 'Not authorized to perform this action',
        details?: Record<string, any>,
        cause?: Error
    ) {
        super(message, 403, 'AUTHORIZATION_ERROR', true, details, cause);
    }
}

/**
 * Validation error
 * Used when input validation fails
 */
export class ValidationError extends AppError {
    constructor(
        message: string = 'Validation failed',
        details?: Record<string, any>,
        cause?: Error
    ) {
        super(message, 400, 'VALIDATION_ERROR', true, details, cause);
    }
}

/**
 * Not found error
 * Used when a requested resource is not found
 */
export class NotFoundError extends AppError {
    constructor(
        message: string = 'Resource not found',
        details?: Record<string, any>,
        cause?: Error
    ) {
        super(message, 404, 'NOT_FOUND', true, details, cause);
    }
}

/**
 * Rate limit error
 * Used when a rate limit is exceeded
 */
export class RateLimitError extends AppError {
    constructor(
        message: string = 'Rate limit exceeded',
        details?: Record<string, any>,
        cause?: Error
    ) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED', true, details, cause);
    }
}

/**
 * Connection error
 * Used for Socket.IO connection issues
 */
export class ConnectionError extends AppError {
    constructor(
        message: string = 'Connection error',
        details?: Record<string, any>,
        cause?: Error
    ) {
        super(message, 500, 'CONNECTION_ERROR', true, details, cause);
    }
}

/**
 * Message delivery error
 * Used when a message cannot be delivered
 */
export class MessageDeliveryError extends AppError {
    constructor(
        message: string = 'Message delivery failed',
        details?: Record<string, any>,
        cause?: Error
    ) {
        super(message, 500, 'MESSAGE_DELIVERY_ERROR', true, details, cause);
    }
}

/**
 * Backend service error
 * Used when communication with the backend service fails
 */
export class BackendServiceError extends AppError {
    constructor(
        message: string = 'Backend service error',
        details?: Record<string, any>,
        cause?: Error
    ) {
        super(message, 502, 'BACKEND_SERVICE_ERROR', true, details, cause);
    }
}

/**
 * Configuration error
 * Used when there's an issue with the application configuration
 */
export class ConfigurationError extends AppError {
    constructor(
        message: string = 'Configuration error',
        details?: Record<string, any>,
        cause?: Error
    ) {
        super(message, 500, 'CONFIGURATION_ERROR', false, details, cause);
    }
}

/**
 * Database error
 * Used when there's an issue with database operations
 */
export class DatabaseError extends AppError {
    constructor(
        message: string = 'Database error',
        details?: Record<string, any>,
        cause?: Error
    ) {
        super(message, 500, 'DATABASE_ERROR', true, details, cause);
    }
}

/**
 * External service error
 * Used when communication with an external service fails
 */
export class ExternalServiceError extends AppError {
    constructor(
        message: string = 'External service error',
        details?: Record<string, any>,
        cause?: Error
    ) {
        super(message, 502, 'EXTERNAL_SERVICE_ERROR', true, details, cause);
    }
}

/**
 * Timeout error
 * Used when an operation times out
 */
export class TimeoutError extends AppError {
    constructor(
        message: string = 'Operation timed out',
        details?: Record<string, any>,
        cause?: Error
    ) {
        super(message, 504, 'TIMEOUT', true, details, cause);
    }
}

/**
 * Resource exhaustion error
 * Used when system resources are exhausted
 */
export class ResourceExhaustionError extends AppError {
    constructor(
        message: string = 'System resources exhausted',
        details?: Record<string, any>,
        cause?: Error
    ) {
        super(message, 503, 'RESOURCE_EXHAUSTION', true, details, cause);
    }
}

/**
 * Socket event error
 * Used for Socket.IO event handling errors
 */
export class SocketEventError extends AppError {
    constructor(
        message: string = 'Socket event error',
        details?: Record<string, any>,
        cause?: Error
    ) {
        super(message, 500, 'SOCKET_EVENT_ERROR', true, details, cause);
    }
}