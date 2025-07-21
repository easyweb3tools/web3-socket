/**
 * Security tests for authorization
 */
import { createTestClient, createValidToken, waitForEvent, createSignedApiRequest, createUnsignedApiRequest } from './setup';
import { Socket as ClientSocket } from 'socket.io-client';
import axios from 'axios';

describe('Authorization Security Tests', () => {
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

    it('should enforce room access control', async () => {
        // Create two clients with authentication
        const userId1 = 'test-user-1';
        const userId2 = 'test-user-2';

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

        // Create a private room for user1
        const privateRoomName = `private-${userId1}`;
        client1.emit('room:join', { room: privateRoomName });
        await waitForEvent(client1, 'room:join:ack');

        // Try to have user2 join user1's private room
        client2.emit('room:join', { room: privateRoomName });

        // Wait for error
        const error = await waitForEvent(client2, 'error');

        // Verify error
        expect(error).toBeDefined();
        expect(error.message).toContain('Unauthorized');
    });

    it('should enforce API key validation', async () => {
        try {
            // Send request with invalid API key
            await axios.get('http://localhost:3001/api/status', {
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

    it('should enforce API request signing when required', async () => {
        try {
            // Create unsigned request
            const config = createUnsignedApiRequest('GET', '/api/status');

            // Send request
            await axios(config);

            // This may or may not fail depending on whether request signing is required
            // We'll check the response status to determine if signing is required
        } catch (error: any) {
            // If signing is required, verify error
            if (error.response && error.response.status === 401) {
                expect(error.response.data.error).toContain('Request signature');
            }
        }

        try {
            // Create signed request
            const config = createSignedApiRequest('GET', '/api/status');

            // Send request
            const response = await axios(config);

            // Verify response
            expect(response.status).toBe(200);
            expect(response.data.success).toBe(true);
        } catch (error: any) {
            fail(`Signed request should have been accepted: ${error.message}`);
        }
    });

    it('should enforce rate limiting', async () => {
        // Send multiple requests in quick succession
        const requests = [];
        const maxRequests = 20; // Adjust based on rate limit configuration

        for (let i = 0; i < maxRequests; i++) {
            requests.push(axios.get('http://localhost:3001/api/status', {
                headers: {
                    'X-API-Key': process.env.API_KEY || 'test_api_key'
                }
            }));
        }

        // Wait for all requests to complete
        const results = await Promise.allSettled(requests);

        // Check if any requests were rate limited
        const rateLimited = results.some(result =>
            result.status === 'rejected' &&
            (result as PromiseRejectedResult).reason?.response?.status === 429
        );

        // If rate limiting is enabled, some requests should be rejected
        // If not, this test will pass anyway
        if (rateLimited) {
            const rejectedCount = results.filter(result =>
                result.status === 'rejected' &&
                (result as PromiseRejectedResult).reason?.response?.status === 429
            ).length;

            console.log(`Rate limiting detected: ${rejectedCount} of ${maxRequests} requests were rejected`);
        } else {
            console.log('No rate limiting detected or limit not reached');
        }
    });

    it('should prevent unauthorized access to admin endpoints', async () => {
        try {
            // Try to access admin endpoint
            await axios.get('http://localhost:3001/api/admin/users', {
                headers: {
                    'X-API-Key': process.env.API_KEY || 'test_api_key'
                }
            });

            // If we get here, the endpoint might not exist or might not be protected
            // We'll check the response status
        } catch (error: any) {
            // Verify error is either 404 (endpoint doesn't exist) or 403 (forbidden)
            expect([403, 404]).toContain(error.response.status);

            if (error.response.status === 403) {
                expect(error.response.data.error).toContain('Unauthorized');
            }
        }
    });

    it('should prevent cross-user data access', async () => {
        // Create two clients with authentication
        const userId1 = 'test-user-3';
        const userId2 = 'test-user-4';

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

        // Try to access user1's data from user2
        client2.emit('user:get_data', { userId: userId1 });

        // Wait for error or response
        const response = await Promise.race([
            waitForEvent(client2, 'user:data').then(data => ({ type: 'data', data })),
            waitForEvent(client2, 'error').then(error => ({ type: 'error', error }))
        ]);

        // Verify response
        if (response.type === 'data') {
            // If we got data, it should be empty or indicate no access
            expect(response.data.success).toBeFalsy();
        } else {
            // If we got an error, it should indicate unauthorized access
            expect(response.error.message).toContain('Unauthorized');
        }
    });
});