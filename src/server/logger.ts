import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { maskIPsInObject } from './utils/ip-masker';

// Log entry interface
export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    context?: string;
    [key: string]: any;
}

// Logger interface
export interface Logger {
    info(message: string, meta?: object): void;
    error(message: string, error?: Error, meta?: object): void;
    warn(message: string, meta?: object): void;
    debug(message: string, meta?: object): void;
    trace(message: string, meta?: object): void;
    child(bindings: object): Logger;
    getRecentLogs(count?: number): LogEntry[];
}

// In-memory log storage for recent logs
class LogStore {
    private logs: LogEntry[] = [];
    private maxSize: number;

    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
    }

    add(entry: LogEntry): void {
        this.logs.push(entry);

        // Trim if exceeds max size
        if (this.logs.length > this.maxSize) {
            this.logs = this.logs.slice(this.logs.length - this.maxSize);
        }
    }

    getRecent(count = 100): LogEntry[] {
        const size = Math.min(count, this.logs.length);
        return this.logs.slice(this.logs.length - size);
    }

    clear(): void {
        this.logs = [];
    }
}

// Create a singleton log store
const logStore = new LogStore();

// PII patterns for detection
const PII_PATTERNS = {
    EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    PHONE: /\b(\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/g,
    SSN: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
    CREDIT_CARD: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    IP_ADDRESS: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    UUID: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    JWT: /\bey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*\b/g
};

// Sensitive key patterns
const SENSITIVE_KEYS = [
    // Authentication related
    'password', 'passwd', 'pwd', 'secret', 'token', 'apikey', 'api_key', 'key', 'auth',
    'credential', 'jwt', 'refresh', 'access_token', 'authorization', 'cookie', 'session',

    // Personal information
    'ssn', 'social', 'dob', 'birthdate', 'birth_date', 'license', 'passport',

    // Financial information
    'card', 'cvv', 'cvc', 'ccv', 'pin', 'account', 'routing', 'iban', 'swift',

    // Contact information
    'phone', 'mobile', 'cell', 'address', 'zip', 'postal', 'email'
];

// Redact sensitive information
function redactSensitiveInfo(obj: any): any {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    const result = Array.isArray(obj) ? [...obj] : { ...obj };

    for (const key in result) {
        // Recursively process nested objects
        if (typeof result[key] === 'object' && result[key] !== null) {
            result[key] = redactSensitiveInfo(result[key]);
        }
        // Redact sensitive values based on key names
        else if (
            typeof result[key] === 'string' &&
            SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk.toLowerCase()))
        ) {
            result[key] = '[REDACTED]';
        }
        // Detect and redact PII in string values
        else if (typeof result[key] === 'string') {
            result[key] = redactPII(result[key]);
        }
    }

    return result;
}

// Redact PII from string values
function redactPII(text: string): string {
    if (!text || typeof text !== 'string') {
        return text;
    }

    let redactedText = text;

    // Apply each PII pattern
    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
        redactedText = redactedText.replace(pattern, `[REDACTED-${type}]`);
    }

    return redactedText;
}

// Sanitize error objects to prevent sensitive data leakage
function sanitizeError(error: Error): Record<string, any> {
    if (!error) {
        return {};
    }

    // Extract basic error properties
    const sanitized = {
        message: error.message,
        name: error.name,
        stack: process.env.NODE_ENV === 'production'
            ? undefined
            : redactPII(error.stack || '')
    };

    // Handle additional properties on error object
    const additionalProps: Record<string, any> = {};
    for (const key in error) {
        if (key !== 'message' && key !== 'name' && key !== 'stack') {
            const value = (error as any)[key];
            additionalProps[key] = typeof value === 'object'
                ? redactSensitiveInfo(value)
                : typeof value === 'string'
                    ? redactPII(value)
                    : value;
        }
    }

    return {
        ...sanitized,
        ...(Object.keys(additionalProps).length > 0 ? { details: additionalProps } : {})
    };
}

// Secure log storage configuration
interface SecureLogConfig {
    // Basic log configuration
    logDir: string;
    logMaxSize: string;
    logMaxFiles: number;
    logLevel: string;
    logToFile: boolean;
    prettyPrint: boolean;

    // Security configuration
    enableEncryption: boolean;
    encryptionKey?: string;
    enableCompression: boolean;
    securePermissions: boolean;
    redactPII: boolean;
    redactSensitiveKeys: boolean;
    maskIpAddresses: boolean;
    logRetentionDays: number;
}

