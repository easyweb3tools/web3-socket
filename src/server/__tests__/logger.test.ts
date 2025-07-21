import { setupLogger, Logger, LogEntry } from '../logger';
import * as ipMasker from '../utils/ip-masker';

// Mock dependencies
jest.mock('../utils/ip-masker', () => ({
    maskIPsInObject: jest.fn(obj => obj)
}));

// Mock environment variables
process.env.LOG_LEVEL = 'debug';
process.env.LOG_TO_FILE = 'false';
process.env.LOG_PRETTY = 'false';
process.env.LOG_MASK_IP_ADDRESSES = 'true';
process.env.LOG_REDACT_PII = 'true';

describe('Logger', () => {
    let logger: Logger;

    beforeEach(() => {
        // Create a new logger instance for each test
        logger = setupLogger();
    });

    it('should log messages at different levels', () => {
        // Log messages at different levels
        logger.info('Info message');
        logger.warn('Warning message');
        logger.error('Error message');
        logger.debug('Debug message');

        // Get recent logs
        const logs = logger.getRecentLogs();

        // Check that all messages were logged
        expect(logs.length).toBeGreaterThanOrEqual(4);

        // Check log levels
        expect(logs.some(log => log.level === 'info' && log.message === 'Info message')).toBe(true);
        expect(logs.some(log => log.level === 'warn' && log.message === 'Warning message')).toBe(true);
        expect(logs.some(log => log.level === 'error' && log.message === 'Error message')).toBe(true);
        expect(logs.some(log => log.level === 'debug' && log.message === 'Debug message')).toBe(true);
    });

    it('should include metadata in logs', () => {
        // Log with metadata
        const meta = { userId: '123', action: 'test' };
        logger.info('Info with metadata', meta);

        // Get recent logs
        const logs = logger.getRecentLogs();
        const logEntry = logs.find(log => log.message === 'Info with metadata');

        // Check that metadata was included
        expect(logEntry).toBeDefined();
        expect(logEntry?.userId).toBe('123');
        expect(logEntry?.action).toBe('test');
    });

    it('should redact sensitive information', () => {
        // Log with sensitive information
        const sensitiveData = {
            username: 'testuser',
            password: 'secret123',
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
            data: {
                apiKey: 'api-key-value'
            }
        };

        logger.info('Sensitive data', sensitiveData);

        // Get recent logs
        const logs = logger.getRecentLogs();
        const logEntry = logs.find(log => log.message === 'Sensitive data');

        // Check that sensitive information was redacted
        expect(logEntry).toBeDefined();
        expect(logEntry?.username).toBe('testuser');
        expect(logEntry?.password).toBe('[REDACTED]');
        expect(logEntry?.token).toBe('[REDACTED]');
        expect(logEntry?.data?.apiKey).toBe('[REDACTED]');
    });

    it('should create child loggers with context', () => {
        // Create child logger
        const childLogger = logger.child({ component: 'test-component', requestId: '456' });

        // Log with child logger
        childLogger.info('Child logger message');

        // Get recent logs
        const logs = logger.getRecentLogs();
        const logEntry = logs.find(log => log.message === 'Child logger message');

        // Check that context was included
        expect(logEntry).toBeDefined();
        expect(logEntry?.component).toBe('test-component');
        expect(logEntry?.requestId).toBe('456');
    });

    it('should include error details', () => {
        // Create an error
        const error = new Error('Test error');

        // Log error
        logger.error('Error occurred', error);

        // Get recent logs
        const logs = logger.getRecentLogs();
        const logEntry = logs.find(log => log.message === 'Error occurred');

        // Check that error details were included
        expect(logEntry).toBeDefined();
        expect(logEntry?.error).toBeDefined();
        expect(logEntry?.error?.message).toBe('Test error');
        expect(logEntry?.error?.name).toBe('Error');
        expect(logEntry?.error?.stack).toBeDefined();
    });

    it('should limit the number of logs returned', () => {
        // Log multiple messages
        for (let i = 0; i < 20; i++) {
            logger.info(`Message ${i}`);
        }

        // Get recent logs with limit
        const logs = logger.getRecentLogs(5);

        // Check that only the specified number of logs were returned
        expect(logs.length).toBe(5);

        // Check that the most recent logs were returned
        expect(logs[4].message).toBe('Message 19');
        expect(logs[3].message).toBe('Message 18');
    });

    it('should mask IP addresses when enabled', () => {
        // Reset mock
        (ipMasker.maskIPsInObject as jest.Mock).mockClear();

        // Log with IP addresses
        const meta = {
            clientIp: '192.168.1.1',
            serverData: {
                ipAddress: '10.0.0.1'
            }
        };

        logger.info('Connection info', meta);

        // Verify IP masking was called
        expect(ipMasker.maskIPsInObject).toHaveBeenCalledWith(expect.objectContaining({
            clientIp: '192.168.1.1',
            serverData: {
                ipAddress: '10.0.0.1'
            }
        }));
    });

    it('should redact PII in log messages', () => {
        // Log with PII
        const meta = {
            user: {
                email: 'user@example.com',
                phone: '555-123-4567',
                creditCard: '4111-1111-1111-1111',
                ssn: '123-45-6789'
            }
        };

        logger.info('User data', meta);

        // Get recent logs
        const logs = logger.getRecentLogs();
        const logEntry = logs.find(log => log.message === 'User data');

        // Check that PII was redacted
        expect(logEntry).toBeDefined();
        expect(logEntry?.user?.email).not.toBe('user@example.com');
        expect(logEntry?.user?.phone).not.toBe('555-123-4567');
        expect(logEntry?.user?.creditCard).not.toBe('4111-1111-1111-1111');
        expect(logEntry?.user?.ssn).not.toBe('123-45-6789');
    });

    it('should sanitize error objects', () => {
        // Create an error with sensitive information
        const error = new Error('Authentication failed');
        (error as any).token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
        (error as any).user = { email: 'user@example.com' };
        (error as any).request = { headers: { authorization: 'Bearer token123' } };

        // Log error
        logger.error('Error processing request', error);

        // Get recent logs
        const logs = logger.getRecentLogs();
        const logEntry = logs.find(log => log.message === 'Error processing request');

        // Check that error details were sanitized
        expect(logEntry).toBeDefined();
        expect(logEntry?.error).toBeDefined();
        expect(logEntry?.error?.message).toBe('Authentication failed');
        expect(logEntry?.error?.details?.token).toBe('[REDACTED]');
        expect(logEntry?.error?.details?.user?.email).not.toBe('user@example.com');
        expect(logEntry?.error?.details?.request?.headers?.authorization).toBe('[REDACTED]');
    });

    it('should work with child loggers and secure logging', () => {
        // Create child logger
        const childLogger = logger.child({ component: 'auth-service', requestId: '456' });

        // Log with sensitive information
        childLogger.info('User login', {
            userId: '123',
            ip: '192.168.1.1',
            credentials: 'password123'
        });

        // Get recent logs
        const logs = logger.getRecentLogs();
        const logEntry = logs.find(log =>
            log.message === 'User login' &&
            log.component === 'auth-service'
        );

        // Check that context was included and sensitive info was redacted
        expect(logEntry).toBeDefined();
        expect(logEntry?.component).toBe('auth-service');
        expect(logEntry?.requestId).toBe('456');
        expect(logEntry?.userId).toBe('123');
        expect(logEntry?.credentials).toBe('[REDACTED]');

        // Verify IP masking was called
        expect(ipMasker.maskIPsInObject).toHaveBeenCalled();
    });
});