'use client'

import { useState, useEffect, useRef } from 'react'

interface ChatMessage {
  id: string
  userId: string
  username?: string
  content: string
  timestamp: Date
  room?: string
}

export default function ChatComponent() {
  const [username, setUsername] = useState('')
  const [currentRoom, setCurrentRoom] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [currentUser, setCurrentUser] = useState<{id: string, username?: string} | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<any>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const connectSocket = async () => {
    if (socketRef.current) return

    // Dynamic import of socket.io-client
    const { io } = await import('socket.io-client')
    
    const socket = io({
      path: '/api/socket/io',
      addTrailingSlash: false,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id)
      setIsConnected(true)
      
      // Auto authenticate
      if (username) {
        socket.emit('authenticate', { username })
      }
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
      setIsConnected(false)
      setCurrentUser(null)
    })

    socket.on('authenticated', (data: any) => {
      if (data.success && data.userId) {
        setCurrentUser({ id: data.userId, username })
        console.log('Authentication successful:', data.userId)
        
        // Get users and rooms list
        socket.emit('get_users')
        socket.emit('get_rooms')
      } else {
        console.error('Authentication failed:', data.error)
      }
    })

    socket.on('user_count_updated', (data: any) => {
      setUsers(data.users)
    })

    socket.on('users_list', (users: any) => {
      setUsers(users)
    })

    socket.on('rooms_list', (rooms: any) => {
      setRooms(rooms)
    })

    socket.on('new_message', (message: any) => {
      setMessages(prev => [...prev, message])
    })

    socket.on('joined_room', (data: any) => {
      console.log('Joined room:', data.room)
    })

    socket.on('user_joined', (data: any) => {
      console.log('User joined:', data.username)
    })

    socket.on('user_left', (data: any) => {
      console.log('User left:', data.username)
    })

    socket.on('error', (message: string) => {
      console.error('Socket error:', message)
    })
  }

  const handleConnect = () => {
    if (username.trim()) {
      connectSocket()
    }
  }

  const handleDisconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    setIsConnected(false)
    setCurrentUser(null)
    setUsers([])
    setRooms([])
    setMessages([])
    setCurrentRoom('')
  }

  const handleJoinRoom = () => {
    if (currentRoom.trim() && socketRef.current) {
      socketRef.current.emit('join_room', currentRoom)
    }
  }

  const handleLeaveRoom = () => {
    if (currentRoom && socketRef.current) {
      socketRef.current.emit('leave_room', currentRoom)
      setCurrentRoom('')
    }
  }

  const handleSendMessage = () => {
    if (messageInput.trim() && socketRef.current) {
      socketRef.current.emit('send_message', { 
        content: messageInput, 
        room: currentRoom || undefined 
      })
      setMessageInput('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isConnected) {
        handleConnect()
      } else {
        handleSendMessage()
      }
    }
  }

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  const filteredMessages = currentRoom 
    ? messages.filter(msg => msg.room === currentRoom)
    : messages.filter(msg => !msg.room)

  return (
    <div className="max-w-4xl mx-auto dashboard-card">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white">Real-time Chat Test</h2>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span className="text-sm text-secondary">Chat Module</span>
        </div>
      </div>
      
      {/* Connection Status */}
      <div className="mb-6 p-4 rounded-xl bg-slate-800/50 border border-slate-600/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium text-white">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            {currentUser && (
              <span className="text-sm text-secondary ml-2">
                User: {currentUser.username || currentUser.id.slice(0, 8)}
              </span>
            )}
          </div>
          <div className="text-sm text-muted">
            Online Users: {users.length} | Active Rooms: {rooms.length}
          </div>
        </div>
      </div>

      {!isConnected ? (
        /* Login Form */
        <div className="mb-8 p-6 border rounded-xl border-slate-600/30 bg-slate-800/30">
          <div className="flex space-x-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter username..."
              className="flex-1 px-4 py-3 bg-slate-800/80 border border-slate-600/40 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
            />
            <button
              onClick={handleConnect}
              disabled={!username.trim()}
              className="px-6 py-3 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Connect
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Room Controls */}
          <div className="mb-6 p-6 border rounded-xl border-slate-600/30 bg-slate-800/30">
            <div className="flex items-center flex-wrap gap-3 mb-3">
              <input
                type="text"
                value={currentRoom}
                onChange={(e) => setCurrentRoom(e.target.value)}
                placeholder="Room name (leave empty for global chat)"
                className="flex-1 min-w-[200px] px-4 py-3 bg-slate-800/80 border border-slate-600/40 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
              />
              <button
                onClick={handleJoinRoom}
                disabled={!currentRoom.trim()}
                className="px-6 py-3 btn-success disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Join Room
              </button>
              {currentRoom && (
                <button
                  onClick={handleLeaveRoom}
                  className="px-6 py-3 btn-error"
                >
                  Leave Room
                </button>
              )}
              <button
                onClick={handleDisconnect}
                className="px-6 py-3 btn-secondary"
              >
                Disconnect
              </button>
            </div>
            <div className="text-sm text-muted">
              Current Location: {currentRoom ? `Room "${currentRoom}"` : 'Global Chat'}
            </div>
          </div>

          {/* Chat Messages */}
          <div className="mb-6 h-80 border rounded-xl overflow-y-auto p-4 bg-slate-800/30 border-slate-600/30">
            {filteredMessages.length === 0 ? (
              <div className="text-center text-muted mt-16">
                <div className="w-12 h-12 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                No messages yet, start chatting!
              </div>
            ) : (
              filteredMessages.map((message, index) => (
                <div 
                  key={message.id || index} 
                  className={`mb-3 p-4 rounded-lg ${
                    message.userId === currentUser?.id 
                      ? 'bg-blue-500/10 ml-8 border border-blue-500/20' 
                      : 'bg-slate-800/40 mr-8 border border-slate-600/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-muted mb-2">
                    <span className="font-medium text-secondary">{message.username || 'Anonymous User'}</span>
                    <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-sm text-white">{message.content}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="flex space-x-3 mb-8">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter message..."
              className="flex-1 px-4 py-3 bg-slate-800/80 border border-slate-600/40 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              className="px-6 py-3 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>

          {/* Users and Rooms Lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border rounded-xl p-6 border-slate-600/30 bg-slate-800/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-white">Online Users</h3>
                <span className="text-sm text-secondary bg-slate-700/50 px-2 py-1 rounded-full">{users.length}</span>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {users.map((user, index) => (
                  <div key={user.id || index} className="text-sm flex justify-between items-center p-3 rounded-lg bg-slate-800/50 border border-slate-600/20">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-white">{user.username || 'Anonymous User'}</span>
                    </div>
                    <span className="text-muted text-xs">
                      {user.rooms?.length > 0 ? `${user.rooms.length} rooms` : 'No rooms'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border rounded-xl p-6 border-slate-600/30 bg-slate-800/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-white">Active Rooms</h3>
                <span className="text-sm text-secondary bg-slate-700/50 px-2 py-1 rounded-full">{rooms.length}</span>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {rooms.map((room, index) => (
                  <div key={room.id || index} className="text-sm flex justify-between items-center p-3 rounded-lg bg-slate-800/50 border border-slate-600/20">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span className="text-white">{room.name}</span>
                    </div>
                    <span className="text-muted text-xs">{room.userCount} users</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}