export interface ConnectedUser {
  id: string
  socketId: string
  username?: string
  connectedAt: Date
  lastActivity: Date
  rooms: string[]
}

export interface Room {
  id: string
  name: string
  createdAt: Date
  userCount: number
  users: string[]
}

export interface MessageData {
  id: string
  userId: string
  username?: string
  content: string
  timestamp: Date
  room?: string
}

export interface ServerToClientEvents {
  authenticated: (data: { success: boolean; userId?: string; error?: string }) => void
  joined_room: (data: { room: string }) => void
  user_joined: (data: { userId: string; username?: string }) => void
  user_left: (data: { userId: string; username?: string }) => void
  new_message: (message: MessageData) => void
  users_list: (users: ConnectedUser[]) => void
  rooms_list: (rooms: Room[]) => void
  user_count_updated: (data: { count: number; users: ConnectedUser[] }) => void
  error: (message: string) => void
  notification: (data: { type: string; message: string; data?: any }) => void
}

export interface ClientToServerEvents {
  authenticate: (data: { token?: string; username?: string }) => void
  join_room: (roomName: string) => void
  leave_room: (roomName: string) => void
  send_message: (data: { content: string; room?: string }) => void
  get_users: () => void
  get_rooms: () => void
}

export interface InterServerEvents {
  ping: () => void
}

export interface SocketData {
  userId?: string
  username?: string
}