/**
 * Integration tests for HTTP API
 */
import { createTestServer, createAuthenticatedRequest } from './setup';
import axios from 'axios';

describe('API Integration Tests', () => {
    let server: any;
    let testPort: number;

    beforeAll(async () => {
        // Create test server
        server = await createTestServer();
        testPort = parseInt(process.env.TEST_PORT || '3001', 10);
    });

    afterAll(async () => {
        // Close server
        await server.close();
    });

    it('should return server status', async () => {
        // Send status request
        const response = await axios.get(`http://localhost:${testPort}/api/status`, {
            headers: {
                'X-API-Key': process.env.API_KEY || 'test_api_key'
            }
        });

        // Verify response
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data.status).toBe('ok');
        expect(response.data.connections).toBeDefined();
        expect(response.data.uptime).toBeDefined();
    });

    it('should return health check', async () => {
        // Send health check request
        const response = await axios.get(`http://localhost:${testPort}/health`);

        // Verify response
        expect(response.status).toBe(200);
        expect(response.data.status).toBe('ok');
    });

    it('should return metrics', async () => {
        // Send metrics request
        const response = await axios.get(`http://localhost:${testPort}/metrics`);

        // Verify response
        expect(response.status).toBe(200);
        expect(response.data).toContain('socket_server_');
    });

    it('should push message to user', async () => {
        // Create client and register user
        const userId = 'test-user-api-1';
        const client = server.io.sockets._add({
            id: 'test-socket-id',
            handshake: {},
            conn: { transport: { name: 'websocket' } },
            rooms: new Set(),
            data: { userId, authenticated: true }
        });

        // Mock emit method
        client.emit = jest.fn();

        // Register user in connection manager
        await server.connectionManager.registerUser(client, userId);

        // Send push message request
        const response = await axios.post(`http://localhost:${testPort}/api/push`, {
            userId,
            event: 'test:push',
            data: { message: 'Hello from API!' }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.API_KEY || 'test_api_key'
            }
        });

        // Verify response
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data.delivered).toBe(true);

        // Verify message was sent to client
        expect(client.emit).toHaveBeenCalledWith('test:push', { message: 'Hello from API!' });
    });

    it('should broadcast message to all users', async () => {
        // Create clients and register users
        const userId1 = 'test-user-api-2';
        const userId2 = 'test-user-api-3';

        const client1 = server.io.sockets._add({
            id: 'test-socket-id-1',
            handshake: {},
            conn: { transport: { name: 'websocket' } },
            rooms: new Set(),
            data: { userId: userId1, authenticated: true }
        });

        const client2 = server.io.sockets._add({
            id: 'test-socket-id-2',
            handshake: {},
            conn: { transport: { name: 'websocket' } },
            rooms: new Set(),
            data: { userId: userId2, authenticated: true }
        });

        // Mock emit method on server
        server.io.emit = jest.fn();

        // Register users in connection manager
        await server.connectionManager.registerUser(client1, userId1);
        await server.connectionManager.registerUser(client2, userId2);

        // Send broadcast message request
        const response = await axios.post(`http://localhost:${testPort}/api/broadcast`, {
            event: 'test:broadcast',
            data: { message: 'Broadcast message!' }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.API_KEY || 'test_api_key'
            }
        });

        // Verify response
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);

        // Verify message was broadcast
        expect(server.io.emit).toHaveBeenCalledWith('test:broadcast', { message: 'Broadcast message!' });
    });

    it('should send message to room', async () => {
        // Create room
        const roomName = 'test-room-api';

        // Mock to method on server
        server.io.to = jest.fn().mockReturnValue({
            emit: jest.fn()
        });

        // Send room message request
        const response = await axios.post(`http://localhost:${testPort}/api/room`, {
            room: roomName,
            event: 'test:room',
            data: { message: 'Room message!' }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.API_KEY || 'test_api_key'
            }
        });

        // Verify response
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);

        // Verify message was sent to room
        expect(server.io.to).toHaveBeenCalledWith(roomName);
        expect(server.io.to(roomName).emit).toHaveBeenCalledWith('test:room', { message: 'Room message!' });
    });

    it('should reject requests without API key', async () => {
        try {
            // Send request without API key
            await axios.get(`http://localhost:${testPort}/api/status`);
            fail('Request should have been rejected');
        } catch (error: any) {
            // Verify error
            expect(error.response.status).toBe(401);
            expect(error.response.data.error).toContain('API key is required');
        }
    });

    it('should reject requests with invalid API key', async () => {
        try {
            // Send request with invalid API key
            await axios.get(`http://localhost:${testPort}/api/status`, {
                headers: {
                    'X-API-Key': 'invalid-api-key'
                }
            });
            fail('Request should have been rejected');
        } catch (error: any) {
            // Verify error
            expect(error.response.status).toBe(401);
            expect(error.response.data.error).toContain('Invalid API key');
        }
    });

    it('should validate request body', async () => {
        try {
            // Send push message request with invalid body
            await axios.post(`http://localhost:${testPort}/api/push`, {
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
});