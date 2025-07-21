/**
 * Security test setup
 * This file provides utilities for security testing
 */
import dotenv from 'dotenv';
import { io, Socket as ClientSocket } from 'socket.io-client';
import axios, { AxiosRequestConfig } from 'axios';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Load environment variables
dotenv.config({ path: '.env.test' });

// Test configuration
const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
const API_KEY = process.env.API_KEY || 'test_api_key';

/**
 * Create a test client with custom authentication
 */
export function createTestClient(options: {
    autoConnect?: boolean;
    auth?: {
        token?: string;
        userId?: string;
        [key: string]: any;
    };
} = {}): ClientSocket {
    const clientOptions: any = {
        autoConnect: options.autoConnect !== false,
        transports: ['websocket'],
        forceNew: true
    };

    // Add authentication if provided
    if (options.auth) {
        if (options.auth.token) {
            clientOptions.auth = { token: options.auth.token };
        } else if (options.auth.userId) {
            const token = jwt.sign(
                { userId: options.auth.userId, ...options.auth },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            clientOptions.auth = { token };
        }
    }

    // Create client
    return io(SERVER_URL, clientOptions);
}

/**
 * Create a valid JWT token
 */
export function createValidToken(payload: { userId: string;[key: string]: any } = { userId: uuidv4() }): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Create an invalid JWT token
 */
export function createInvalidToken(type: 'expired' | 'wrong-secret' | 'malformed' = 'wrong-secret'): string {
    switch (type) {
        case 'expired':
            return jwt.sign({ userId: uuidv4() }, JWT_SECRET, { expiresIn: '0s' });
        case 'wrong-secret':
            return jwt.sign({ userId: uuidv4() }, 'wrong-secret', { expiresIn: '1h' });
        case 'malformed':
            return 'malformed.token.here';
        default:
            return 'invalid-token';
    }
}

/**
 * Create a signed API request
 */
export function createSignedApiRequest(
    method: string,
    path: string,
    data?: any,
    options: {
        apiKey?: string;
        timestamp?: number;
        nonce?: string;
        signatureVersion?: string;
    } = {}
): AxiosRequestConfig {
    const apiKey = options.apiKey || API_KEY;
    const timestamp = options.timestamp || Date.now();
    const nonce = options.nonce || uuidv4();
    const signatureVersion = options.signatureVersion || 'v1';

    // Create signature
    const payload = `${method.toUpperCase()}${path}${timestamp}${nonce}`;
    const signature = crypto
        .createHmac('sha256', apiKey)
        .update(payload)
        .digest('hex');

    // Create request config
    return {
        method,
        url: `${SERVER_URL}${path}`,
        data,
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
            'X-Request-Timestamp': timestamp.toString(),
            'X-Request-Nonce': nonce,
            'X-Signature-Version': signatureVersion,
            'X-Signature': signature
        }
    };
}

/**
 * Create an unsigned API request
 */
export function createUnsignedApiRequest(
    method: string,
    path: string,
    data?: any,
    options: {
        apiKey?: string;
        includeTimestamp?: boolean;
        includeNonce?: boolean;
    } = {}
): AxiosRequestConfig {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    if (options.apiKey !== null) {
        headers['X-API-Key'] = options.apiKey || API_KEY;
    }

    if (options.includeTimestamp !== false) {
        headers['X-Request-Timestamp'] = Date.now().toString();
    }

    if (options.includeNonce !== false) {
        headers['X-Request-Nonce'] = uuidv4();
    }

    return {
        method,
        url: `${SERVER_URL}${path}`,
        data,
        headers
    };
}

/**
 * Wait for an event to be emitted
 */
export function waitForEvent(socket: ClientSocket, event: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for event: ${event}`));
        }, timeout);

        socket.once(event, (data) => {
            clearTimeout(timer);
            resolve(data);
        });
    });
}

/**
 * Generate a string with potential XSS payload
 */
export function generateXssPayload(): string {
    const payloads = [
        '<script>alert("XSS")</script>',
        '"><script>alert("XSS")</script>',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')">',
        '"><svg onload="alert(\'XSS\')">'
    ];
    return payloads[Math.floor(Math.random() * payloads.length)];
}

/**
 * Generate a string with potential SQL injection payload
 */
export function generateSqlInjectionPayload(): string {
    const payloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users; --",
        "' OR '1'='1' --",
        "admin'--"
    ];
    return payloads[Math.floor(Math.random() * payloads.length)];
}

/**
 * Generate a string with potential NoSQL injection payload
 */
export function generateNoSqlInjectionPayload(): string {
    const payloads = [
        '{"$gt": ""}',
        '{"$ne": null}',
        '{"$where": "this.password == this.username"}',
        '{"$exists": true}'
    ];
    return payloads[Math.floor(Math.random() * payloads.length)];
}

/**
 * Generate a string with potential command injection payload
 */
export function generateCommandInjectionPayload(): string {
    const payloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '`cat /etc/passwd`',
        '$(cat /etc/passwd)',
        '& cat /etc/passwd'
    ];
    return payloads[Math.floor(Math.random() * payloads.length)];
}