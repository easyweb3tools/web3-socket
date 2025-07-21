import { setupMetrics, Metrics } from '../metrics';
import { Express } from 'express';
import { Server } from 'socket.io';
import { ConnectionManager } from '../connection-manager';
import { RoomManager } from '../room-manager';
import { Logger } from '../logger';

// Mock dependencies
jest.mock('express');
jest.mock('socket.io');
jest.mock('../connection-manager');
jest.mock('../room-manager');
jest.mock('../logger');
jest.mock('prom-client', () => {
    const mockRegister = {
        contentType: 'text/plain',
        metrics: jest.fn().mockResolvedValue('mock metrics'),
        setDefaultLabels: jest.fn()
    };

    return {
        register: mockRegister,
        collectDefaultMetrics: jest.fn(),
        Counter: jest.fn().mockImplementation(() => ({
            inc: jest.fn(),
            labels: jest.fn().mockReturnThis()
        })),
        Gauge: jest.fn().mockImplementation(() => ({
            set: jest.fn(),
            labels: jest.fn().mockReturnThis()
        })),
        Histogram: jest.fn().mockImplementation(() => ({
            observe: jest.fn(),
            labels: jest.fn().mockReturnThis()
        })),
        Summary: jest.fn().mockImplementation(() => ({
            observe: jest.fn(),
            labels: jest.fn().mockReturnThis()
        }))
    };
});

describe('Metrics', () => {
    let metrics: Metrics;
    let mockApp: jest.Mocked<Express>;
    let mockIo: jest.Mocked<Server>;
    let mockConnectionManager: jest.Mocked<ConnectionManager>;
    let mockRoomManager: jest.Mocked<RoomManager>;
    let mockLogger: jest.Mocked<Logger>;

    beforeEach(() => {
        // Setup mocks
        mockApp = {
            get: jest.fn()
        } as unknown as jest.Mocked<Express>;

        mockIo = {
            on: jest.fn()
        } as unknown as jest.Mocked<Server>;

        mockConnectionManager = {
            getActiveConnectionsCount: jest.fn().mockReturnValue(5),
            getUserConnections: jest.fn().mockReturnValue(new Map([['user1', new Set()], ['user2', new Set()]]))
        } as unknown as jest.Mocked<ConnectionManager>;

        mockRoomManager = {
            getRoomCount: jest.fn().mockReturnValue(3),
            getRoomsByType: jest.fn().mockImplementation((type) => {
                if (type === 'user') return [{ name: 'user:1' }, { name: 'user:2' }] as any;
                if (type === 'group') return [{ name: 'group:1' }] as any;
                return [] as any;
            })
        } as unknown as jest.Mocked<RoomManager>;

        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            child: jest.fn().mockReturnThis()
        } as unknown as jest.Mocked<Logger>;

        // Create metrics instance
        metrics = setupMetrics(mockApp, mockIo, mockConnectionManager, mockRoomManager, mockLogger);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should set up metrics endpoint', () => {
        expect(mockApp.get).toHaveBeenCalledWith('/metrics', expect.any(Function));
    });

    it('should set up socket connection listener', () => {
        expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should provide utility methods for recording metrics', () => {
        expect(metrics.observeMessageLatency).toBeDefined();
        expect(metrics.incrementMessageCounter).toBeDefined();
        expect(metrics.recordMessageSize).toBeDefined();
        expect(metrics.recordError).toBeDefined();
        expect(metrics.recordHttpRequest).toBeDefined();
    });

    it('should record message latency', () => {
        const spy = jest.spyOn(metrics.messageLatency, 'observe');
        metrics.observeMessageLatency('test-event', 0.5);
        expect(spy).toHaveBeenCalledWith({ event: 'test-event' }, 0.5);
    });

    it('should increment message counter', () => {
        const spy = jest.spyOn(metrics.messageCounter, 'inc');
        metrics.incrementMessageCounter('outgoing', 'test-event');
        expect(spy).toHaveBeenCalledWith({ direction: 'outgoing', event: 'test-event' });
    });

    it('should record message size', () => {
        const spy = jest.spyOn(metrics.messageSize, 'observe');
        metrics.recordMessageSize('test-event', 1024);
        expect(spy).toHaveBeenCalledWith({ event: 'test-event' }, 1024);
    });

    it('should record errors', () => {
        const spy = jest.spyOn(metrics.errorCounter, 'inc');
        const error = new Error('Test error');
        metrics.recordError('test-type', error);
        expect(spy).toHaveBeenCalledWith({ type: 'test-type', code: 'Error' });
    });

    it('should record HTTP requests', () => {
        const durationSpy = jest.spyOn(metrics.httpRequestDuration, 'observe');
        const counterSpy = jest.spyOn(metrics.httpRequestCounter, 'inc');

        metrics.recordHttpRequest('GET', '/api/test', 200, 0.1);

        expect(durationSpy).toHaveBeenCalledWith(
            { method: 'GET', route: '/api/test', status_code: '200' },
            0.1
        );

        expect(counterSpy).toHaveBeenCalledWith(
            { method: 'GET', route: '/api/test', status_code: '200' }
        );
    });
});