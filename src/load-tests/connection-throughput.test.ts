/**
 * Load test for connection throughput
 * This test measures how many connections per second the server can handle
 */
import { createLoadTestClients, disconnectClients, measureTime, writeResults } from './setup';
import { Socket as ClientSocket } from 'socket.io-client';

// Test configuration
const CONNECTION_COUNT = process.env.CONNECTION_COUNT ? parseInt(process.env.CONNECTION_COUNT, 10) : 1000;
const CONNECTION_BATCH_SIZE = process.env.CONNECTION_BATCH_SIZE ? parseInt(process.env.CONNECTION_BATCH_SIZE, 10) : 100;
const CONNECTION_BATCH_DELAY = process.env.CONNECTION_BATCH_DELAY ? parseInt(process.env.CONNECTION_BATCH_DELAY, 10) : 1000;

describe('Connection Throughput Test', () => {
    let clients: ClientSocket[] = [];

    afterEach(() => {
        // Disconnect all clients
        disconnectClients(clients);
        clients = [];
    });

    it('should measure connection throughput', async () => {
        // Skip in CI environment
        if (process.env.CI) {
            console.log('Skipping load test in CI environment');
            return;
        }

        // Measure time to create connections
        const results = {
            connectionCount: CONNECTION_COUNT,
            batchSize: CONNECTION_BATCH_SIZE,
            batchDelay: CONNECTION_BATCH_DELAY,
            totalDuration: 0,
            connectionsPerSecond: 0,
            batches: [] as { batchNumber: number, connections: number, duration: number, connectionsPerSecond: number }[]
        };

        const totalDuration = await measureTime(async () => {
            // Create connections in batches
            for (let i = 0; i < CONNECTION_COUNT; i += CONNECTION_BATCH_SIZE) {
                const batchNumber = Math.floor(i / CONNECTION_BATCH_SIZE) + 1;
                const batchSize = Math.min(CONNECTION_BATCH_SIZE, CONNECTION_COUNT - i);

                console.log(`Creating batch ${batchNumber} with ${batchSize} connections`);

                // Measure time to create batch
                const batchDuration = await measureTime(async () => {
                    const batchClients = await createLoadTestClients(batchSize, {
                        autoRegister: true,
                        autoAuthenticate: true
                    });

                    clients.push(...batchClients);
                });

                // Calculate connections per second for this batch
                const batchConnectionsPerSecond = Math.round((batchSize / batchDuration) * 1000);

                // Add batch results
                results.batches.push({
                    batchNumber,
                    connections: batchSize,
                    duration: batchDuration,
                    connectionsPerSecond: batchConnectionsPerSecond
                });

                console.log(`Batch ${batchNumber} completed in ${batchDuration}ms (${batchConnectionsPerSecond} connections/second)`);

                // Wait before creating next batch
                if (i + CONNECTION_BATCH_SIZE < CONNECTION_COUNT) {
                    await new Promise(resolve => setTimeout(resolve, CONNECTION_BATCH_DELAY));
                }
            }
        });

        // Calculate overall connections per second
        results.totalDuration = totalDuration;
        results.connectionsPerSecond = Math.round((CONNECTION_COUNT / totalDuration) * 1000);

        console.log(`Total connections: ${CONNECTION_COUNT}`);
        console.log(`Total duration: ${totalDuration}ms`);
        console.log(`Overall connection throughput: ${results.connectionsPerSecond} connections/second`);

        // Write results to file
        writeResults('connection-throughput', results);

        // Verify all connections were successful
        expect(clients.length).toBe(CONNECTION_COUNT);
    }, 300000); // 5 minute timeout
});