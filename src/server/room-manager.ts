import { Server, Socket } from 'socket.io';
import { Logger } from './logger';

export interface RoomDetails {
    name: string;
    type: 'user' | 'group' | 'system';
    members: Set<string>; // socketIds
    metadata?: Record<string, any>;
    createdAt: Date;
}

export class RoomManager {
    private socketRooms: Map<string, Set<string>> = new Map(); // socketId -> Set<roomName>
    private roomDetails: Map<string, RoomDetails> = new Map(); // roomName -> RoomDetails
    private moduleLogger: Logger;

    constructor(
        private io: Server,
        private logger: Logger
    ) {
        this.moduleLogger = logger.child({ module: 'RoomManager' });
        this.moduleLogger.info('RoomManager initialized');
    }

    /**
     * Add a socket to a room
     */
    public addToRoom(socket: Socket, room: string, type: 'user' | 'group' | 'system' = 'group'): void {
        const opLogger = this.moduleLogger.child({
            operation: 'addToRoom',
            socketId: socket.id,
            room,
            type
        });

        socket.join(room);

        // Track socket's rooms
        if (!this.socketRooms.has(socket.id)) {
            this.socketRooms.set(socket.id, new Set());
        }

        this.socketRooms.get(socket.id)?.add(room);

        // Track room details
        if (!this.roomDetails.has(room)) {
            this.roomDetails.set(room, {
                name: room,
                type,
                members: new Set(),
                createdAt: new Date()
            });

            opLogger.info('Room created', {
                roomType: type
            });
        }

        this.roomDetails.get(room)?.members.add(socket.id);

        const memberCount = this.roomDetails.get(room)?.members.size || 1;

        opLogger.info('Socket added to room', {
            memberCount,
            userId: socket.data?.userId
        });
    }

    /**
     * Remove a socket from a room
     */
    public removeFromRoom(socket: Socket, room: string): void {
        const opLogger = this.moduleLogger.child({
            operation: 'removeFromRoom',
            socketId: socket.id,
            room
        });

        socket.leave(room);

        // Update socket's rooms
        const rooms = this.socketRooms.get(socket.id);
        if (rooms) {
            rooms.delete(room);
        }

        // Update room details
        const roomDetail = this.roomDetails.get(room);
        if (roomDetail) {
            roomDetail.members.delete(socket.id);

            // Clean up empty rooms (except system rooms)
            if (roomDetail.members.size === 0 && roomDetail.type !== 'system') {
                this.roomDetails.delete(room);
                opLogger.info('Room deleted (empty)', {
                    roomType: roomDetail.type,
                    roomLifetime: Math.round((Date.now() - roomDetail.createdAt.getTime()) / 1000)
                });
            } else {
                opLogger.info('Socket removed from room', {
                    remainingMembers: roomDetail.members.size,
                    userId: socket.data?.userId
                });
            }
        }
    }

    /**
     * Remove a socket from all rooms
     */
    public removeFromAllRooms(socket: Socket): void {
        const rooms = this.socketRooms.get(socket.id);

        if (rooms) {
            const opLogger = this.moduleLogger.child({
                operation: 'removeFromAllRooms',
                socketId: socket.id,
                roomCount: rooms.size,
                userId: socket.data?.userId
            });

            // Create a copy of the rooms set to avoid modification during iteration
            const roomsCopy = Array.from(rooms);

            roomsCopy.forEach(room => {
                this.removeFromRoom(socket, room);
            });

            this.socketRooms.delete(socket.id);
            opLogger.info('Socket removed from all rooms');
        }
    }

    /**
     * Get all rooms a socket is in
     */
    public getSocketRooms(socket: Socket): Set<string> {
        return new Set(this.socketRooms.get(socket.id) || []);
    }

    /**
     * Get all sockets in a room
     */
    public getRoomSockets(room: string): Socket[] {
        const roomData = this.io.sockets.adapter.rooms.get(room);
        if (!roomData) return [];

        return Array.from(roomData)
            .map(socketId => this.io.sockets.sockets.get(socketId))
            .filter((socket): socket is Socket => socket !== undefined);
    }

