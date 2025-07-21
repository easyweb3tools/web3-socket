/**
 * Base application error class
 * All application-specific errors should extend this class
 */
export class AppError extends Error {
    /**
     * HTTP status code for this error
     */
    public readonly statusCode: number;

    /**
     * Error code for client identification
     */
    public readonly code: string;

    /**
     * Whether this error is operational (expected) or programming error
     */
    public readonly isOperational: boolean;

    /**
     * Additional error details
     */
    public readonly details?: Record<string, any>;

    /**
     * Original error if this is a wrapper
     */
    public readonly cause?: Error;

    constructor(
        message: string,
        statusCode: number = 500,
        code: string = 'INTERNAL_ERROR',
        isOperational: boolean = true,
        details?: Record<string, any>,
        cause?: Error
    ) {
        super(message);

        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        this.details = details;
        this.cause = cause;

        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Convert error to JSON representation
     */
    public toJSON(): Record<string, any> {
        return {
            error: {
                name: this.name,
                message: this.message,
                code: this.code,
                statusCode: this.statusCode,
                isOperational: this.isOperational,
                ...(this.details ? { details: this.details } : {}),
                ...(this.cause ? { cause: this.cause.message } : {})
            }
        };
    }

    /**
     * Create a response object for HTTP responses
     */
    public toResponse(requestId?: string): Record<string, any> {
        return {
            success: false,
            error: {
                message: this.message,
                code: this.code,
                ...(this.details ? { details: this.details } : {}),
                ...(requestId ? { requestId } : {})
            }
        };
    }
}