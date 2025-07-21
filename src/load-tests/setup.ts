/**
 * Load test setup
 * This file provides utilities for load and performance testing
 */
import dotenv from 'dotenv';
import { io, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Test configuration
const SERVER_URL = process.env.LOAD_TEST_SERVER_URL || 'http://localhost:8081';
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';
const API_KEY = process.env.API_KEY || 'default_api_key';

// Increase max listeners to avoid warnings
EventEmitter.defaultMaxListeners = 1000;

/**
 * Client options for load testing
 */
export interface LoadTestClientOptions {
    /**
     * User ID for the client
     */
    userId?: string;

    /**
     * Whether to automatically connect
     */
    autoConnect?: boolean;

    /**
     * Whether to automatically register
     */
    autoRegister?: boolean;

    /**
     * Whether to automatically authenticate
     */
    autoAuthenticate?: boolean;

    /**
     * Custom authentication data
     */
    authData?: Record<string, any>;

    /**
     * Connection timeout in milliseconds
     */
    connectionTimeout?: number;

    /**
     * Registration timeout in milliseconds
     */
    registrationTimeout?: number;
}

/**
 * Create a client for load testing
 */
export function createLoadTestClient(options: LoadTestClientOptions = {}): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
        // Generate user ID if not provided
        const userId = options.userId || `user-${uuidv4()}`;

        // Create authentication token
        const token = jwt.sign(
            { userId, ...options.authData },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Create client options
        const clientOptions: any = {
            autoConnect: options.autoConnect !== false,
            transports: ['websocket'],
            forceNew: true,
            reconnection: false,
            timeout: options.connectionTimeout || 10000
        };

        // Add authentication if enabled
        if (options.autoAuthenticate !== false) {
            clientOptions.auth = { token };
        }

        // Create client
        const client = io(SERVER_URL, clientOptions);

        // Set timeout for connection
        const connectionTimeout = setTimeout(() => {
            client.disconnect();
            reject(new Error('Connection timeout'));
        }, options.connectionTimeout || 10000);

        // Handle connection
        client.on('connect', () => {
            clearTimeout(connectionTimeout);

            // Register user if enabled
            if (options.autoRegister !== false) {
                // Set timeout for registration
                const registrationTimeout = setTimeout(() => {
                    client.disconnect();
                    reject(new Error('Registration timeout'));
                }, options.registrationTimeout || 5000);

                // Register user
                client.emit('register', { userId });

                // Handle registration acknowledgement
                client.once('register:ack', (data) => {
                    clearTimeout(registrationTimeout);

                    if (data.success) {
                        // Store user ID in client
                        (client as any).userId = userId;
                        resolve(client);
                    } else {
                        client.disconnect();
                        reject(new Error(`Registration failed: ${data.error}`));
                    }
                });
            } else {
                // Store user ID in client
                (client as any).userId = userId;
                resolve(client);
            }
        });

        // Handle connection error
        client.on('connect_error', (error) => {
            clearTimeout(connectionTimeout);
            client.disconnect();
            reject(error);
        });
    });
}

/**
 * Create multiple clients for load testing
 */
export async function createLoadTestClients(count: number, options: LoadTestClientOptions = {}): Promise<ClientSocket[]> {
    const clients: ClientSocket[] = [];
    const batchSize = 50; // Create clients in batches to avoid overwhelming the server

    for (let i = 0; i < count; i += batchSize) {
        const batchCount = Math.min(batchSize, count - i);
        const batchPromises: Promise<ClientSocket>[] = [];

        for (let j = 0; j < batchCount; j++) {
            const userId = `user-${i + j}`;
            batchPromises.push(createLoadTestClient({ ...options, userId }));
        }

        // Wait for batch to connect
        const batchClients = await Promise.all(batchPromises);
        clients.push(...batchClients);

        // Log progress
        console.log(`Connected ${clients.length} of ${count} clients`);

        // Wait a bit before creating the next batch
        if (i + batchSize < count) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return clients;
}

/**
 * Disconnect all clients
 */
export function disconnectClients(clients: ClientSocket[]): void {
    for (const client of clients) {
        if (client.connected) {
            client.disconnect();
        }
    }
}

/**
 * Measure execution time
 */
export async function measureTime(fn: () => Promise<void>): Promise<number> {
    const start = Date.now();
    await fn();
    return Date.now() - start;
}

/**
 * Generate a random message
 */
export function generateRandomMessage(size: number = 100): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < size; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Write test results to file
 */
export function writeResults(name: string, results: any): void {
    const resultsDir = path.join(__dirname, '../../load-test-results');

    // Create directory if it doesn't exist
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Write results to file
    const filePath = path.join(resultsDir, `${name}-${new Date().toISOString().replace(/:/g, '-')}.json`);
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2));

    console.log(`Results written to ${filePath}`);
}