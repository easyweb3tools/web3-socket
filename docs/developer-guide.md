# Socket Server Developer Guide

This guide provides comprehensive information for developers working on the Socket Server project.

## Table of Contents

- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Core Components](#core-components)
- [Adding New Features](#adding-new-features)
- [Testing](#testing)
- [Contribution Guidelines](#contribution-guidelines)

## Development Environment Setup

### Prerequisites

- Node.js 16.x or higher
- npm 7.x or higher
- Redis (for multi-instance development)
- Git

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-org/socket-server.git
cd socket-server
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.development` file:

```bash
cp .env.example .env.development
```

4. Edit the `.env.development` file with your local configuration.

5. Start the development server:

```bash
npm run dev
```

This will start the server with hot reloading enabled.

### Development Tools

- **TypeScript**: The project uses TypeScript for type safety
- **ESLint**: For code linting
- **Prettier**: For code formatting
- **Nodemon**: For hot reloading during development
- **Jest**: For testing

Configure your IDE to use these tools for the best development experience.

## Project Structure

The project follows a modular structure:

```
socket-server/
├── src/                    # Source code
│   ├── server/             # Server implementation
│   │   ├── adapters/       # Adapters (Redis, etc.)
│   │   ├── api/            # HTTP API endpoints
│   │   ├── errors/         # Error handling
│   │   ├── handlers/       # Socket.IO event handlers
│   │   ├── middleware/     # Middleware functions
│   │   └── utils/          # Utility functions
│   ├── integration-tests/  # Integration tests
│   ├── load-tests/         # Load and performance tests
│   └── security-tests/     # Security tests
├── dashboard/              # Monitoring dashboard
├── docs/                   # Documentation
├── logs/                   # Log files
└── server/                 # Production server files
```

### Key Files

- `src/server/index.ts`: Main entry point
- `src/server/connection-manager.ts`: User connection management
- `src/server/room-manager.ts`: Room management
- `src/server/logger.ts`: Logging system
- `src/server/metrics.ts`: Metrics collection
- `src/server/routes.ts`: HTTP API routes
#
# Core Components

### Socket.IO Server

The Socket.IO server handles WebSocket connections and events.

```typescript
// Example: Initializing the Socket.IO server
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerHandlers } from './handlers';
import { authMiddleware } from './middleware/auth';

export function initializeSocketServer() {
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  });
  
  // Apply middleware
  io.use(authMiddleware);
  
  // Handle connections
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    registerHandlers(io, socket);
    
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
  
  return { httpServer, io };
}
```

### Connection Manager

The Connection Manager tracks active connections and maps socket IDs to user IDs.

```typescript
// Example: Connection Manager implementation
export class ConnectionManager {
  private connections: Map<string, Set<Socket>> = new Map();
  
  registerUser(socket: Socket, userId: string): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId).add(socket);
    socket.data.userId = userId;
  }
  
  removeUser(socket: Socket): void {
    const userId = socket.data.userId;
    if (userId && this.connections.has(userId)) {
      this.connections.get(userId).delete(socket);
      if (this.connections.get(userId).size === 0) {
        this.connections.delete(userId);
      }
    }
  }
  
  getUserId(socketId: string): string | null {
    // Implementation
  }
  
  getSocketsForUser(userId: string): Socket[] {
    // Implementation
  }
}
```

### Room Manager

The Room Manager handles room operations and membership.

```typescript
// Example: Room Manager implementation
export class RoomManager {
  private rooms: Map<string, Set<Socket>> = new Map();
  
  addToRoom(socket: Socket, room: string): void {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room).add(socket);
    socket.join(room);
  }
  
  removeFromRoom(socket: Socket, room: string): void {
    if (this.rooms.has(room)) {
      this.rooms.get(room).delete(socket);
      if (this.rooms.get(room).size === 0) {
        this.rooms.delete(room);
      }
    }
    socket.leave(room);
  }
  
  // Other methods
}
```

### Event Handlers

Event handlers process Socket.IO events.

```typescript
// Example: Base Handler
export abstract class BaseHandler {
  protected io: Server;
  protected socket: Socket;
  
  constructor(io: Server, socket: Socket) {
    this.io = io;
    this.socket = socket;
  }
  
  abstract registerHandlers(): void;
}

// Example: Client Handler
export class ClientHandler extends BaseHandler {
  registerHandlers(): void {
    this.socket.on('client:message', this.handleClientMessage.bind(this));
    // Register other handlers
  }
  
  private async handleClientMessage(data: any): Promise<void> {
    // Implementation
  }
}
```

### HTTP API

The HTTP API provides endpoints for backend integration.

```typescript
// Example: Push API
import express from 'express';
import { apiAuthMiddleware } from './middleware/api-auth';

