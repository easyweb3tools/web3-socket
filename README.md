# Web3 Socket - Real-time Communication Service

A full-stack real-time communication project based on Next.js and Socket.IO, providing complete WebSocket services and management Dashboard.

## ✨ Features

- 🚀 **Real-time Communication**: Bidirectional real-time communication based on Socket.IO
- 📊 **Management Panel**: Complete interface for connection, room, and log management
- 🔐 **Authentication System**: Supports JWT and anonymous user authentication
- 🏠 **Room Management**: Supports multi-room chat and private messaging
- 📝 **Logging System**: Complete event logging and viewing
- 📈 **Monitoring Metrics**: Real-time system status and performance monitoring
- 🎨 **Modern UI**: Responsive design based on Tailwind CSS

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Socket.IO, Node.js
- **Authentication**: JWT
- **Real-time**: Socket.IO v4.7.5

## 📁 Project Structure

```
web3-socket/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API Routes
│   │   │   ├── socket/               # Socket.IO management endpoints
│   │   │   ├── status/               # Service status API
│   │   │   ├── connections/          # Connection management API
│   │   │   ├── rooms/                # Room management API
│   │   │   ├── push/                 # Message push API
│   │   │   ├── broadcast/            # Broadcast message API
│   │   │   └── logs/                 # Log viewing API
│   │   ├── dashboard/                # Dashboard pages
│   │   │   ├── connections/          # Connection management page
│   │   │   ├── rooms/                # Room management page
│   │   │   ├── logs/                 # Log viewing page
│   │   │   └── metrics/              # Metrics monitoring page
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Home page
│   ├── components/                   # React components
│   │   └── dashboard/                # Dashboard components
│   ├── lib/                          # Utility libraries and services
│   │   ├── socket/                   # Socket.IO server-side logic
│   │   └── logger/                   # Logging service
│   ├── hooks/                        # React Hooks
│   │   └── useSocket.ts              # Socket.IO client Hook
│   └── types/                        # TypeScript type definitions
├── pages/api/socket/                 # Socket.IO initialization
└── public/                           # Static assets
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Access Application

- Home: http://localhost:3000
- Management Panel: http://localhost:3000/dashboard

## 📡 API Endpoints

### Service Status
- `GET /api/status` - Get server running status

### Connection Management
- `GET /api/connections` - Get all online connections
- `DELETE /api/connections?socketId=xxx` - Disconnect specific connection

### Room Management
- `GET /api/rooms` - Get all active rooms

### Message Push
- `POST /api/push` - Send message to specific room or globally
- `GET /api/push?room=xxx&limit=20` - Get message history

### Broadcast Notifications
- `POST /api/broadcast` - Broadcast system notifications

### Log Management
- `GET /api/logs?level=INFO&limit=100` - Get system logs
- `DELETE /api/logs` - Clear logs

## 🔌 Socket.IO Events

### Client-Side Events
- `authenticate` - User authentication
- `join_room` - Join room
- `leave_room` - Leave room
- `send_message` - Send message
- `get_users` - Get online users list
- `get_rooms` - Get rooms list

### Server-Side Events
- `authenticated` - Authentication result
- `joined_room` - Successfully joined room
- `user_joined` - User joined room
- `user_left` - User left room
- `new_message` - New message
- `users_list` - Users list
- `rooms_list` - Rooms list
- `user_count_updated` - Online user count updated
- `notification` - System notification

## 🎯 Usage Examples

### Basic Connection and Chat

```typescript
import { useSocket } from '@/hooks/useSocket'

function ChatApp() {
  const { connected, sendMessage, messages } = useSocket({
    username: 'testuser',
    autoConnect: true
  })

  const handleSend = () => {
    sendMessage('Hello World!')
  }

  return (
    <div>
      <div>Status: {connected ? 'Connected' : 'Disconnected'}</div>
      <button onClick={handleSend}>Send Message</button>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
    </div>
  )
}
```

### Room Chat

```typescript
const { joinRoom, leaveRoom, sendMessage } = useSocket()

// Join room
joinRoom('general')

// Send room message
sendMessage('Hello room!', 'general')

// Leave room
leaveRoom('general')
```

## 🔧 Configuration

### Environment Variables

```env
JWT_SECRET=your-secret-key
```

### Socket.IO Configuration

Socket.IO server runs at `/api/socket/io` path and supports cross-origin access.

## 📈 Monitoring and Logging

- **Real-time Monitoring**: Dashboard provides real-time connection count, room count, and message statistics
- **Logging System**: Records all connection, disconnection, message sending events
- **Performance Metrics**: System uptime, memory usage and other information

## 🚀 Deployment

### Development Environment
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📄 License

MIT License

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/)
- [Socket.IO](https://socket.io/)
- [Tailwind CSS](https://tailwindcss.com/)
- [React](https://reactjs.org/)