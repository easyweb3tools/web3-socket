# Socket.IO Server API Documentation

This document provides comprehensive documentation for the Socket.IO server API, including both WebSocket events and HTTP endpoints.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [WebSocket Events](#websocket-events)
  - [Client-to-Server Events](#client-to-server-events)
  - [Server-to-Client Events](#server-to-client-events)
  - [System Events](#system-events)
- [HTTP API](#http-api)
  - [Authentication](#http-authentication)
  - [Push API](#push-api)
  - [Broadcast API](#broadcast-api)
  - [Room API](#room-api)
  - [Status API](#status-api)
  - [Health API](#health-api)
  - [Metrics API](#metrics-api)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

## Overview

The Socket.IO server provides real-time communication capabilities through WebSocket connections and HTTP APIs. It supports:

- Real-time bidirectional event-based communication
- Authentication and authorization
- Room-based messaging
- Push notifications
- Horizontal scaling
- Monitoring and metrics

## Authentication

### WebSocket Authentication

Socket.IO connections require authentication using JSON Web Tokens (JWT). The token should be provided in the `auth` object when establishing the connection:

```javascript
const socket = io('http://your-server-url', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

The JWT token should be signed with the server's secret key and include the following claims:

- `userId`: The unique identifier for the user
- `exp`: Expiration time (standard JWT claim)
- `iat`: Issued at time (standard JWT claim)

After connecting, the client must register with the server by emitting a `register` event:

```javascript
socket.emit('register', { userId: 'user-123' });
```

The server will respond with a `register:ack` event:

```javascript
socket.on('register:ack', (data) => {
  if (data.success) {
    console.log('Registration successful');
  } else {
    console.error('Registration failed:', data.error);
  }
});
```

### HTTP Authentication

HTTP API endpoints require an API key for authentication. The key should be provided in the `X-API-Key` header:

```
X-API-Key: your-api-key
```

For endpoints that require request signing, the following headers are also required:

```
X-Request-Timestamp: 1625097600000
X-Request-Nonce: abc123
X-Signature-Version: v1
X-Signature: computed-signature
```

The signature is computed as follows:

```
HMAC-SHA256(API_KEY, METHOD + PATH + TIMESTAMP + NONCE)
```

Where:
- `METHOD` is the HTTP method (e.g., `GET`, `POST`)
- `PATH` is the request path (e.g., `/api/status`)
- `TIMESTAMP` is the request timestamp in milliseconds
- `NONCE` is a unique string for each request

## WebSocket Events

### Client-to-Server Events

#### `register`

Register a user with the server.

**Parameters:**
```json
{
  "userId": "string"
}
```

**Response Event:** `register:ack`
```json
{
  "success": true,
  "userId": "string"
}
```

Or in case of error:
```json
{
  "success": false,
  "error": "Error message"
}
```

#### `client:event`

Send a generic event to the server.

**Parameters:**
```json
{
  "type": "string",
  "data": {
    // Any JSON object
  }
}
```

**Response Event:** `server:response`
```json
{
  "success": true,
  "requestId": "string",
  "data": {
    // Response data
  }
}
```

#### `client:message`

Send a message to the server.

**Parameters:**
```json
{
  "content": "string",
  "type": "string",
  "metadata": {
    // Optional metadata
  }
}
```

**Response Event:** `message:ack`
```json
{
  "success": true,
  "requestId": "string",
  "messageId": "string"
}
```

#### `client:action`

Perform an action on the server.

**Parameters:**
```json
{
  "action": "string",
  "params": {
    // Action parameters
  }
}
```

**Response Event:** `action:result`
```json
{
  "success": true,
  "requestId": "string",
  "result": {
    // Action result
  }
}
```

#### `room:join`

Join a room.

**Parameters:**
```json
{
  "room": "string"
}
```

**Response Event:** `room:join:ack`
```json
{
  "success": true,
  "room": "string"
}
```

#### `room:leave`

Leave a room.

**Parameters:**
```json
{
  "room": "string"
}
```

**Response Event:** `room:leave:ack`
```json
{
  "success": true,
  "room": "string"
}
```

#### `ping`

Send a ping to measure latency.

**Parameters:**
```json
{
  "timestamp": 1625097600000
}
```

**Response:** Acknowledgement callback with no data

### Server-to-Client Events

#### `server:response`

Response to a client event.

**Data:**
```json
{
  "success": true,
  "requestId": "string",
  "data": {
    // Response data
  }
}
```

#### `message:ack`

Acknowledgement of a client message.

**Data:**
```json
{
  "success": true,
  "requestId": "string",
  "messageId": "string"
}
```

#### `action:result`

Result of a client action.

**Data:**
```json
{
  "success": true,
  "requestId": "string",
  "result": {
    // Action result
  }
}
```

#### `room:join:ack`

Acknowledgement of joining a room.

**Data:**
```json
{
  "success": true,
  "room": "string"
}
```

#### `room:leave:ack`

Acknowledgement of leaving a room.

**Data:**
```json
{
  "success": true,
  "room": "string"
}
```

#### `error`

Error notification.

**Data:**
```json
{
  "event": "string",
  "message": "string",
  "code": "string"
}
```

### System Events

#### `system:welcome`

Sent when a client connects to the server.

**Data:**
```json
{
  "message": "Welcome to the Socket.IO server",
  "socketId": "string",
  "timestamp": "ISO date string",
  "serverInfo": {
    "version": "string",
    "environment": "string"
  }
}
```

#### `system:notification`

System notification for a user.

**Data:**
```json
{
  "title": "string",
  "message": "string",
  "type": "info|warning|error",
  "timestamp": "ISO date string"
}
```

#### `system:reconnect_status`

Status update during reconnection attempts.

**Data:**
```json
{
  "attempt": 1,
  "delay": 1000,
  "timestamp": "ISO date string"
}
```

#### `system:state_recovered`

Notification that the client state has been recovered after reconnection.

**Data:**
```json
{
  "userId": "string",
  "timestamp": "ISO date string"
}
```

#### `system:state_recovery_failed`

Notification that the client state could not be recovered after reconnection.

**Data:**
```json
{
  "message": "Failed to recover connection state",
  "timestamp": "ISO date string"
}
```

## HTTP API

### HTTP Authentication

All HTTP API endpoints require authentication using an API key. The key should be provided in the `X-API-Key` header:

```
X-API-Key: your-api-key
```

### Push API

#### `POST /api/push`

Send a push message to a specific user.

**Request:**
```json
{
  "userId": "string",
  "event": "string",
  "data": {
    // Any JSON object
  }
}
```

**Response:**
```json
{
  "success": true,
  "delivered": true,
  "timestamp": "ISO date string"
}
```

### Broadcast API

#### `POST /api/broadcast`

Broadcast a message to all connected clients.

**Request:**
```json
{
  "event": "string",
  "data": {
    // Any JSON object
  }
}
```

**Response:**
```json
{
  "success": true,
  "recipients": 42,
  "timestamp": "ISO date string"
}
```

### Room API

#### `POST /api/room`

Send a message to all clients in a room.

**Request:**
```json
{
  "room": "string",
  "event": "string",
  "data": {
    // Any JSON object
  }
}
```

**Response:**
```json
{
  "success": true,
  "recipients": 10,
  "timestamp": "ISO date string"
}
```

### Status API

#### `GET /api/status`

Get the server status.

**Response:**
```json
{
  "success": true,
  "status": "ok",
  "connections": 42,
  "rooms": 10,
  "uptime": 3600,
  "memory": {
    "rss": 123456789,
    "heapTotal": 123456789,
    "heapUsed": 123456789,
    "external": 123456789
  },
  "timestamp": "ISO date string"
}
```

### Health API

#### `GET /health`

Get the server health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "ISO date string"
}
```

### Metrics API

#### `GET /metrics`

Get server metrics in Prometheus format.

**Response:**
```
# HELP socket_server_active_connections Number of active socket connections
# TYPE socket_server_active_connections gauge
socket_server_active_connections 42

# HELP socket_server_connections_total Total number of connections
# TYPE socket_server_connections_total counter
socket_server_connections_total{authenticated="true",transport="websocket"} 100
socket_server_connections_total{authenticated="false",transport="websocket"} 10

# ... more metrics
```

## Error Handling

### WebSocket Errors

Errors are sent to the client using the `error` event:

```json
{
  "event": "client:message",
  "message": "Invalid message data. Missing content.",
  "code": "INVALID_MESSAGE_DATA"
}
```

### HTTP Errors

HTTP errors are returned with appropriate status codes and a JSON response:

```json
{
  "success": false,
  "error": "Invalid API key",
  "code": "INVALID_API_KEY",
  "requestId": "string"
}
```

Common error codes:

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 400 | INVALID_REQUEST | Invalid request format or parameters |
| 401 | UNAUTHORIZED | Authentication failed |
| 403 | FORBIDDEN | Authorization failed |
| 404 | NOT_FOUND | Resource not found |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_SERVER_ERROR | Internal server error |

## Rate Limiting

The server implements rate limiting to prevent abuse. Rate limits are applied per API key and IP address.

Default rate limits:

- WebSocket connections: 100 per minute per IP
- WebSocket messages: 1000 per minute per connection
- HTTP API requests: 100 per minute per API key

When a rate limit is exceeded, the server responds with a 429 status code and a JSON error message:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMITED",
  "retryAfter": 60
}
```

The `retryAfter` field indicates the number of seconds to wait before retrying the request.