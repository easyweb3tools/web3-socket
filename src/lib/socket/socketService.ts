import { Server as NetServer } from 'http'
import { NextApiRequest, NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../logger'
import { ConnectedUser, Room, MessageData } from './types'

export interface SocketIOServer extends NetServer {
  io?: ServerIO
}

export interface SocketIOResponse extends NextApiResponse {
  socket: NextApiResponse['socket'] & {
    server: SocketIOServer
  }
}

// Use Node.js global object to ensure true singleton
declare global {
  var __socketService: SocketService | undefined
}

class SocketService {
  private io: ServerIO | null = null
  private connectedUsers: Map<string, ConnectedUser> = new Map()
  private rooms: Map<string, Room> = new Map()
  private messages: MessageData[] = []
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
  private initialized = false
  private instanceId: number

  constructor() {
    this.instanceId = Date.now()
    console.log('Creating new SocketService instance, ID:', this.instanceId)
  }

  static getInstance(): SocketService {
    if (typeof global !== 'undefined') {
      // Server environment, use global variable
      if (!global.__socketService) {
        global.__socketService = new SocketService()
      }
      return global.__socketService
    } else {
      // Client environment (should not happen, but as fallback)
      // Client should not use SocketService, throw error directly
      throw new Error('SocketService should only be used on the server side')
    }
  }

  initialize(server: SocketIOServer): ServerIO {
    if (!server.io) {
      logger.info('Initializing Socket.IO server')
      this.initialized = true
      
      server.io = new ServerIO(server, {
        path: '/api/socket/io',
        addTrailingSlash: false,
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        }
      })

      this.io = server.io
      this.setupEventHandlers()
    }

    return server.io
  }

  private setupEventHandlers() {
    if (!this.io) return

    this.io.on('connection', (socket) => {
      logger.info('New user connected', { socketId: socket.id })

      // User authentication
      socket.on('authenticate', (data: { token?: string, username?: string }) => {
        try {
          logger.info('Authentication request received', { data, socketId: socket.id })
          const user = this.authenticateUser(socket.id, data)
          if (user) {
            this.connectedUsers.set(socket.id, user)
            socket.emit('authenticated', { success: true, userId: user.id })
            this.broadcastUserCount()
            logger.info('User authentication successful', { userId: user.id, socketId: socket.id, username: user.username })
          }
        } catch (error) {
          socket.emit('authenticated', { success: false, error: 'Authentication failed' })
          logger.error('User authentication failed', error, socket.id)
        }
      })

      // Join room
      socket.on('join_room', (roomName: string) => {
        const user = this.connectedUsers.get(socket.id)
        if (!user) {
          socket.emit('error', 'User not authenticated')
          return
        }

        socket.join(roomName)
        user.rooms.push(roomName)
        
        this.updateOrCreateRoom(roomName, user.id)
        socket.emit('joined_room', { room: roomName })
        socket.to(roomName).emit('user_joined', { userId: user.id, username: user.username })
        
        logger.info('User joined room', { userId: user.id, room: roomName })
      })

      // Leave room
      socket.on('leave_room', (roomName: string) => {
        const user = this.connectedUsers.get(socket.id)
        if (!user) return

        socket.leave(roomName)
        user.rooms = user.rooms.filter(room => room !== roomName)
        
        this.removeUserFromRoom(roomName, user.id)
        socket.to(roomName).emit('user_left', { userId: user.id, username: user.username })
        
        logger.info('User left room', { userId: user.id, room: roomName })
      })

      // Send message
      socket.on('send_message', (data: { content: string, room?: string }) => {
        const user = this.connectedUsers.get(socket.id)
        if (!user) {
          socket.emit('error', 'User not authenticated')
          return
        }

        const message: MessageData = {
          id: uuidv4(),
          userId: user.id,
          username: user.username,
          content: data.content,
          timestamp: new Date(),
          room: data.room
        }

        this.messages.push(message)
        
        if (data.room) {
          this.io!.to(data.room).emit('new_message', message)
        } else {
          this.io!.emit('new_message', message)
        }

        logger.info('Message sent', { userId: user.id, room: data.room, messageLength: data.content.length })
      })

      // Get online users
      socket.on('get_users', () => {
        const users = Array.from(this.connectedUsers.values())
        socket.emit('users_list', users)
      })

      // Get room list
      socket.on('get_rooms', () => {
        const rooms = Array.from(this.rooms.values())
        socket.emit('rooms_list', rooms)
      })

      // Disconnect
      socket.on('disconnect', () => {
        const user = this.connectedUsers.get(socket.id)
        if (user) {
          // Remove user from all rooms
          user.rooms.forEach(roomName => {
            this.removeUserFromRoom(roomName, user.id)
            socket.to(roomName).emit('user_left', { userId: user.id, username: user.username })
          })

          this.connectedUsers.delete(socket.id)
          this.broadcastUserCount()
          
          logger.info('User disconnected', { userId: user.id, socketId: socket.id })
        }
      })
    })
  }

  private authenticateUser(socketId: string, data: { token?: string, username?: string }): ConnectedUser {
    let userId: string
    let username: string | undefined

    if (data.token) {
      try {
        const decoded = jwt.verify(data.token, this.JWT_SECRET) as any
        userId = decoded.userId
        username = decoded.username
      } catch (error) {
        throw new Error('Invalid token')
      }
    } else {
      userId = uuidv4()
      username = data.username || `User_${userId.slice(0, 8)}`
    }

    return {
      id: userId,
      socketId,
      username,
      connectedAt: new Date(),
      lastActivity: new Date(),
      rooms: []
    }
  }

  private updateOrCreateRoom(roomName: string, userId: string) {
    let room = this.rooms.get(roomName)
    
    if (!room) {
      room = {
        id: uuidv4(),
        name: roomName,
        createdAt: new Date(),
        userCount: 0,
        users: []
      }
    }

    if (!room.users.includes(userId)) {
      room.users.push(userId)
      room.userCount = room.users.length
    }

    this.rooms.set(roomName, room)
  }

  private removeUserFromRoom(roomName: string, userId: string) {
    const room = this.rooms.get(roomName)
    if (room) {
      room.users = room.users.filter(id => id !== userId)
      room.userCount = room.users.length
      
      if (room.userCount === 0) {
        this.rooms.delete(roomName)
      } else {
        this.rooms.set(roomName, room)
      }
    }
  }

  private broadcastUserCount() {
    if (this.io) {
      this.io.emit('user_count_updated', {
        count: this.connectedUsers.size,
        users: Array.from(this.connectedUsers.values())
      })
    }
  }

  // Public methods for API calls
  getConnectedUsers(): ConnectedUser[] {
    console.log('getConnectedUsers called, size:', this.connectedUsers.size)
    return Array.from(this.connectedUsers.values())
  }

  getRooms(): Room[] {
    return Array.from(this.rooms.values())
  }

  getMessages(room?: string, limit?: number): MessageData[] {
    let messages = room 
      ? this.messages.filter(msg => msg.room === room)
      : this.messages

    return limit ? messages.slice(-limit) : messages
  }

  broadcastToRoom(roomName: string, event: string, data: any) {
    if (this.io) {
      this.io.to(roomName).emit(event, data)
      logger.info('Broadcasting message to room', { room: roomName, event, data })
    }
  }

  broadcastToAll(event: string, data: any) {
    if (this.io) {
      this.io.emit(event, data)
      logger.info('Broadcasting message to all users', { event, data })
    }
  }

  disconnectUser(socketId: string) {
    const socket = this.io?.sockets.sockets.get(socketId)
    if (socket) {
      socket.disconnect()
      logger.info('Forcing user disconnect', { socketId })
    }
  }

  getConnectionCount(): number {
    return this.connectedUsers.size
  }

  getServerStatus() {
    console.log('=== SocketService Status Debug ===')
    console.log('Instance ID:', this.instanceId)
    console.log('Instance initialized:', this.initialized)
    console.log('connectedUsers size:', this.connectedUsers.size)
    console.log('connectedUsers content:', Array.from(this.connectedUsers.entries()))
    console.log('rooms size:', this.rooms.size)
    console.log('messages length:', this.messages.length)
    console.log('================================')
    
    return {
      status: 'running',
      connections: this.connectedUsers.size,
      rooms: this.rooms.size,
      messages: this.messages.length,
      uptime: process.uptime()
    }
  }
}

export const socketService = SocketService.getInstance()