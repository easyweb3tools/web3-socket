# Socket Server Architecture Documentation

This document provides a comprehensive overview of the Socket Server architecture, components, and design patterns.

## Table of Contents

- [System Overview](#system-overview)
- [Architecture Diagram](#architecture-diagram)
- [Key Components](#key-components)
- [Data Flow](#data-flow)
- [Design Patterns](#design-patterns)
- [Component Interactions](#component-interactions)
- [Technology Stack](#technology-stack)
- [Security Architecture](#security-architecture)
- [Scalability Design](#scalability-design)

## System Overview

The Socket Server is a real-time communication middleware service that acts as an intermediary layer between browser clients and the Go backend service. It handles WebSocket connections using Socket.IO, manages user connections, routes messages, and provides a monitoring dashboard.

The primary goals of the Socket Server are:

1. Handle WebSocket connections from browser clients
2. Manage user authentication and connection state
3. Route messages between clients and the backend
4. Provide room-based message broadcasting
5. Expose HTTP APIs for backend integration
6. Monitor system health and performance
7. Support horizontal scaling for high availability

## Architecture Diagram

The Socket Server follows a layered architecture with clear separation of concerns:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Browser Clients │◄───►│  Socket.IO Layer│◄───►│  Event Handlers │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                        ┌────────▼────────┐
                        │ Core Service    │
                        │ Layer           │
                        └────────┬────────┘
                                 │
┌─────────────────┐     ┌────────▼────────┐     ┌─────────────────┐
│  Go Backend     │◄───►│  HTTP API Layer │◄───►│  Push API       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ▲                                               ▲
        │                                               │
        │                                               │
        │         ┌─────────────────┐                   │
        └─────────┤  Dashboard      ├───────────────────┘
                  └────────┬────────┘
                           │
                  ┌────────▼────────┐     ┌─────────────────┐
                  │ Metrics & Logs  │◄───►│  Redis Adapter  │
                  └─────────────────┘     └─────────────────┘
```

## Key Components

### 1. Socket.IO Layer

**Responsibilities:**
- Accept and manage WebSocket connections
- Handle Socket.IO protocol
- Manage connection lifecycle events
- Route events to appropriate handlers

**Key Classes:**
- `SocketServer`: Main server class that initializes Socket.IO
- `SocketMiddleware`: Authentication and validation middleware

### 2. Core Service Layer

**Responsibilities:**
- Implement business logic
- Manage user connections and rooms
- Handle message routing
- Coordinate between Socket.IO and HTTP layers

**Key Classes:**
- `ConnectionManager`: Tracks user connections and socket mappings
- `RoomManager`: Manages room memberships and broadcasting
- `MessageRouter`: Routes messages between clients and backend

### 3. HTTP API Layer

**Responsibilities:**
- Expose REST endpoints for backend integration
- Handle push message requests
- Provide status and health endpoints
- Implement API authentication and validation

**Key Classes:**
- `ApiServer`: Express server for HTTP endpoints
- `PushController`: Handles push message requests
- `StatusController`: Provides system status information

### 4. Event Handlers

**Responsibilities:**
- Process Socket.IO events
- Implement event-specific business logic
- Forward events to backend when needed
- Send responses back to clients

**Key Classes:**
- `BaseHandler`: Abstract base class for all handlers
- `ClientHandler`: Handles client-to-server events
- `SystemHandler`: Handles system events (connect, disconnect)
- `HandlerRegistry`: Registers and manages handlers

### 5. Dashboard

**Responsibilities:**
- Provide web UI for monitoring
- Display connection statistics
- Show room memberships
- Visualize metrics and logs

**Key Classes:**
- `DashboardServer`: Next.js server for dashboard
- `ConnectionsComponent`: Displays active connections
- `LogViewerComponent`: Shows system logs
- `MetricsComponent`: Visualizes system metrics

### 6. Metrics & Logging

**Responsibilities:**
- Record system events and errors
- Track performance metrics
- Expose metrics in Prometheus format
- Manage log rotation and storage

**Key Classes:**
- `Logger`: Centralized logging service
- `MetricsCollector`: Collects and exposes metrics
- `PerformanceMonitor`: Tracks system performance

### 7. Redis Adapter

**Responsibilities:**
- Enable multi-instance communication
- Share connection state across instances
- Support room-based broadcasting in clustered environment
- Maintain consistent message delivery

**Key Classes:**
- `RedisAdapter`: Socket.IO Redis adapter implementation
- `StateManager`: Manages shared state across instances

## Data Flow

### 1. Client Connection Flow

```
1. Client initiates WebSocket connection
2. Socket.IO server accepts connection
3. Authentication middleware validates JWT token
4. ConnectionManager registers the socket
5. System event handler sends welcome message
6. Client sends registration event with user ID
7. ConnectionManager associates socket with user ID
8. RoomManager adds user to user-specific room
9. Client is now ready to send/receive messages
```

### 2. Message Flow: Client to Backend

```
1. Client sends event to Socket.IO server
2. Event handler receives the event
3. Validation middleware validates message format
4. MessageRouter forwards message to Go backend via HTTP
5. Backend processes the message
6. Backend sends response via HTTP API
7. MessageRouter routes response back to client
8. Client receives the response
```

### 3. Message Flow: Backend to Client

```
1. Backend sends HTTP request to Push API
2. PushController validates the request
3. MessageRouter identifies target user(s)
4. ConnectionManager finds socket(s) for user(s)
5. Socket.IO server emits event to target socket(s)
6. Client receives the message
7. PushController sends success response to backend
```

### 4. Room Broadcasting Flow

```
1. Backend sends HTTP request to Room API
2. RoomController validates the request
3. RoomManager identifies target room
4. Socket.IO server broadcasts to room
5. All clients in room receive the message
6. RoomController sends success response with recipient count
```

## Design Patterns

### 1. Singleton Pattern

Used for services that should have only one instance:
- ConnectionManager
- RoomManager
- Logger
- MetricsCollector

### 2. Factory Pattern

Used for creating handlers and adapters:
- HandlerFactory
- AdapterFactory

### 3. Observer Pattern

Used for event-based communication:
- Socket.IO events
- System event notifications

### 4. Strategy Pattern

Used for different implementation strategies:
- Authentication strategies
- Message routing strategies
- Reconnection strategies

### 5. Middleware Pattern

Used for request/event processing:
- Authentication middleware
- Validation middleware
- Rate limiting middleware
- Logging middleware

### 6. Repository Pattern

Used for data access abstraction:
- User repository
- Room repository
- Message repository

## Component Interactions

### ConnectionManager and RoomManager

The ConnectionManager and RoomManager work closely together:
- When a user connects, ConnectionManager registers the socket
- ConnectionManager notifies RoomManager to add user to default room
- When a user disconnects, ConnectionManager notifies RoomManager to remove from all rooms

### EventHandlers and MessageRouter

Event handlers use the MessageRouter to forward messages:
- Client event handler receives client message
- Handler validates message format
- Handler calls MessageRouter to forward to backend
- MessageRouter sends HTTP request to backend
- MessageRouter receives response and passes back to handler
- Handler emits response to client

### HTTP API and Socket.IO Layer

The HTTP API interacts with Socket.IO for push messages:
- Backend sends push request to HTTP API
- API controller validates request
- Controller uses Socket.IO server to emit event to target
- Controller returns success/failure to backend

## Technology Stack

### Core Technologies

- **Node.js**: Runtime environment
- **TypeScript**: Programming language
- **Socket.IO**: WebSocket library
- **Express**: HTTP server framework
- **Redis**: For multi-instance communication
- **Next.js**: Dashboard framework
- **Prometheus**: Metrics collection

### Supporting Libraries

- **Winston**: Logging framework
- **Pino**: High-performance logging
- **JWT**: Authentication tokens
- **Jest**: Testing framework
- **Supertest**: HTTP testing
- **Artillery**: Load testing
- **Docker**: Containerization
- **PM2**: Process management

## Security Architecture

### Authentication

1. **Socket.IO Authentication**:
   - JWT-based authentication
   - Token verification on connection
   - User ID validation during registration

2. **HTTP API Authentication**:
   - API key authentication
   - Request signing for sensitive endpoints
   - Rate limiting to prevent abuse

### Authorization

1. **User Authorization**:
   - Room-based access control
   - User-specific permissions
   - Event-based authorization

2. **API Authorization**:
   - Role-based access for admin endpoints
   - Scope-based permissions for API keys

### Data Protection

1. **Sensitive Data Handling**:
   - PII redaction in logs
   - Secure storage of credentials
   - Data encryption for sensitive fields

2. **Input Validation**:
   - Schema validation for all inputs
   - Sanitization to prevent injection
   - Rate limiting for protection against DoS

## Scalability Design

### Horizontal Scaling

The Socket Server supports horizontal scaling through:
1. **Redis Adapter**: Enables communication between instances
2. **Stateless Design**: No instance-specific state
3. **Shared Authentication**: Consistent auth across instances

### Load Distribution

1. **Load Balancer Configuration**:
   - Sticky sessions for WebSocket connections
   - Health checks for instance availability
   - Even distribution of new connections

2. **Instance Management**:
   - Dynamic scaling based on connection count
   - Graceful shutdown for instance replacement
   - Connection migration between instances

### Performance Optimization

1. **Message Batching**:
   - Combines multiple messages into batches
   - Reduces network overhead
   - Optimizes throughput

2. **Connection Pooling**:
   - Reuses HTTP connections to backend
   - Reduces connection establishment overhead
   - Improves response time

3. **Event Loop Optimization**:
   - Monitors event loop lag
   - Offloads CPU-intensive tasks
   - Ensures responsive message handling