export function setupPushApi(app: express.Application): void {
  app.post('/api/push', apiAuthMiddleware, async (req, res) => {
    try {
      const { userId, event, data } = req.body;
      
      // Validate request
      if (!userId || !event) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }
      
      // Forward message to user
      const delivered = await emitToUser(userId, event, data);
      
      res.json({
        success: true,
        delivered,
        userId
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
}
```

## Adding New Features

### Adding a New Event Handler

1. Create a new handler class in `src/server/handlers/`:

```typescript
// src/server/handlers/custom-handler.ts
import { Server, Socket } from 'socket.io';
import { BaseHandler } from './base-handler';

export class CustomHandler extends BaseHandler {
  registerHandlers(): void {
    this.socket.on('custom:event', this.handleCustomEvent.bind(this));
  }
  
  private async handleCustomEvent(data: any): Promise<void> {
    // Implement event handling
    this.socket.emit('custom:response', { success: true });
  }
}
```

2. Register the handler in `src/server/handlers/index.ts`:

```typescript
import { CustomHandler } from './custom-handler';

export function registerHandlers(io: Server, socket: Socket): void {
  // Register existing handlers
  new ClientHandler(io, socket).registerHandlers();
  new SystemHandler(io, socket).registerHandlers();
  
  // Register new handler
  new CustomHandler(io, socket).registerHandlers();
}
```

### Adding a New API Endpoint

1. Create a new controller in `src/server/api/`:

```typescript
// src/server/api/custom-controller.ts
import express from 'express';

export function setupCustomApi(app: express.Application): void {
  app.get('/api/custom', async (req, res) => {
    // Implement endpoint
    res.json({ success: true, data: 'Custom data' });
  });
}
```

2. Register the controller in `src/server/api/index.ts`:

```typescript
import { setupCustomApi } from './custom-controller';

export function setupApi(app: express.Application): void {
  // Register existing APIs
  setupPushApi(app);
  setupStatusApi(app);
  
  // Register new API
  setupCustomApi(app);
}
```## T
esting

The project uses Jest for testing and includes several types of tests:

### Unit Tests

Unit tests are located in `__tests__` directories next to the files they test.

```typescript
// Example: Connection Manager test
import { ConnectionManager } from '../connection-manager';

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockSocket: any;
  
  beforeEach(() => {
    connectionManager = new ConnectionManager();
    mockSocket = {
      id: 'socket-123',
      data: {},
      join: jest.fn(),
      leave: jest.fn()
    };
  });
  
  test('should register a user', () => {
    connectionManager.registerUser(mockSocket, 'user-123');
    expect(mockSocket.data.userId).toBe('user-123');
    expect(connectionManager.getUserId(mockSocket.id)).toBe('user-123');
  });
  
  test('should remove a user', () => {
    connectionManager.registerUser(mockSocket, 'user-123');
    connectionManager.removeUser(mockSocket);
    expect(connectionManager.getUserId(mockSocket.id)).toBeNull();
  });
});
```

To run unit tests:

```bash
npm run test
```

### Integration Tests

Integration tests are located in `src/integration-tests/` and test the interaction between components.

```typescript
// Example: API integration test
import request from 'supertest';
import { createApp } from '../server';

describe('Push API', () => {
  let app;
  
  beforeAll(async () => {
    app = await createApp();
  });
  
  test('should push message to user', async () => {
    const response = await request(app)
      .post('/api/push')
      .set('X-API-Key', process.env.API_KEY)
      .send({
        userId: 'user-123',
        event: 'test:event',
        data: { message: 'Hello' }
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

To run integration tests:

```bash
npm run test:integration
```

### Load Tests

Load tests are located in `src/load-tests/` and test the system under high load.

```typescript
// Example: Connection throughput test
import { createClient } from 'socket.io-client';

describe('Connection Throughput', () => {
  test('should handle 1000 concurrent connections', async () => {
    const clients = [];
    const connectionsPerSecond = 100;
    const totalConnections = 1000;
    
    for (let i = 0; i < totalConnections; i++) {
      const client = createClient('http://localhost:8081', {
        auth: { token: generateTestToken() }
      });
      clients.push(client);
      
      if (i % connectionsPerSecond === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Verify connections
    const connectedClients = clients.filter(client => client.connected);
    expect(connectedClients.length).toBeGreaterThanOrEqual(totalConnections * 0.95);
    
    // Clean up
    clients.forEach(client => client.disconnect());
  });
});
```

To run load tests:

```bash
npm run test:load
```

### Security Tests

Security tests are located in `src/security-tests/` and test the system's security features.

```typescript
// Example: Authentication test
describe('Authentication', () => {
  test('should reject connection with invalid token', async () => {
    const client = createClient('http://localhost:8081', {
      auth: { token: 'invalid-token' }
    });
    
    await new Promise<void>((resolve) => {
      client.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        resolve();
      });
    });
  });
});
```

To run security tests:

```bash
npm run test:security
```

## Contribution Guidelines

### Code Style

The project uses ESLint and Prettier for code style. Follow these guidelines:

- Use TypeScript for all new code
- Follow the existing code style
- Add JSDoc comments for public APIs
- Use meaningful variable and function names
- Keep functions small and focused

### Pull Request Process

1. Create a feature branch from `develop`
2. Make your changes
3. Ensure all tests pass
4. Update documentation as needed
5. Submit a pull request to `develop`

### Commit Message Format

Follow the conventional commits format:

```
type(scope): subject

body

footer
```

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Changes to the build process or tools

Example:

```
feat(api): add new push notification endpoint

- Add POST /api/push/notification endpoint
- Add validation middleware
- Update documentation

Closes #123
```

### Code Review Process

All pull requests require:
- Passing CI checks
- Code review by at least one team member
- Documentation updates if applicable
- Test coverage for new code

### Development Workflow

1. Pick an issue from the backlog
2. Create a feature branch
3. Implement the feature with tests
4. Submit a pull request
5. Address review feedback
6. Merge to develop
7. Periodically merge develop to main for releases