# Socket Server

A real-time communication middleware service based on Socket.IO, providing scalable WebSocket connection management and message delivery capabilities.

## Features

- Real-time bidirectional communication
- Horizontal scaling support (via Redis adapter)
- JWT authentication
- API key protected HTTP endpoints
- Comprehensive monitoring and metrics collection
- Built-in management dashboard
- High-performance message batching
- Automatic load balancing
- Comprehensive logging

## Tech Stack

- Node.js
- TypeScript
- Socket.IO
- Express
- Redis
- Prometheus (metrics)
- Next.js (dashboard)

## Inspiration

The inspiration for web3-socket came from the need to simplify real-time communication in Web3 applications. Traditional WebSocket implementations require complex backend handling, making it difficult for Go backend services to manage real-time features efficiently. We wanted to create a middleware solution that acts as a bridge between browser clients and backend services, reducing complexity while maintaining high performance and scalability.

## What it does

Web3-socket is a real-time communication middleware service that:

- **Handles WebSocket Connections**: Manages multiple client connections using Socket.IO protocol
- **User Authentication & Management**: Authenticates users via JWT tokens and manages connection states
- **Message Routing**: Routes messages between browser clients and Go backend services seamlessly
- **Room-based Broadcasting**: Supports efficient group messaging through room management
- **HTTP API Integration**: Provides REST endpoints for backend services to push messages to clients
- **Real-time Monitoring**: Includes a comprehensive dashboard for monitoring connections, metrics, and system health
- **Horizontal Scaling**: Supports multi-instance deployment with Redis adapter for high availability

## How we built it

We built web3-socket using a layered architecture approach:

1. **Core Technology Stack**: Built on Node.js with TypeScript for type safety, using Socket.IO for WebSocket handling and Express for HTTP APIs
2. **Modular Design**: Implemented separate layers for Socket.IO handling, core business logic, HTTP APIs, and event processing
3. **Redis Integration**: Added Redis adapter to enable horizontal scaling and shared state management across multiple instances
4. **Security Implementation**: Integrated JWT authentication for client connections and API key protection for HTTP endpoints
5. **Monitoring & Metrics**: Built comprehensive logging with Winston and metrics collection compatible with Prometheus
6. **Dashboard Development**: Created a Next.js-based monitoring dashboard for real-time system visualization
7. **Docker Optimization**: Implemented multi-stage Docker builds with Alpine Linux for minimal container size and security

## Challenges we ran into

- **Connection State Management**: Maintaining consistent user connection states across multiple server instances required careful Redis adapter implementation
- **Message Routing Complexity**: Ensuring reliable message delivery between clients and backend while handling connection failures and reconnections
- **Authentication Flow**: Implementing secure JWT-based authentication that works seamlessly with Socket.IO's connection lifecycle
- **Performance Optimization**: Balancing real-time responsiveness with system resource usage, especially under high connection loads
- **Error Handling**: Building resilient error handling that gracefully manages network failures, backend unavailability, and client disconnections
- **Horizontal Scaling**: Designing stateless architecture that maintains message consistency across distributed instances

## Accomplishments that we're proud of

- **High Performance**: Achieved efficient handling of thousands of concurrent WebSocket connections with minimal latency
- **Scalable Architecture**: Successfully implemented horizontal scaling with Redis adapter, supporting multi-instance deployments
- **Comprehensive Security**: Built robust authentication and authorization system with JWT tokens and API key protection
- **Developer Experience**: Created intuitive APIs and comprehensive documentation that makes integration straightforward
- **Production Ready**: Implemented complete monitoring, logging, and metrics collection suitable for production environments
- **Container Optimization**: Reduced Docker image size by 80% through Alpine Linux and multi-stage builds
- **Real-time Dashboard**: Built an interactive monitoring dashboard that provides instant visibility into system health

## What we learned

- **WebSocket Scaling Patterns**: Gained deep understanding of WebSocket connection management and scaling strategies using Redis pub/sub
- **Middleware Architecture**: Learned effective patterns for building middleware services that bridge different technology stacks
- **Performance Monitoring**: Discovered the importance of comprehensive metrics collection and real-time monitoring for distributed systems
- **Security Best Practices**: Implemented security-first design with proper authentication, input validation, and data protection
- **Docker Optimization**: Mastered container optimization techniques for production deployment efficiency
- **Event-Driven Design**: Applied event-driven architecture patterns for loose coupling and better maintainability
- **Load Testing**: Learned to use tools like Artillery for comprehensive load testing and performance validation

## What's next for web3-socket

