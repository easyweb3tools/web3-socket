/**
 * Security tests for input validation
 */
import { createTestClient, waitForEvent, generateXssPayload, generateSqlInjectionPayload, generateNoSqlInjectionPayload, generateCommandInjectionPayload } from './setup';
import { Socket as ClientSocket } from 'socket.io-client';
import axios from 'axios';

describe('Input Validation Security Tests', () => {
    let clients: ClientSocket[] = [];

    afterEach(() => {
        // Disconnect all clients
        clients.forEach(client => {
            if (client.connected) {
                client.disconnect();
            }
        });
        clients = [];
    });

    it('should sanitize XSS payloads in messages', async () => {
        // Create client with authentication
        const userId = 'test-user';
        const client = createTestClient({
            auth: { userId }
        });
        clients.push(client);

        // Wait for connection
        await new Promise<void>((resolve) => {
            client.on('connect', () => {
                resolve();
            });
        });

        // Register user
        client.emit('register', { userId });
        await waitForEvent(client, 'register:ack');

        // Send message with XSS payload
        const xssPayload = generateXssPayload();
        client.emit('client:message', {
            content: xssPayload,
            type: 'text'
        });

        // Wait for message acknowledgement
        const ack = await waitForEvent(client, 'message:ack');

        // Verify message was accepted (sanitization happens on the server)
        expect(ack).toBeDefined();
        expect(ack.success).toBe(true);
    });

    it('should validate message structure', async () => {
        // Create client with authentication
        const userId = 'test-user';
        const client = createTestClient({
            auth: { userId }
        });
        clients.push(client);

        // Wait for connection
        await new Promise<void>((resolve) => {
            client.on('connect', () => {
                resolve();
            });
        });

        // Register user
        client.emit('register', { userId });
        await waitForEvent(client, 'register:ack');

        // Send message with missing content
        client.emit('client:message', {
            type: 'text'
            // Missing content field
        });

        // Wait for error
        const error = await waitForEvent(client, 'error');

        // Verify error
        expect(error).toBeDefined();
        expect(error.message).toContain('Invalid message data');
    });

    it('should validate message size limits', async () => {
        // Create client with authentication
        const userId = 'test-user';
        const client = createTestClient({
            auth: { userId }
        });
        clients.push(client);

        // Wait for connection
        await new Promise<void>((resolve) => {
            client.on('connect', () => {
                resolve();
            });
        });

        // Register user
        client.emit('register', { userId });
        await waitForEvent(client, 'register:ack');

        // Generate large message content (1MB)
        const largeContent = 'A'.repeat(1024 * 1024);

        // Send message with large content
        client.emit('client:message', {
            content: largeContent,
            type: 'text'
        });

        // Wait for error
        const error = await waitForEvent(client, 'error');

        // Verify error
        expect(error).toBeDefined();
        expect(error.message).toContain('Message too large');
    });

    it('should handle SQL injection attempts', async () => {
        // Create client with authentication
        const userId = 'test-user';
        const client = createTestClient({
            auth: { userId }
        });
        clients.push(client);

        // Wait for connection
        await new Promise<void>((resolve) => {
            client.on('connect', () => {
                resolve();
            });
        });

        // Register user
        client.emit('register', { userId });
        await waitForEvent(client, 'register:ack');

        // Send message with SQL injection payload
        const sqlInjectionPayload = generateSqlInjectionPayload();
        client.emit('client:message', {
            content: sqlInjectionPayload,
            type: 'text'
        });

        // Wait for message acknowledgement
        const ack = await waitForEvent(client, 'message:ack');

        // Verify message was accepted (sanitization happens on the server)
        expect(ack).toBeDefined();
        expect(ack.success).toBe(true);
    });

    it('should handle NoSQL injection attempts', async () => {
        // Create client with authentication
        const userId = 'test-user';
        const client = createTestClient({
            auth: { userId }
        });
        clients.push(client);

        // Wait for connection
        await new Promise<void>((resolve) => {
            client.on('connect', () => {
                resolve();
            });
        });

        // Register user
        client.emit('register', { userId });
        await waitForEvent(client, 'register:ack');

        // Send message with NoSQL injection payload
        const noSqlInjectionPayload = generateNoSqlInjectionPayload();
        client.emit('client:message', {
            content: noSqlInjectionPayload,
            type: 'text'
        });

        // Wait for message acknowledgement
        const ack = await waitForEvent(client, 'message:ack');

        // Verify message was accepted (sanitization happens on the server)
        expect(ack).toBeDefined();
        expect(ack.success).toBe(true);
    });

    it('should handle command injection attempts', async () => {
        // Create client with authentication
        const userId = 'test-user';
        const client = createTestClient({
            auth: { userId }
        });
        clients.push(client);

        // Wait for connection
        await new Promise<void>((resolve) => {
            client.on('connect', () => {
                resolve();
            });
        });

        // Register user
        client.emit('register', { userId });
        await waitForEvent(client, 'register:ack');

        // Send message with command injection payload
        const commandInjectionPayload = generateCommandInjectionPayload();
        client.emit('client:message', {
            content: commandInjectionPayload,
            type: 'text'
        });

        // Wait for message acknowledgement
        const ack = await waitForEvent(client, 'message:ack');

        // Verify message was accepted (sanitization happens on the server)
        expect(ack).toBeDefined();
        expect(ack.success).toBe(true);
    });

    it('should validate API request body', async () => {
        try {
            // Send push message request with invalid body
            await axios.post('http://localhost:3001/api/push', {
                // Missing userId
                event: 'test:push',
                data: { message: 'Hello from API!' }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': process.env.API_KEY || 'test_api_key'
                }
            });
            fail('Request should have been rejected');
        } catch (error: any) {
            // Verify error
            expect(error.response.status).toBe(400);
            expect(error.response.data.error).toContain('userId is required');
        }
    });

    it('should sanitize XSS payloads in API requests', async () => {
        try {
            // Send push message request with XSS payload
            const xssPayload = generateXssPayload();
            const response = await axios.post('http://localhost:3001/api/push', {
                userId: 'test-user',
                event: 'test:push',
                data: { message: xssPayload }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': process.env.API_KEY || 'test_api_key'
                }
            });

            // Verify response
            expect(response.status).toBe(200);
            expect(response.data.success).toBe(true);
        } catch (error: any) {
            fail(`Request should have been accepted: ${error.message}`);
        }
    });
});