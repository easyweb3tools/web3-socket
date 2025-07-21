/**
 * Performance test for latency measurement
 * This test measures the round-trip time for messages
 */
import { createLoadTestClients, disconnectClients, writeResults } from './setup';
import { Socket as ClientSocket } from 'socket.io-client';

// Test configuration
const CLIENT_COUNT = process.env.CLIENT_COUNT ? parseInt(process.env.CLIENT_COUNT, 10) : 10;
const PING_COUNT = process.env.PING_COUNT ? parseInt(process.env.PING_COUNT, 10) : 100;
const CONCURRENT_PINGS = process.env.CONCURRENT_PINGS ? parseInt(process.env.CONCURRENT_PINGS, 10) : 10;

describe('Latency Test', () => {
    let clients: ClientSocket[] = [];

    beforeAll(async () => {
        // Create clients
        console.log(`Creating ${CLIENT_COUNT} clients...`);
        clients = await createLoadTestClients(CLIENT_COUNT, {
            autoRegister: true,
            autoAuthenticate: true
        });
        console.log(`Created ${clients.length} clients`);
    });

    afterAll(() => {
        // Disconnect all clients
        disconnectClients(clients);
        clients = [];
    });

    it('should measure message latency', async () => {
        // Skip in CI environment
        if (process.env.CI) {
            console.log('Skipping performance test in CI environment');
            return;
        }

        // Results object
        const results = {
            clientCount: CLIENT_COUNT,
            pingCount: PING_COUNT,
            concurrentPings: CONCURRENT_PINGS,
            latencies: [] as number[],
            averageLatency: 0,
            minLatency: 0,
            maxLatency: 0,
            p50Latency: 0,
            p90Latency: 0,
            p95Latency: 0,
            p99Latency: 0
        };

        // Measure latency
        console.log(`Measuring latency with ${CLIENT_COUNT} clients and ${PING_COUNT} pings...`);

        // Function to send a ping and measure round-trip time
        const sendPing = async (client: ClientSocket): Promise<number> => {
            const start = Date.now();

            // Send ping and wait for pong
            await new Promise<void>((resolve) => {
                client.emit('ping', { timestamp: start }, () => {
                    resolve();
                });
            });

            return Date.now() - start;
        };

        // Send pings in batches
        for (let i = 0; i < PING_COUNT; i += CONCURRENT_PINGS) {
            const batchSize = Math.min(CONCURRENT_PINGS, PING_COUNT - i);
            const pingPromises: Promise<number>[] = [];

            // Send concurrent pings
            for (let j = 0; j < batchSize; j++) {
                const clientIndex = (i + j) % clients.length;
                pingPromises.push(sendPing(clients[clientIndex]));
            }

            // Wait for all pings in batch
            const batchLatencies = await Promise.all(pingPromises);
            results.latencies.push(...batchLatencies);

            // Log progress
            if ((i + batchSize) % 100 === 0 || i + batchSize === PING_COUNT) {
                console.log(`Completed ${i + batchSize} of ${PING_COUNT} pings`);
            }
        }

        // Calculate statistics
        results.latencies.sort((a, b) => a - b);
        results.averageLatency = results.latencies.reduce((sum, latency) => sum + latency, 0) / results.latencies.length;
        results.minLatency = results.latencies[0];
        results.maxLatency = results.latencies[results.latencies.length - 1];
        results.p50Latency = results.latencies[Math.floor(results.latencies.length * 0.5)];
        results.p90Latency = results.latencies[Math.floor(results.latencies.length * 0.9)];
        results.p95Latency = results.latencies[Math.floor(results.latencies.length * 0.95)];
        results.p99Latency = results.latencies[Math.floor(results.latencies.length * 0.99)];

        // Log results
        console.log(`Average latency: ${results.averageLatency.toFixed(2)}ms`);
        console.log(`Min latency: ${results.minLatency}ms`);
        console.log(`Max latency: ${results.maxLatency}ms`);
        console.log(`P50 latency: ${results.p50Latency}ms`);
        console.log(`P90 latency: ${results.p90Latency}ms`);
        console.log(`P95 latency: ${results.p95Latency}ms`);
        console.log(`P99 latency: ${results.p99Latency}ms`);

        // Write results to file
        writeResults('latency', results);
    }, 300000); // 5 minute timeout
});