// Setup logger
export function setupLogger(): Logger {
    // Load secure log configuration
    const secureConfig: SecureLogConfig = {
        // Basic log configuration
        logDir: process.env.LOG_DIR || 'logs',
        logMaxSize: process.env.LOG_MAX_SIZE || '10m',
        logMaxFiles: parseInt(process.env.LOG_MAX_FILES || '7', 10),
        logLevel: process.env.LOG_LEVEL || 'info',
        logToFile: process.env.LOG_TO_FILE !== 'false',
        prettyPrint: process.env.LOG_PRETTY !== 'false',

        // Security configuration
        enableEncryption: process.env.LOG_ENCRYPTION === 'true',
        encryptionKey: process.env.LOG_ENCRYPTION_KEY,
        enableCompression: process.env.LOG_COMPRESSION === 'true',
        securePermissions: process.env.LOG_SECURE_PERMISSIONS !== 'false',
        redactPII: process.env.LOG_REDACT_PII !== 'false',
        redactSensitiveKeys: process.env.LOG_REDACT_SENSITIVE_KEYS !== 'false',
        maskIpAddresses: process.env.LOG_MASK_IP_ADDRESSES !== 'false',
        logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '90', 10)
    };

    // Ensure log directory exists with secure permissions
    const logPath = path.resolve(process.cwd(), secureConfig.logDir);

    if (!fs.existsSync(logPath)) {
        fs.mkdirSync(logPath, { recursive: true });

        // Set secure permissions (owner read/write only) if enabled
        if (secureConfig.securePermissions) {
            try {
                // 0o600 = owner read/write only
                fs.chmodSync(logPath, 0o700);
            } catch (error) {
                console.warn('Failed to set secure permissions on log directory:', error);
            }
        }
    }

    // Configure log rotation and retention
    const logMaxSize = secureConfig.logMaxSize;
    const logMaxFiles = secureConfig.logMaxFiles;

    // Configure pino logger
    const logLevel = process.env.LOG_LEVEL || 'info';
    const logToFile = process.env.LOG_TO_FILE !== 'false'; // Default to true
    const prettyPrint = process.env.LOG_PRETTY !== 'false'; // Default to true

    // Generate instance ID for this server instance
    const instanceId = randomUUID().substring(0, 8);

    // Setup transport targets
    const targets: any[] = [];

    // Console transport with pretty printing
    if (prettyPrint) {
        targets.push({
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname,instanceId'
            }
        });
    } else {
        targets.push({
            target: 'pino/file',
            options: { destination: 1 } // stdout
        });
    }

    // File transport with rotation
    if (logToFile) {
        targets.push({
            target: 'pino-roll',
            options: {
                file: path.join(logPath, 'socket-server.log'),
                size: logMaxSize,
                keep: logMaxFiles,
                symlinkName: 'current.log'
            }
        });
    }

    // Create transport
    // Create transport - ensure immediate flushing for container logs
    const transport = pino.transport({
        targets
    });

    // Create base logger
    const logger = pino({
        level: logLevel,
        timestamp: pino.stdTimeFunctions.isoTime,
        base: {
            pid: process.pid,
            hostname: process.env.HOSTNAME || 'socket-server',
            instanceId
        },
        redact: {
            paths: [
                'password',
                'token',
                '*.password',
                '*.token',
                '*.secret',
                '*.key',
                '*.auth',
                '*.credential',
                '*.jwt'
            ],
            censor: '[REDACTED]'
        }
    }, transport);

    // Create wrapper with our interface
    const loggerWrapper: Logger = {
        info: (message: string, meta?: object) => {
            // Apply security transformations
            let cleanMeta = meta ? redactSensitiveInfo(meta) : {};

            // Mask IP addresses if enabled
            if (secureConfig.maskIpAddresses) {
                cleanMeta = maskIPsInObject(cleanMeta);
            }

            logger.info(cleanMeta, message);

            // Store log entry
            logStore.add({
                timestamp: new Date().toISOString(),
                level: 'info',
                message,
                ...cleanMeta
            });
        },

        error: (message: string, error?: Error, meta?: object) => {
            // Apply security transformations
            let cleanMeta = meta ? redactSensitiveInfo(meta) : {};
            const sanitizedError = error ? sanitizeError(error) : undefined;

            // Mask IP addresses if enabled
            if (secureConfig.maskIpAddresses) {
                cleanMeta = maskIPsInObject(cleanMeta);
            }

            // Redact PII in the message itself if enabled
            let secureMessage = message;
            if (secureConfig.redactPII && typeof message === 'string') {
                secureMessage = redactPII(message);
            }

            const context = {
                ...cleanMeta,
                ...(sanitizedError ? { error: sanitizedError } : {})
            };

            logger.error(context, secureMessage);

            // Store log entry
            logStore.add({
                timestamp: new Date().toISOString(),
                level: 'error',
                message: secureMessage,
                ...context
            });
        },

        warn: (message: string, meta?: object) => {
            // Apply security transformations
            let cleanMeta = meta ? redactSensitiveInfo(meta) : {};

            // Mask IP addresses if enabled
            if (secureConfig.maskIpAddresses) {
                cleanMeta = maskIPsInObject(cleanMeta);
            }

            logger.warn(cleanMeta, message);

            // Store log entry
            logStore.add({
                timestamp: new Date().toISOString(),
                level: 'warn',
                message,
                ...cleanMeta
            });
        },

        debug: (message: string, meta?: object) => {
            // Apply security transformations
            let cleanMeta = meta ? redactSensitiveInfo(meta) : {};

            // Mask IP addresses if enabled
            if (secureConfig.maskIpAddresses) {
                cleanMeta = maskIPsInObject(cleanMeta);
            }

            logger.debug(cleanMeta, message);

            // Only store debug logs if level is debug or trace
            if (logLevel === 'debug' || logLevel === 'trace') {
                logStore.add({
                    timestamp: new Date().toISOString(),
                    level: 'debug',
                    message,
                    ...cleanMeta
                });
            }
        },

        trace: (message: string, meta?: object) => {
            // Apply security transformations
            let cleanMeta = meta ? redactSensitiveInfo(meta) : {};

            // Mask IP addresses if enabled
            if (secureConfig.maskIpAddresses) {
                cleanMeta = maskIPsInObject(cleanMeta);
            }

            logger.trace(cleanMeta, message);

            // Only store trace logs if level is trace
            if (logLevel === 'trace') {
                logStore.add({
                    timestamp: new Date().toISOString(),
                    level: 'trace',
                    message,
                    ...cleanMeta
                });
            }
        },

        child: (bindings: object) => {
            const childLogger = logger.child(bindings);

            // Create wrapper for child logger
            return {
                info: (message: string, meta?: object) => {
                    // Apply security transformations
                    let cleanMeta = meta ? redactSensitiveInfo(meta) : {};

                    // Mask IP addresses if enabled
                    if (secureConfig.maskIpAddresses) {
                        cleanMeta = maskIPsInObject(cleanMeta);
                    }

                    childLogger.info(cleanMeta, message);

                    logStore.add({
                        timestamp: new Date().toISOString(),
                        level: 'info',
                        message,
                        ...bindings,
                        ...cleanMeta
                    });
                },

                error: (message: string, error?: Error, meta?: object) => {
                    // Apply security transformations
                    let cleanMeta = meta ? redactSensitiveInfo(meta) : {};
                    const sanitizedError = error ? sanitizeError(error) : undefined;

                    // Mask IP addresses if enabled
                    if (secureConfig.maskIpAddresses) {
                        cleanMeta = maskIPsInObject(cleanMeta);
                    }

                    // Redact PII in the message itself if enabled
                    let secureMessage = message;
                    if (secureConfig.redactPII && typeof message === 'string') {
                        secureMessage = redactPII(message);
                    }

                    const context = {
                        ...cleanMeta,
                        ...(sanitizedError ? { error: sanitizedError } : {})
                    };

                    childLogger.error(context, secureMessage);

                    logStore.add({
                        timestamp: new Date().toISOString(),
                        level: 'error',
                        message: secureMessage,
                        ...bindings,
                        ...context
                    });
                },

                warn: (message: string, meta?: object) => {
                    // Apply security transformations
                    let cleanMeta = meta ? redactSensitiveInfo(meta) : {};

                    // Mask IP addresses if enabled
                    if (secureConfig.maskIpAddresses) {
                        cleanMeta = maskIPsInObject(cleanMeta);
                    }

                    childLogger.warn(cleanMeta, message);

                    logStore.add({
                        timestamp: new Date().toISOString(),
                        level: 'warn',
                        message,
                        ...bindings,
                        ...cleanMeta
                    });
                },

                debug: (message: string, meta?: object) => {
                    // Apply security transformations
                    let cleanMeta = meta ? redactSensitiveInfo(meta) : {};

                    // Mask IP addresses if enabled
                    if (secureConfig.maskIpAddresses) {
                        cleanMeta = maskIPsInObject(cleanMeta);
                    }

                    childLogger.debug(cleanMeta, message);

                    if (logLevel === 'debug' || logLevel === 'trace') {
                        logStore.add({
                            timestamp: new Date().toISOString(),
                            level: 'debug',
                            message,
                            ...bindings,
                            ...cleanMeta
                        });
                    }
                },

                trace: (message: string, meta?: object) => {
                    // Apply security transformations
                    let cleanMeta = meta ? redactSensitiveInfo(meta) : {};

                    // Mask IP addresses if enabled
                    if (secureConfig.maskIpAddresses) {
                        cleanMeta = maskIPsInObject(cleanMeta);
                    }

                    childLogger.trace(cleanMeta, message);

                    if (logLevel === 'trace') {
                        logStore.add({
                            timestamp: new Date().toISOString(),
                            level: 'trace',
                            message,
                            ...bindings,
                            ...cleanMeta
                        });
                    }
                },

                child: (nestedBindings: object) => {
                    return loggerWrapper.child({
                        ...bindings,
                        ...nestedBindings
                    });
                },

                getRecentLogs: (count?: number) => logStore.getRecent(count)
            };
        },

        getRecentLogs: (count?: number) => logStore.getRecent(count)
    };

    // Log startup information
    loggerWrapper.info('Logger initialized', {
        level: logLevel,
        logToFile,
        logDir: secureConfig.logDir,
        instanceId,
        nodeEnv: process.env.NODE_ENV || 'development'
    });

    return loggerWrapper;
}