import { HandlerRegistry } from '../handlers/handler-registry';
import { BaseEventHandler, EventHandler } from '../handlers/base-handler';
import { Server, Socket } from 'socket.io';
import { ConnectionManager } from '../connection-manager';
import { RoomManager } from '../room-manager';
import { Logger } from '../logger';

// Mock dependencies
jest.mock('socket.io');
jest.mock('../logger');
jest.mock('../connection-manager');
jest.mock('../room-manager');

// Create a mock handler for testing
class MockHandler extends BaseEventHandler {
    public registerEvents(): void {
        this.registerEventHandler('test:event', this.handleTestEvent.bind(this));
        this.registerEventHandler('another:event', this.handleAnotherEvent.bind(this));
    }

    public getName(): string {
        return 'mock-handler';
    }

    private async handleTestEvent(socket: Socket, data: any): Promise<void> {
        socket.emit('test:response', { success: true, data });
    }

    private async handleAnotherEvent(socket: Socket, data: any): Promise<void> {
        socket.emit('another:response', { success: true, data });
    }
}

describe('HandlerRegistry', () => {
    let registry: HandlerRegistry;
    let mockIo: jest.Mocked<Server>;
    let mockConnectionManager: jest.Mocked<ConnectionManager>;
    let mockRoomManager: jest.Mocked<RoomManager>;
    let mockLogger: jest.Mocked<Logger>;
    let mockSocket: jest.Mocked<Socket>;
    let mockHandler: EventHandler;

    beforeEach(() => {
        // Setup mocks
        mockIo = {
            on: jest.fn(),
            sockets: {
                sockets: new Map()
            }
        } as unknown as jest.Mocked<Server>;

        mockConnectionManager = {
            getUserId: jest.fn().mockReturnValue('user-123'),
            isAuthenticated: jest.fn().mockReturnValue(true)
        } as unknown as jest.Mocked<ConnectionManager>;

        mockRoomManager = {} as jest.Mocked<RoomManager>;

        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        } as jest.Mocked<Logger>;

        mockSocket = {
            id: 'socket-123',
            on: jest.fn(),
            emit: jest.fn(),
            handshake: {
                headers: {
                    'user-agent': 'test-agent'
                },
                address: '127.0.0.1'
            }
        } as unknown as jest.Mocked<Socket>;

        // Create registry
        registry = new HandlerRegistry(mockIo, mockConnectionManager, mockRoomManager, mockLogger);

        // Create and register mock handler
        mockHandler = new MockHandler(mockIo, mockConnectionManager, mockRoomManager, mockLogger);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('registerHandler', () => {
        it('should register a handler', () => {
            registry.registerHandler(mockHandler);

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Registered handler: ${mockHandler.getName()}`),
                expect.anything()
            );

            const registeredHandler = registry.getHandler(mockHandler.getName());
            expect(registeredHandler).toBe(mockHandler);
        });
    });

    describe('getHandlerForEvent', () => {
        it('should return the correct handler for an event', () => {
            registry.registerHandler(mockHandler);

            const handler = registry.getHandlerForEvent('test:event');
            expect(handler).toBe(mockHandler);
        });

        it('should return undefined for unknown event', () => {
            registry.registerHandler(mockHandler);

            const handler = registry.getHandlerForEvent('unknown:event');
            expect(handler).toBeUndefined();
        });
    });

    describe('handleEvent', () => {
        it('should handle an event with the correct handler', async () => {
            registry.registerHandler(mockHandler);

            const eventSpy = jest.spyOn(mockHandler, 'handleEvent');

            await registry.handleEvent(mockSocket, 'test:event', { test: 'data' });

            expect(eventSpy).toHaveBeenCalledWith(mockSocket, 'test:event', { test: 'data' });
        });

        it('should emit error for unknown event', async () => {
            registry.registerHandler(mockHandler);

            await registry.handleEvent(mockSocket, 'unknown:event', { test: 'data' });

            expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
                event: 'unknown:event',
                code: 'UNSUPPORTED_EVENT'
            }));
        });
    });

    describe('setupConnectionHandler', () => {
        it('should set up connection handler', () => {
            registry.registerHandler(mockHandler);
            registry.setupConnectionHandler();

            expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
            expect(mockLogger.info).toHaveBeenCalledWith('Connection handler setup complete');
        });
    });
});