'use client'

import { useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type { 
  ServerToClientEvents, 
  ClientToServerEvents,
  ConnectedUser,
  Room,
  MessageData 
} from '@/lib/socket/types'

interface UseSocketOptions {
  username?: string
  token?: string
  autoConnect?: boolean
}

interface SocketState {
  connected: boolean
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null
  users: ConnectedUser[]
  rooms: Room[]
  messages: MessageData[]
  currentUser: { id: string; username?: string } | null
}

export function useSocket(options: UseSocketOptions = {}) {
  const { username, token, autoConnect = true } = options

  const [state, setState] = useState<SocketState>({
    connected: false,
    socket: null,
    users: [],
    rooms: [],
    messages: [],
    currentUser: null
  })

  const connect = useCallback(() => {
    // 如果已经有连接，先清理
    if (state.socket) {
      state.socket.disconnect()
    }

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
      path: '/api/socket/io',
      addTrailingSlash: false,
    })

    // 连接事件
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id)
      setState(prev => ({ ...prev, connected: true, socket }))
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
      setState(prev => ({ 
        ...prev, 
        connected: false, 
        currentUser: null 
      }))
    })

    // 认证结果
    socket.on('authenticated', (data) => {
      if (data.success && data.userId) {
        setState(prev => ({ 
          ...prev, 
          currentUser: { id: data.userId!, username } 
        }))
        console.log('Authentication successful:', data.userId)
      } else {
        console.error('Authentication failed:', data.error)
      }
    })

    // 用户列表更新
    socket.on('user_count_updated', (data) => {
      setState(prev => ({ ...prev, users: data.users }))
    })

    socket.on('users_list', (users) => {
      setState(prev => ({ ...prev, users }))
    })

    // 房间列表更新
    socket.on('rooms_list', (rooms) => {
      setState(prev => ({ ...prev, rooms }))
    })

    // 消息接收
    socket.on('new_message', (message) => {
      setState(prev => ({ 
        ...prev, 
        messages: [...prev.messages, message] 
      }))
    })

    // 通知接收
    socket.on('notification', (data) => {
      console.log('Notification received:', data)
      // 可以在这里触发通知UI
    })

    // 房间事件
    socket.on('joined_room', (data) => {
      console.log('Joined room:', data.room)
    })

    socket.on('user_joined', (data) => {
      console.log('User joined:', data.username)
    })

    socket.on('user_left', (data) => {
      console.log('User left:', data.username)
    })

    // 错误处理
    socket.on('error', (message) => {
      console.error('Socket error:', message)
    })

    setState(prev => ({ ...prev, socket }))
  }, [])

  // 新增认证方法
  const authenticate = useCallback(() => {
    if (state.socket && state.connected && (username || token)) {
      console.log('Authenticating with:', { username, token })
      state.socket.emit('authenticate', { username, token })
    }
  }, [state.socket, state.connected, username, token])

  const disconnect = useCallback(() => {
    if (state.socket) {
      state.socket.disconnect()
      setState(prev => ({ 
        ...prev, 
        socket: null, 
        connected: false, 
        currentUser: null,
        users: [],
        rooms: [],
        messages: []
      }))
    }
  }, [state.socket])

  const joinRoom = useCallback((roomName: string) => {
    if (state.socket && state.connected) {
      state.socket.emit('join_room', roomName)
    }
  }, [state.socket, state.connected])

  const leaveRoom = useCallback((roomName: string) => {
    if (state.socket && state.connected) {
      state.socket.emit('leave_room', roomName)
    }
  }, [state.socket, state.connected])

  const sendMessage = useCallback((content: string, room?: string) => {
    if (state.socket && state.connected) {
      state.socket.emit('send_message', { content, room })
    }
  }, [state.socket, state.connected])

  const getUsers = useCallback(() => {
    if (state.socket && state.connected) {
      state.socket.emit('get_users')
    }
  }, [state.socket, state.connected])

  const getRooms = useCallback(() => {
    if (state.socket && state.connected) {
      state.socket.emit('get_rooms')
    }
  }, [state.socket, state.connected])

  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    // 只在组件卸载时断开连接
    return () => {
      // 不在这里断开连接，而是在 disconnect 方法中处理
    }
  }, [autoConnect])

  return {
    ...state,
    connect,
    disconnect,
    authenticate,
    joinRoom,
    leaveRoom,
    sendMessage,
    getUsers,
    getRooms
  }
}