- **Message Queue Integration**: Add support for Apache Kafka and RabbitMQ for enhanced message durability and processing
- **Advanced Analytics**: Implement real-time analytics dashboard with connection patterns, message flow visualization, and performance insights
- **Multi-Protocol Support**: Extend beyond Socket.IO to support WebRTC for peer-to-peer communication and other real-time protocols
- **Auto-Scaling**: Develop intelligent auto-scaling based on connection load and system metrics
- **Enhanced Security**: Add OAuth2 integration, rate limiting per user, and advanced threat detection
- **Plugin Architecture**: Create a plugin system for custom event handlers and middleware extensions
- **Cloud Native Features**: Add Kubernetes operators, service mesh integration, and cloud-native monitoring
- **GraphQL Subscriptions**: Support GraphQL subscription protocol for real-time data synchronization

## Quick Start

### Prerequisites

- Node.js 16.x or higher
- npm 7.x or higher
- Redis 6.x or higher (for multi-instance deployment)

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

3. Create environment configuration file:

```bash
cp .env.example .env
```

4. Edit the `.env` file and set the necessary configuration:

```
JWT_SECRET=your_jwt_secret_key_here
API_KEY=your_api_key_here
BACKEND_URL=http://your-backend-service-url
```

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Running Tests

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run load tests
npm run test:load

# Run security tests
npm run test:security

# Run all tests
npm run test:all
```

### Start Dashboard

```bash
npm run dashboard
```

## Docker Deployment

### Build Image

```bash
docker build -t socket-server .
```

### Run Container

```bash
docker run -d --name socket-server \
  -p 8081:8081 \
  -e NODE_ENV=production \
  -e PORT=8081 \
  -e BACKEND_URL=http://your-backend-url \
  -e JWT_SECRET=your-jwt-secret \
  -e API_KEY=your-api-key \
  socket-server
```

### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3'
services:
  socket-server:
    build: .
    ports:
      - "8081:8081"
      - "9090:9090"
    environment:
      - NODE_ENV=production
      - PORT=8081
      - BACKEND_URL=http://your-backend-url
      - JWT_SECRET=your-jwt-secret
      - API_KEY=your-api-key
      - REDIS_ENABLED=true
      - REDIS_HOST=redis
    restart: unless-stopped
    depends_on:
      - redis
  
  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

Run:

```bash
docker-compose up -d
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment (development, production, test) | `development` | No |
| `PORT` | HTTP and Socket.IO server port | `8081` | No |
| `BACKEND_URL` | Backend service URL | - | Yes |
| `JWT_SECRET` | JWT verification secret | - | Yes |
| `API_KEY` | API key for HTTP endpoints | - | Yes |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `*` | No |
| `LOG_LEVEL` | Log level (debug, info, warn, error) | `info` | No |
| `REDIS_ENABLED` | Enable Redis adapter | `false` | No |
| `REDIS_HOST` | Redis host | `localhost` | No* |
| `REDIS_PORT` | Redis port | `6379` | No* |

*Required for multi-instance deployment

For more configuration options, refer to the `.env.example` file.

## Horizontal Scaling

Socket Server supports horizontal scaling through Redis adapter:

1. Ensure Redis is installed and running
2. Configure Redis connection in environment variables:

```
REDIS_ENABLED=true
REDIS_HOST=your-redis-host
REDIS_PORT=6379
```

3. Deploy multiple service instances
4. Configure load balancer (with WebSocket and sticky session support)

## API Documentation

### WebSocket Connection

Client connection example:

```javascript
import { io } from "socket.io-client";

const socket = io("http://your-server:3000", {
  auth: {
    token: "your-jwt-token"
  }
});

socket.on("connect", () => {
  console.log("Connected to Socket.IO server");
});

socket.on("message", (data) => {
  console.log("Received message:", data);
});

socket.emit("send_message", {
  recipient: "user-123",
  content: "Hello, world!"
});
```

### HTTP API Endpoints

All HTTP API requests require an API key:

```
X-API-Key: your-api-key
```

#### Get Server Status

```
GET /api/status
```

#### Get Connection Statistics

```
GET /api/stats/connections
```

#### Send Message to Specific User

```
POST /api/message
Content-Type: application/json

{
  "userId": "user-123",
  "event": "notification",
  "data": {
    "message": "Hello from API"
  }
}
```

## Monitoring

### Health Check

The server provides a health check endpoint: `/health`

### Prometheus Metrics

Prometheus metrics are available at the `/metrics` endpoint.

Key metrics:

- `socket_connections_total`: Total connections
- `socket_connections_active`: Current active connections
- `socket_messages_sent_total`: Total messages sent
- `socket_messages_received_total`: Total messages received
- `socket_errors_total`: Total errors

### Log Management

Log configuration:

```
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_DIR=logs
LOG_MAX_SIZE=10m
LOG_MAX_FILES=7
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.