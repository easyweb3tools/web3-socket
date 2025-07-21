/**
 * Security tests for authentication
 */
import { createTestClient, createValidToken, createInvalidToken, waitForEvent } from './setup';
import { Socket as ClientSocket } from 'socket.io-client';

describe('Authentication Security Tests', () => {
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

    it('should reject connection without authentication', async () => {
        // Create client without authentication
        const client = createTestClient({ auth: null });
        clients.push(client);

        // Wait for connect_error event
        const error = await new Promise<Error>((resolve) => {
            client.on('connect_error', (err) => {
                resolve(err);
            });
        });

        // Verify error
        expect(error).toBeDefined();
        expect(error.message).toContain('Authentication failed');
    });

    it('should reject connection with expired token', async () => {
        // Create client with expired token
        const expiredToken = createInvalidToken('expired');
        const client = createTestClient({
            auth: { token: expiredToken }
        });
        clients.push(client);

        // Wait for connect_error event
        const error = await new Promise<Error>((resolve) => {
            client.on('connect_error', (err) => {
                resolve(err);
            });
        });

        // Verify error
        expect(error).toBeDefined();
        expect(error.message).toContain('Authentication failed');
    });

    it('should reject connection with token signed with wrong secret', async () => {
        // Create client with token signed with wrong secret
        const invalidToken = createInvalidToken('wrong-secret');
        const client = createTestClient({
            auth: { token: invalidToken }
        });
        clients.push(client);

        // Wait for connect_error event
        const error = await new Promise<Error>((resolve) => {
            client.on('connect_error', (err) => {
                resolve(err);
            });
        });

        // Verify error
        expect(error).toBeDefined();
        expect(error.message).toContain('Authentication failed');
    });

    it('should reject connection with malformed token', async () => {
        // Create client with malformed token
        const malformedToken = createInvalidToken('malformed');
        const client = createTestClient({
            auth: { token: malformedToken }
        });
        clients.push(client);

        // Wait for connect_error event
        const error = await new Promise<Error>((resolve) => {
            client.on('connect_error', (err) => {
                resolve(err);
            });
        });

        // Verify error
        expect(error).toBeDefined();
        expect(error.message).toContain('Authentication failed');
    });

    it('should accept connection with valid token', async () => {
        // Create client with valid token
        const userId = 'test-user';
        const validToken = createValidToken({ userId });
        const client = createTestClient({
            auth: { token: validToken }
        });
        clients.push(client);

        // Wait for connection
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 5000);

            client.on('connect', () => {
                clearTimeout(timeout);
                resolve();
            });

            client.on('connect_error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });

        // Verify connection
        expect(client.connected).toBe(true);

        // Register user
        client.emit('register', { userId });

        // Wait for registration acknowledgement
        const ack = await waitForEvent(client, 'register:ack');

        // Verify registration
        expect(ack).toBeDefined();
        expect(ack.success).toBe(true);
        expect(ack.userId).toBe(userId);
    });

    it('should reject registration with mismatched user ID', async () => {
        // Create client with valid token
        const userId = 'test-user';
        const validToken = createValidToken({ userId });
        const client = createTestClient({
            auth: { token: validToken }
        });
        clients.push(client);

        // Wait for connection
        await new Promise<void>((resolve) => {
            client.on('connect', () => {
                resolve();
            });
        });

        // Try to register with different user ID
        client.emit('register', { userId: 'different-user' });

        // Wait for registration acknowledgement
        const ack = await waitForEvent(client, 'register:ack');

        // Verify registration failed
        expect(ack).toBeDefined();
        expect(ack.success).toBe(false);
        expect(ack.error).toContain('User ID mismatch');
    });

    it('should reject access to protected events without authentication', async () => {
        // Create client with valid token
        const userId = 'test-user';
        const validToken = createValidToken({ userId });
        const client = createTestClient({
            auth: { token: validToken }
        });
        clients.push(client);

        // Wait for connection
        await new Promise<void>((resolve) => {
            client.on('connect', () => {
                resolve();
            });
        });

        // Try to access protected event without registering
        client.emit('client:message', {
            content: 'Hello, server!',
            type: 'text'
        });

        // Wait for error
        const error = await waitForEvent(client, 'error');

        // Verify error
        expect(error).toBeDefined();
        expect(error.message).toContain('Authentication required');
    });
});