/**
 * Integration tests for message flow
 */
import { createTestServer, createTestClient, waitForEvent, wait } from './setup';
import { Socket as ClientSocket } from 'socket.io-client';
import axios from 'axios';

describe('Message Flow Integration Tests', () => {
    let server: any;
    let clients: ClientSocket[] = [];
    let testPort: number;

    beforeAll(async () => {
        // Create test server
        server = await createTestServer();
        testPort = parseInt(process.env.TEST_PORT || '3001', 10);
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

    it('should handle client-to-server events', async () => {
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
        await waitForEvent(client, 'register:ack');

        // Send client event
        client.emit('client:event', {
            type: 'test-event',
            data: { message: 'Hello, server!' }
        });

        // Wait for server response
        const response = await waitForEvent(client, 'server:response');

        // Verify response
        expect(response).toBeDefined();
        expect(response.success).toBe(true);
    });

    it('should handle client-to-server messages', async () => {
        // Create client with authentication
        const userId = 'test-user-2';
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

        // Send client message
        client.emit('client:message', {
            content: 'Hello, server!',
            type: 'text'
        });

        // Wait for message acknowledgement
        const ack = await waitForEvent(client, 'message:ack');

        // Verify acknowledgement
        expect(ack).toBeDefined();
        expect(ack.success).toBe(true);
        expect(ack.messageId).toBeDefined();
    });

    it('should handle client-to-server actions', async () => {
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
        await waitForEvent(client, 'register:ack');

        // Send client action
        client.emit('client:action', {
            action: 'test-action',
            params: { value: 42 }
        });

        // Wait for action result
        const result = await waitForEvent(client, 'action:result');

        // Verify result
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
    });

    it('should handle server-to-client push messages via API', async () => {
        // Create client with authentication
        const userId = 'test-user-4';
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

        // Send push message via API
        const apiResponse = await axios.post(`http://localhost:${testPort}/api/push`, {
            userId,
            event: 'test:push',
            data: { message: 'Hello from API!' }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.API_KEY || 'test_api_key'
            }
        });

        // Verify API response
        expect(apiResponse.status).toBe(200);
        expect(apiResponse.data.success).toBe(true);

        // Wait for push message
        const pushMessage = await waitForEvent(client, 'test:push');

        // Verify push message
        expect(pushMessage).toBeDefined();
        expect(pushMessage.message).toBe('Hello from API!');
    });

    it('should handle broadcast messages', async () => {
        // Create multiple clients with authentication
        const userId1 = 'test-user-5';
        const userId2 = 'test-user-6';

        const client1 = createTestClient({
            auth: { userId: userId1 }
        });
        clients.push(client1);

        const client2 = createTestClient({
            auth: { userId: userId2 }
        });
        clients.push(client2);

        // Wait for connections
        await Promise.all([
            new Promise<void>((resolve) => {
                client1.on('connect', () => resolve());
            }),
            new Promise<void>((resolve) => {
                client2.on('connect', () => resolve());
            })
        ]);

        // Register users
        client1.emit('register', { userId: userId1 });
        client2.emit('register', { userId: userId2 });

        await Promise.all([
            waitForEvent(client1, 'register:ack'),
            waitForEvent(client2, 'register:ack')
        ]);

        // Send broadcast message via API
        const apiResponse = await axios.post(`http://localhost:${testPort}/api/broadcast`, {
            event: 'test:broadcast',
            data: { message: 'Broadcast message!' }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.API_KEY || 'test_api_key'
            }
        });

        // Verify API response
        expect(apiResponse.status).toBe(200);
        expect(apiResponse.data.success).toBe(true);

        // Wait for broadcast messages
        const [message1, message2] = await Promise.all([
            waitForEvent(client1, 'test:broadcast'),
            waitForEvent(client2, 'test:broadcast')
        ]);

        // Verify broadcast messages
        expect(message1).toBeDefined();
        expect(message1.message).toBe('Broadcast message!');
        expect(message2).toBeDefined();
        expect(message2.message).toBe('Broadcast message!');
    });

    it('should handle room-based messages', async () => {
        // Create multiple clients with authentication
        const userId1 = 'test-user-7';
        const userId2 = 'test-user-8';
        const roomName = 'test-room';

        const client1 = createTestClient({
            auth: { userId: userId1 }
        });
        clients.push(client1);

        const client2 = createTestClient({
            auth: { userId: userId2 }
        });
        clients.push(client2);

        // Wait for connections
        await Promise.all([
            new Promise<void>((resolve) => {
                client1.on('connect', () => resolve());
            }),
            new Promise<void>((resolve) => {
                client2.on('connect', () => resolve());
            })
        ]);

        // Register users
        client1.emit('register', { userId: userId1 });
        client2.emit('register', { userId: userId2 });

        await Promise.all([
            waitForEvent(client1, 'register:ack'),
            waitForEvent(client2, 'register:ack')
        ]);

        // Join room
        client1.emit('room:join', { room: roomName });
        client2.emit('room:join', { room: roomName });

        await Promise.all([
            waitForEvent(client1, 'room:join:ack'),
            waitForEvent(client2, 'room:join:ack')
        ]);

        // Send room message via API
        const apiResponse = await axios.post(`http://localhost:${testPort}/api/room`, {
            room: roomName,
            event: 'test:room',
            data: { message: 'Room message!' }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.API_KEY || 'test_api_key'
            }
        });

        // Verify API response
        expect(apiResponse.status).toBe(200);
        expect(apiResponse.data.success).toBe(true);

        // Wait for room messages
        const [message1, message2] = await Promise.all([
            waitForEvent(client1, 'test:room'),
            waitForEvent(client2, 'test:room')
        ]);

        // Verify room messages
        expect(message1).toBeDefined();
        expect(message1.message).toBe('Room message!');
        expect(message2).toBeDefined();
        expect(message2.message).toBe('Room message!');
    });

    it('should handle error cases for invalid messages', async () => {
        // Create client with authentication
        const userId = 'test-user-9';
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

        // Send invalid client message (missing content)
        client.emit('client:message', {
            type: 'text'
            // Missing content field
        });

        // Wait for error
        const error = await waitForEvent(client, 'error');

        // Verify error
        expect(error).toBeDefined();
        expect(error.event).toBe('client:message');
        expect(error.message).toContain('Invalid message data');
    });
});