    /**
     * Get socket IDs in a room
     */
    public getRoomSocketIds(room: string): string[] {
        const roomData = this.io.sockets.adapter.rooms.get(room);
        return roomData ? Array.from(roomData) : [];
    }

    /**
     * Get total room count
     */
    public getRoomCount(): number {
        return this.roomDetails.size;
    }

    /**
     * Get all rooms
     */
    public getAllRooms(): RoomDetails[] {
        return Array.from(this.roomDetails.values());
    }

    /**
     * Get room details
     */
    public getRoomDetails(room: string): RoomDetails | undefined {
        return this.roomDetails.get(room);
    }

    /**
     * Get rooms by type
     */
    public getRoomsByType(type: 'user' | 'group' | 'system'): RoomDetails[] {
        return Array.from(this.roomDetails.values())
            .filter(room => room.type === type);
    }

    /**
     * Set room metadata
     */
    public setRoomMetadata(room: string, metadata: Record<string, any>): boolean {
        const roomDetail = this.roomDetails.get(room);

        if (roomDetail) {
            roomDetail.metadata = { ...roomDetail.metadata, ...metadata };

            this.moduleLogger.debug('Room metadata updated', {
                operation: 'setRoomMetadata',
                room,
                metadataKeys: Object.keys(metadata)
            });

            return true;
        }

        return false;
    }

    /**
     * Broadcast a message to a room
     */
    public broadcastToRoom(room: string, event: string, payload: any): void {
        this.io.to(room).emit(event, payload);

        const roomDetail = this.roomDetails.get(room);
        const memberCount = roomDetail?.members.size || 0;

        this.moduleLogger.debug('Broadcast to room', {
            operation: 'broadcastToRoom',
            room,
            event,
            recipients: memberCount,
            payloadSize: JSON.stringify(payload).length
        });
    }

    /**
     * Broadcast a message to all rooms of a specific type
     */
    public broadcastToRoomType(type: 'user' | 'group' | 'system', event: string, payload: any): void {
        const rooms = this.getRoomsByType(type);

        rooms.forEach(room => {
            this.broadcastToRoom(room.name, event, payload);
        });

        this.moduleLogger.debug('Broadcast to room type', {
            operation: 'broadcastToRoomType',
            type,
            event,
            roomCount: rooms.length,
            payloadSize: JSON.stringify(payload).length
        });
    }

    /**
     * Create a system room
     */
    public createSystemRoom(name: string, metadata?: Record<string, any>): RoomDetails {
        const roomName = `system:${name}`;

        if (!this.roomDetails.has(roomName)) {
            this.roomDetails.set(roomName, {
                name: roomName,
                type: 'system',
                members: new Set(),
                metadata,
                createdAt: new Date()
            });

            this.moduleLogger.info('System room created', {
                operation: 'createSystemRoom',
                room: roomName,
                hasMetadata: !!metadata
            });
        }

        return this.roomDetails.get(roomName)!;
    }

    /**
     * Create a group room
     */
    public createGroupRoom(name: string, metadata?: Record<string, any>): RoomDetails {
        const roomName = `group:${name}`;

        if (!this.roomDetails.has(roomName)) {
            this.roomDetails.set(roomName, {
                name: roomName,
                type: 'group',
                members: new Set(),
                metadata,
                createdAt: new Date()
            });

            this.moduleLogger.info('Group room created', {
                operation: 'createGroupRoom',
                room: roomName,
                hasMetadata: !!metadata
            });
        }

        return this.roomDetails.get(roomName)!;
    }

    /**
     * Add multiple sockets to a room
     */
    public addSocketsToRoom(sockets: Socket[], room: string, type: 'user' | 'group' | 'system' = 'group'): void {
        sockets.forEach(socket => {
            this.addToRoom(socket, room, type);
        });

        this.moduleLogger.info('Added multiple sockets to room', {
            operation: 'addSocketsToRoom',
            room,
            socketCount: sockets.length,
            type
        });
    }

    /**
     * Create a user-specific room name
     */
    public static getUserRoom(userId: string): string {
        return `user:${userId}`;
    }

    /**
     * Create a group-specific room name
     */
    public static getGroupRoom(groupId: string): string {
        return `group:${groupId}`;
    }
}