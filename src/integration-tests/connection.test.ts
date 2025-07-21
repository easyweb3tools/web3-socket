/**
 * Integration tests for connection management
 */
import { createTestServer, createTestClient, waitForEvent, wait } from './setup';
import { Socket as ClientSocket } from 'socket.io-client';

describe('Connection Integration Tests', () => {
    let server: any;
    let clients: ClientSocket[] = [];

    beforeAll(async () => {
        // Create test server
        server = await createTestServer();
    });

    afterAll(async () => {
        // Close all clients
        clients.forEach(client => {
            if (client.connected) {
                client.disconnect();
            }
        });

        // Close server
        await server.close();
    });

    afterEach(() => {
        // Disconnect any remaining clients
        clients.forEach(client => {
            if (client.connected) {
                client.disconnect();
            }
        });
        clients = [];
    });

    it('should connect and receive welcome message', async () => {
        // Create client
        const client = createTestClient();
        clients.push(client);

        // Wait for connection
        await new Promise<void>((resolve) => {
            client.on('connect', () => {
                resolve();
            });
        });

        // Wait for welcome message
        const welcomeMessage = await waitForEvent(client, 'system:welcome');

        // Verify welcome message
        expect(welcomeMessage).toBeDefined();
        expect(welcomeMessage.message).toBe('Welcome to the Socket.IO server');
        expect(welcomeMessage.socketId).toBe(client.id);
    });

    it('should authenticate user with valid token', async () => {
        // Create client with authentication
        const userId = 'test-user-1';
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

        // Wait for registration acknowledgement
        const ack = await waitForEvent(client, 'register:ack');

        // Verify registration
        expect(ack).toBeDefined();
        expect(ack.success).toBe(true);
        expect(ack.userId).toBe(userId);

        // Verify user is registered in connection manager
        const userConnections = server.connectionManager.getUserConnections();
        expect(userConnections.has(userId)).toBe(true);
        expect(userConnections.get(userId)?.has(client.id)).toBe(true);
    });

    it('should handle multiple connections for the same user', async () => {
        // Create first client with authentication
        const userId = 'test-user-2';
        const client1 = createTestClient({
            auth: { userId }
        });
        clients.push(client1);

        // Wait for connection
        await new Promise<void>((resolve) => {
            client1.on('connect', () => {
                resolve();
            });
        });

        // Register first client
        client1.emit('register', { userId });

        // Wait for registration acknowledgement
        const ack1 = await waitForEvent(client1, 'register:ack');
        expect(ack1.success).toBe(true);

        // Create second client with same authentication
        const client2 = createTestClient({
            auth: { userId }
        });
        clients.push(client2);

        // Wait for connection
        await new Promise<void>((resolve) => {
            client2.on('connect', () => {
                resolve();
            });
        });

        // Register second client
        client2.emit('register', { userId });

        // Wait for registration acknowledgement
        const ack2 = await waitForEvent(client2, 'register:ack');
        expect(ack2.success).toBe(true);

        // Verify both connections are registered
        const userConnections = server.connectionManager.getUserConnections();
        expect(userConnections.has(userId)).toBe(true);
        expect(userConnections.get(userId)?.size).toBe(2);
        expect(userConnections.get(userId)?.has(client1.id)).toBe(true);
        expect(userConnections.get(userId)?.has(client2.id)).toBe(true);
    });

    it('should handle disconnection and cleanup', async () => {
        // Create client with authentication
        const userId = 'test-user-3';
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

        // Wait for registration acknowledgement
        const ack = await waitForEvent(client, 'register:ack');
        expect(ack.success).toBe(true);

        // Verify user is registered
        let userConnections = server.connectionManager.getUserConnections();
        expect(userConnections.has(userId)).toBe(true);

        // Disconnect client
        client.disconnect();

        // Wait for cleanup
        await wait(100);

        // Verify user is removed from connection manager
        userConnections = server.connectionManager.getUserConnections();
        expect(userConnections.has(userId)).toBe(false);
    });

    it('should reject authentication with invalid token', async () => {
        // Create client with invalid authentication
        const client = createTestClient({
            autoConnect: false
        });
        clients.push(client);

        // Set invalid auth
        (client as any).auth = { token: 'invalid-token' };

        // Connect client
        client.connect();

        // Wait for connect_error event
        const error = await waitForEvent(client, 'connect_error');

        // Verify error
        expect(error).toBeDefined();
        expect(error.message).toContain('Authentication failed');
    });
});