import { RoomManager, RoomDetails } from '../room-manager';
import { Server, Socket } from 'socket.io';
import { Logger } from '../logger';

// Mock dependencies
jest.mock('socket.io');
jest.mock('../logger');

describe('RoomManager', () => {
    let roomManager: RoomManager;
    let mockIo: jest.Mocked<Server>;
    let mockLogger: jest.Mocked<Logger>;
    let mockSocket1: jest.Mocked<Socket>;
    let mockSocket2: jest.Mocked<Socket>;

    beforeEach(() => {
        // Setup mocks
        mockIo = {
            sockets: {
                sockets: new Map(),
                adapter: {
                    rooms: new Map()
                }
            },
            to: jest.fn().mockReturnValue({
                emit: jest.fn()
            })
        } as unknown as jest.Mocked<Server>;

        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        } as jest.Mocked<Logger>;

        mockSocket1 = {
            id: 'socket-123',
            join: jest.fn(),
            leave: jest.fn()
        } as unknown as jest.Mocked<Socket>;

        mockSocket2 = {
            id: 'socket-456',
            join: jest.fn(),
            leave: jest.fn()
        } as unknown as jest.Mocked<Socket>;

        // Add mock sockets to io.sockets.sockets
        mockIo.sockets.sockets.set(mockSocket1.id, mockSocket1);
        mockIo.sockets.sockets.set(mockSocket2.id, mockSocket2);

        // Setup mock rooms
        mockIo.sockets.adapter.rooms.set('room1', new Set([mockSocket1.id]));
        mockIo.sockets.adapter.rooms.set('room2', new Set([mockSocket1.id, mockSocket2.id]));

        // Create room manager instance
        roomManager = new RoomManager(mockIo, mockLogger);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('addToRoom', () => {
        it('should add a socket to a room', () => {
            const room = 'test-room';

            roomManager.addToRoom(mockSocket1, room);

            expect(mockSocket1.join).toHaveBeenCalledWith(room);
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Socket ${mockSocket1.id} added to room ${room}`)
            );

            // Check room details
            const roomDetails = roomManager.getRoomDetails(room);
            expect(roomDetails).toBeDefined();
            expect(roomDetails?.name).toBe(room);
            expect(roomDetails?.type).toBe('group');
            expect(roomDetails?.members.has(mockSocket1.id)).toBe(true);
        });

        it('should add a socket to a room with specific type', () => {
            const room = 'user:123';

            roomManager.addToRoom(mockSocket1, room, 'user');

            // Check room details
            const roomDetails = roomManager.getRoomDetails(room);
            expect(roomDetails).toBeDefined();
            expect(roomDetails?.type).toBe('user');
        });
    });

    describe('removeFromRoom', () => {
        it('should remove a socket from a room', () => {
            const room = 'test-room';

            // First add the socket to the room
            roomManager.addToRoom(mockSocket1, room);

            // Then remove it
            roomManager.removeFromRoom(mockSocket1, room);

            expect(mockSocket1.leave).toHaveBeenCalledWith(room);
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Socket ${mockSocket1.id} removed from room ${room}`)
            );

            // Room should be deleted since it's empty
            const roomDetails = roomManager.getRoomDetails(room);
            expect(roomDetails).toBeUndefined();
        });

        it('should not delete system rooms when empty', () => {
            const room = 'system:test';

            // Add the socket to a system room
            roomManager.addToRoom(mockSocket1, room, 'system');

            // Then remove it
            roomManager.removeFromRoom(mockSocket1, room);

            // System room should still exist
            const roomDetails = roomManager.getRoomDetails(room);
            expect(roomDetails).toBeDefined();
            expect(roomDetails?.members.size).toBe(0);
        });
    });

    describe('removeFromAllRooms', () => {
        it('should remove a socket from all rooms', () => {
            // Add socket to multiple rooms
            roomManager.addToRoom(mockSocket1, 'room1');
            roomManager.addToRoom(mockSocket1, 'room2');

            // Remove from all rooms
            roomManager.removeFromAllRooms(mockSocket1);

            expect(mockSocket1.leave).toHaveBeenCalledTimes(2);
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Socket ${mockSocket1.id} removed from all rooms`)
            );

            // Socket should not be in any rooms
            const socketRooms = roomManager.getSocketRooms(mockSocket1);
            expect(socketRooms.size).toBe(0);
        });
    });

    describe('broadcastToRoom', () => {
        it('should broadcast a message to a room', () => {
            const room = 'test-room';
            const event = 'test-event';
            const payload = { message: 'test' };

            // Add socket to room
            roomManager.addToRoom(mockSocket1, room);

            // Broadcast to room
            roomManager.broadcastToRoom(room, event, payload);

            expect(mockIo.to).toHaveBeenCalledWith(room);
            expect(mockIo.to(room).emit).toHaveBeenCalledWith(event, payload);
        });
    });

    describe('getRoomsByType', () => {
        it('should return rooms by type', () => {
            // Create rooms of different types
            roomManager.addToRoom(mockSocket1, 'user:123', 'user');
            roomManager.addToRoom(mockSocket1, 'group:456', 'group');
            roomManager.addToRoom(mockSocket1, 'system:789', 'system');

            // Get user rooms
            const userRooms = roomManager.getRoomsByType('user');
            expect(userRooms.length).toBe(1);
            expect(userRooms[0].name).toBe('user:123');

            // Get group rooms
            const groupRooms = roomManager.getRoomsByType('group');
            expect(groupRooms.length).toBe(1);
            expect(groupRooms[0].name).toBe('group:456');

            // Get system rooms
            const systemRooms = roomManager.getRoomsByType('system');
            expect(systemRooms.length).toBe(1);
            expect(systemRooms[0].name).toBe('system:789');
        });
    });

    describe('setRoomMetadata', () => {
        it('should set room metadata', () => {
            const room = 'test-room';
            const metadata = { key: 'value' };

            // Add socket to room
            roomManager.addToRoom(mockSocket1, room);

            // Set metadata
            const result = roomManager.setRoomMetadata(room, metadata);

            expect(result).toBe(true);

            // Check metadata
            const roomDetails = roomManager.getRoomDetails(room);
            expect(roomDetails?.metadata).toEqual(metadata);
        });

        it('should return false for non-existent room', () => {
            const result = roomManager.setRoomMetadata('non-existent', { key: 'value' });
            expect(result).toBe(false);
        });
    });

    describe('createSystemRoom', () => {
        it('should create a system room', () => {
            const name = 'test';
            const metadata = { key: 'value' };

            const roomDetails = roomManager.createSystemRoom(name, metadata);

            expect(roomDetails).toBeDefined();
            expect(roomDetails.name).toBe('system:test');
            expect(roomDetails.type).toBe('system');
            expect(roomDetails.metadata).toEqual(metadata);

            // Check that room exists in manager
            const storedDetails = roomManager.getRoomDetails('system:test');
            expect(storedDetails).toBeDefined();
        });
    });

    describe('static methods', () => {
        it('should create correct user room name', () => {
            const userId = '123';
            const roomName = RoomManager.getUserRoom(userId);
            expect(roomName).toBe('user:123');
        });

        it('should create correct group room name', () => {
            const groupId = '456';
            const roomName = RoomManager.getGroupRoom(groupId);
            expect(roomName).toBe('group:456');
        });
    });
});