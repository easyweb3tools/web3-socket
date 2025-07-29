# Web3 Socket - 实时通信服务

一个基于 Next.js 和 Socket.IO 的全栈实时通信项目，提供完整的 WebSocket 服务和管理 Dashboard。

## ✨ 特性

- 🚀 **实时通信**: 基于 Socket.IO 的双向实时通信
- 📊 **管理面板**: 完整的连接、房间、日志管理界面
- 🔐 **认证系统**: 支持 JWT 和匿名用户认证
- 🏠 **房间管理**: 支持多房间聊天和私聊
- 📝 **日志系统**: 完整的事件日志记录和查看
- 📈 **监控指标**: 实时系统状态和性能监控
- 🎨 **现代UI**: 基于 Tailwind CSS 的响应式设计

## 🛠️ 技术栈

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Socket.IO, Node.js
- **Authentication**: JWT
- **Real-time**: Socket.IO v4.7.5

## 📁 项目结构

```
web3-socket/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API Routes
│   │   │   ├── socket/               # Socket.IO 管理端点
│   │   │   ├── status/               # 服务状态 API
│   │   │   ├── connections/          # 连接管理 API
│   │   │   ├── rooms/                # 房间管理 API
│   │   │   ├── push/                 # 消息推送 API
│   │   │   ├── broadcast/            # 广播消息 API
│   │   │   └── logs/                 # 日志查看 API
│   │   ├── dashboard/                # Dashboard 页面
│   │   │   ├── connections/          # 连接管理页面
│   │   │   ├── rooms/                # 房间管理页面
│   │   │   ├── logs/                 # 日志查看页面
│   │   │   └── metrics/              # 指标监控页面
│   │   ├── layout.tsx                # 根布局
│   │   └── page.tsx                  # 首页
│   ├── components/                   # React 组件
│   │   └── dashboard/                # Dashboard 组件
│   ├── lib/                          # 工具库和服务
│   │   ├── socket/                   # Socket.IO 服务端逻辑
│   │   └── logger/                   # 日志服务
│   ├── hooks/                        # React Hooks
│   │   └── useSocket.ts              # Socket.IO 客户端 Hook
│   └── types/                        # TypeScript 类型定义
├── pages/api/socket/                 # Socket.IO 初始化
└── public/                           # 静态资源
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 访问应用

- 首页: http://localhost:3000
- 管理面板: http://localhost:3000/dashboard

## 📡 API 接口

### 服务状态
- `GET /api/status` - 获取服务器运行状态

### 连接管理
- `GET /api/connections` - 获取所有在线连接
- `DELETE /api/connections?socketId=xxx` - 断开指定连接

### 房间管理
- `GET /api/rooms` - 获取所有活跃房间

### 消息推送
- `POST /api/push` - 发送消息到指定房间或全局
- `GET /api/push?room=xxx&limit=20` - 获取消息历史

### 广播通知
- `POST /api/broadcast` - 广播系统通知

### 日志管理
- `GET /api/logs?level=INFO&limit=100` - 获取系统日志
- `DELETE /api/logs` - 清空日志

## 🔌 Socket.IO 事件

### 客户端发送事件
- `authenticate` - 用户认证
- `join_room` - 加入房间
- `leave_room` - 离开房间
- `send_message` - 发送消息
- `get_users` - 获取在线用户列表
- `get_rooms` - 获取房间列表

### 服务端发送事件
- `authenticated` - 认证结果
- `joined_room` - 加入房间成功
- `user_joined` - 用户加入房间
- `user_left` - 用户离开房间
- `new_message` - 新消息
- `users_list` - 用户列表
- `rooms_list` - 房间列表
- `user_count_updated` - 在线用户数更新
- `notification` - 系统通知

## 🎯 使用示例

### 基本连接和聊天

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

### 房间聊天

```typescript
const { joinRoom, leaveRoom, sendMessage } = useSocket()

// 加入房间
joinRoom('general')

// 发送房间消息
sendMessage('Hello room!', 'general')

// 离开房间
leaveRoom('general')
```

## 🔧 配置

### 环境变量

```env
JWT_SECRET=your-secret-key
```

### Socket.IO 配置

Socket.IO 服务器在 `/api/socket/io` 路径下运行，支持跨域访问。

## 📈 监控和日志

- **实时监控**: Dashboard 提供实时的连接数、房间数、消息统计
- **日志系统**: 记录所有连接、断开、消息发送等事件
- **性能指标**: 系统运行时间、内存使用等信息

## 🚀 部署

### 开发环境
```bash
npm run dev
```

### 生产构建
```bash
npm run build
npm start
```

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests！

## 📄 许可证

MIT License

## 🙏 致谢

- [Next.js](https://nextjs.org/)
- [Socket.IO](https://socket.io/)
- [Tailwind CSS](https://tailwindcss.com/)
- [React](https://reactjs.org/)