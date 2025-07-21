/**
 * Load test for message throughput
 * This test measures how many messages per second the server can handle
 */
import { createLoadTestClients, disconnectClients, measureTime, generateRandomMessage, writeResults } from './setup';
import { Socket as ClientSocket } from 'socket.io-client';

// Test configuration
const CLIENT_COUNT = process.env.CLIENT_COUNT ? parseInt(process.env.CLIENT_COUNT, 10) : 100;
const MESSAGE_COUNT = process.env.MESSAGE_COUNT ? parseInt(process.env.MESSAGE_COUNT, 10) : 1000;
const MESSAGE_SIZE = process.env.MESSAGE_SIZE ? parseInt(process.env.MESSAGE_SIZE, 10) : 100;
const MESSAGE_BATCH_SIZE = process.env.MESSAGE_BATCH_SIZE ? parseInt(process.env.MESSAGE_BATCH_SIZE, 10) : 100;
const MESSAGE_BATCH_DELAY = process.env.MESSAGE_BATCH_DELAY ? parseInt(process.env.MESSAGE_BATCH_DELAY, 10) : 1000;

describe('Message Throughput Test', () => {
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

    it('should measure message throughput', async () => {
        // Skip in CI environment
        if (process.env.CI) {
            console.log('Skipping load test in CI environment');
            return;
        }

        // Prepare test data
        const messages = Array.from({ length: MESSAGE_COUNT }, () => ({
            content: generateRandomMessage(MESSAGE_SIZE),
            type: 'text'
        }));

        // Measure time to send messages
        const results = {
            clientCount: CLIENT_COUNT,
            messageCount: MESSAGE_COUNT,
            messageSize: MESSAGE_SIZE,
            batchSize: MESSAGE_BATCH_SIZE,
            batchDelay: MESSAGE_BATCH_DELAY,
            totalDuration: 0,
            messagesPerSecond: 0,
            batches: [] as { batchNumber: number, messages: number, duration: number, messagesPerSecond: number }[]
        };

        // Track received messages
        let receivedCount = 0;
        const messagePromises: Promise<void>[] = [];

        // Set up message handlers
        clients.forEach(client => {
            client.on('message:ack', () => {
                receivedCount++;
            });
        });

        const totalDuration = await measureTime(async () => {
            // Send messages in batches
            for (let i = 0; i < MESSAGE_COUNT; i += MESSAGE_BATCH_SIZE) {
                const batchNumber = Math.floor(i / MESSAGE_BATCH_SIZE) + 1;
                const batchSize = Math.min(MESSAGE_BATCH_SIZE, MESSAGE_COUNT - i);

                console.log(`Sending batch ${batchNumber} with ${batchSize} messages`);

                // Measure time to send batch
                const batchDuration = await measureTime(async () => {
                    // Distribute messages across clients
                    for (let j = 0; j < batchSize; j++) {
                        const clientIndex = j % clients.length;
                        const client = clients[clientIndex];
                        const message = messages[i + j];

                        // Send message and wait for acknowledgement
                        const promise = new Promise<void>((resolve) => {
                            const handler = () => {
                                client.off('message:ack', handler);
                                resolve();
                            };

                            client.on('message:ack', handler);
                            client.emit('client:message', message);
                        });

                        messagePromises.push(promise);
                    }

                    // Wait for all messages in batch to be acknowledged
                    await Promise.all(messagePromises.slice(-batchSize));
                });

                // Calculate messages per second for this batch
                const batchMessagesPerSecond = Math.round((batchSize / batchDuration) * 1000);

                // Add batch results
                results.batches.push({
                    batchNumber,
                    messages: batchSize,
                    duration: batchDuration,
                    messagesPerSecond: batchMessagesPerSecond
                });

                console.log(`Batch ${batchNumber} completed in ${batchDuration}ms (${batchMessagesPerSecond} messages/second)`);

                // Wait before sending next batch
                if (i + MESSAGE_BATCH_SIZE < MESSAGE_COUNT) {
                    await new Promise(resolve => setTimeout(resolve, MESSAGE_BATCH_DELAY));
                }
            }

            // Wait for all messages to be acknowledged
            await Promise.all(messagePromises);
        });

        // Calculate overall messages per second
        results.totalDuration = totalDuration;
        results.messagesPerSecond = Math.round((MESSAGE_COUNT / totalDuration) * 1000);

        console.log(`Total messages: ${MESSAGE_COUNT}`);
        console.log(`Total duration: ${totalDuration}ms`);
        console.log(`Overall message throughput: ${results.messagesPerSecond} messages/second`);

        // Write results to file
        writeResults('message-throughput', results);

        // Verify all messages were received
        expect(receivedCount).toBe(MESSAGE_COUNT);
    }, 300000); // 5 minute timeout
});