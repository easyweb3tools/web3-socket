# Horizontal Scaling Guide

This document provides detailed information on how to horizontally scale the Socket Server for high availability and performance.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Redis Adapter Configuration](#redis-adapter-configuration)
- [Load Balancer Setup](#load-balancer-setup)
- [Instance Management](#instance-management)
- [Monitoring Scaled Deployments](#monitoring-scaled-deployments)
- [Performance Considerations](#performance-considerations)

## Overview

The Socket Server is designed to scale horizontally across multiple instances to handle increased load and provide high availability. This is achieved through:

1. Stateless design principles
2. Redis adapter for cross-instance communication
3. Load balancing with sticky sessions
4. Shared authentication and authorization

## Prerequisites

Before scaling the Socket Server, ensure you have:

- Redis server (v6.0+) for the Socket.IO adapter
- Load balancer that supports WebSockets and sticky sessions
- Monitoring system for tracking instance health
- Shared configuration management

## Redis Adapter Configuration

The Redis adapter enables communication between Socket.IO instances, allowing events to be broadcast across all connected clients regardless of which instance they're connected to.

### Installation

```bash
npm install @socket.io/redis-adapter redis
```

### Configuration

In your server initialization code:

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

// Create Redis clients
const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

// Wait for Redis clients to connect
await Promise.all([pubClient.connect(), subClient.connect()]);

// Create Socket.IO server with Redis adapter
const io = new Server(httpServer, {
  adapter: createAdapter(pubClient, subClient, {
    key: process.env.REDIS_PREFIX || 'socket-io'
  })
});
```

### Environment Variables

Set these environment variables for each instance:

```
REDIS_URL=redis://your-redis-server:6379
REDIS_PREFIX=socket-io
```## Lo
ad Balancer Setup

A properly configured load balancer is essential for distributing client connections across multiple Socket Server instances.

### Requirements

- WebSocket protocol support
- Sticky sessions (session affinity)
- Health check endpoints
- Proper timeout configuration

### NGINX Configuration

```nginx
upstream socket_servers {
    ip_hash;  # Enable sticky sessions based on client IP
    server socket-server-1:8081;
    server socket-server-2:8081;
    server socket-server-3:8081;
}

server {
    listen 80;
    server_name socket.example.com;

    location / {
        proxy_pass http://socket_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    location /health {
        proxy_pass http://socket_servers;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### AWS Application Load Balancer

When using AWS Application Load Balancer:

1. Create a target group:
   - Protocol: HTTP
   - Port: 8081 (or your server port)
   - Health check path: `/health`
   - Health check interval: 30 seconds
   - Healthy threshold: 2
   - Unhealthy threshold: 2

2. Configure sticky sessions:
   - Enable stickiness
   - Type: Application-based cookie
   - Cookie name: `io` (Socket.IO default)
   - Duration: 1 day

3. Configure listener:
   - Protocol: HTTP/HTTPS
   - Port: 80/443
   - Forward to target group

### Google Cloud Load Balancer

For Google Cloud Load Balancer:

1. Create a backend service:
   - Protocol: HTTP
   - Named port: http
   - Timeout: 60s
   - Session affinity: GENERATED_COOKIE
   - Affinity cookie TTL: 86400 (1 day)

2. Configure health check:
   - Protocol: HTTP
   - Port: 8081
   - Request path: `/health`
   - Check interval: 30s
   - Timeout: 5s
   - Healthy threshold: 2
   - Unhealthy threshold: 2

## Instance Management

### Instance Identification

Each Socket Server instance should have a unique identifier. This helps with debugging and monitoring.

```typescript
import { randomUUID } from 'crypto';

// Generate instance ID on startup
const instanceId = process.env.INSTANCE_ID || `instance-${randomUUID().substring(0, 8)}`;

// Log instance ID on startup
logger.info(`Starting Socket Server instance ${instanceId}`);

// Include instance ID in metrics
metricsCollector.setGauge('instance_info', 1, { instanceId });
```

### Graceful Shutdown

Implement graceful shutdown to ensure clients can reconnect to other instances:

```typescript
async function gracefulShutdown() {
  logger.info('Received shutdown signal, starting graceful shutdown');
  
  // Stop accepting new connections
  io.disconnectSockets();
  
  // Wait for existing connections to close (with timeout)
  const timeout = setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(0);
  }, 10000);
  
  // Close Redis adapter connections
  await Promise.all([
    pubClient.quit(),
    subClient.quit()
  ]);
  
  // Close HTTP server
  httpServer.close(() => {
    clearTimeout(timeout);
    logger.info('Graceful shutdown completed');
    process.exit(0);
  });
}

// Register shutdown handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```## Monit
oring Scaled Deployments

Monitoring becomes even more critical in a multi-instance environment.

### Instance-Specific Metrics

Add instance ID as a label to all metrics:

```typescript
// Initialize metrics with instance ID
export function initializeMetrics() {
  const registry = new Registry();
  
  // Add instance label to all metrics
  registry.setDefaultLabels({
    instance: instanceId,
    environment: process.env.NODE_ENV
  });
  
  // Create metrics
  const connectionsGauge = new Gauge({
    name: 'socket_connections_active',
    help: 'Number of active socket connections',
    registers: [registry]
  });
  
  // Other metrics...
  
  return {
    registry,
    connectionsGauge,
    // Other metrics...
  };
}
```

### Aggregated Metrics

Set up a Prometheus server to scrape and aggregate metrics from all instances:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'socket-server'
    scrape_interval: 15s
    dns_sd_configs:
      - names:
          - 'socket-server'
        type: 'A'
        port: 8081
```

### Centralized Logging

Configure all instances to send logs to a central logging service:

```typescript
// Winston configuration with centralized logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'socket-server',
    instanceId
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/server.log' }),
    // Add transport for centralized logging (e.g., Elasticsearch, Logstash)
    new ElasticsearchTransport({
      level: 'info',
      clientOpts: { node: process.env.ELASTICSEARCH_URL }
    })
  ]
});
```

## Performance Considerations

### Connection Distribution

Monitor connection distribution across instances to ensure balanced load:

```typescript
// Report connection count periodically
setInterval(() => {
  const connectionCount = io.engine.clientsCount;
  logger.info(`Active connections: ${connectionCount}`, { instanceId });
  metricsCollector.setGauge('socket_connections_active', connectionCount);
}, 60000);
```

### Memory Management

Each Socket.IO connection consumes memory. Monitor and manage memory usage:

```typescript
// Report memory usage periodically
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  logger.info('Memory usage', { 
    instanceId,
    rss: memoryUsage.rss,
    heapTotal: memoryUsage.heapTotal,
    heapUsed: memoryUsage.heapUsed
  });
  
  metricsCollector.setGauge('memory_usage_rss', memoryUsage.rss);
  metricsCollector.setGauge('memory_usage_heap_total', memoryUsage.heapTotal);
  metricsCollector.setGauge('memory_usage_heap_used', memoryUsage.heapUsed);
  
  // Implement memory-based load shedding if needed
  if (memoryUsage.heapUsed > 0.9 * memoryUsage.heapTotal) {
    logger.warn('Memory pressure detected, activating load shedding');
    // Implement load shedding strategy
  }
}, 60000);
```

### Redis Performance

Redis becomes a critical component in a scaled deployment. Monitor Redis performance:

```typescript
// Monitor Redis adapter performance
pubClient.on('error', (err) => {
  logger.error('Redis pub client error', { error: err.message, instanceId });
  metricsCollector.incrementCounter('redis_errors_total');
});

subClient.on('error', (err) => {
  logger.error('Redis sub client error', { error: err.message, instanceId });
  metricsCollector.incrementCounter('redis_errors_total');
});

// Track Redis operations
const redisCommandStartTime = new Map();

pubClient.on('command', (cmd) => {
  redisCommandStartTime.set(cmd.id, Date.now());
});

pubClient.on('commandResponse', (cmd) => {
  const startTime = redisCommandStartTime.get(cmd.id);
  if (startTime) {
    const duration = Date.now() - startTime;
    metricsCollector.observeHistogram('redis_command_duration_ms', duration, {
      command: cmd.name
    });
    redisCommandStartTime.delete(cmd.id);
  }
});
```

## Advanced Scaling Techniques

### Dynamic Scaling

Implement auto-scaling based on metrics:

1. Monitor connection count and system load
2. Set thresholds for scaling up/down
3. Use cloud provider auto-scaling features or custom scripts

Example AWS Auto Scaling configuration:

```json
{
  "AutoScalingGroupName": "socket-server-asg",
  "MinSize": 2,
  "MaxSize": 10,
  "DesiredCapacity": 2,
  "HealthCheckType": "ELB",
  "HealthCheckGracePeriod": 300,
  "VPCZoneIdentifier": "subnet-12345678,subnet-87654321",
  "LaunchTemplate": {
    "LaunchTemplateId": "lt-12345678",
    "Version": "$Latest"
  },
  "TargetGroupARNs": [
    "arn:aws:elasticloadbalancing:region:account-id:targetgroup/socket-server/12345678"
  ],
  "Tags": [
    {
      "Key": "Name",
      "Value": "socket-server",
      "PropagateAtLaunch": true
    }
  ]
}
```

### Connection Draining

Implement connection draining for smooth instance replacement:

1. Instance receives termination signal
2. Stop accepting new connections
3. Notify connected clients to reconnect
4. Wait for graceful disconnection or timeout
5. Terminate instance

```typescript
async function drainConnections() {
  logger.info('Starting connection draining');
  
  // Set instance status to draining
  metricsCollector.setGauge('instance_draining', 1);
  
  // Notify all clients to reconnect to another instance
  io.emit('server:maintenance', { 
    message: 'Server maintenance, please reconnect',
    code: 'SERVER_DRAINING'
  });
  
  // Wait for clients to disconnect (with timeout)
  const startTime = Date.now();
  const maxWaitTime = 30000; // 30 seconds
  
  while (io.engine.clientsCount > 0 && (Date.now() - startTime) < maxWaitTime) {
    logger.info(`Waiting for ${io.engine.clientsCount} clients to disconnect`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Proceed with shutdown
  gracefulShutdown();
}
```

### Sharding

For very large deployments, implement sharding to distribute load:

1. Divide users into shards based on user ID or other criteria
2. Route users to specific instance groups
3. Use Redis pub/sub for cross-shard communication

```typescript
// Example sharding logic
function determineUserShard(userId: string): number {
  // Simple hash-based sharding
  const hash = createHash('md5').update(userId).digest('hex');
  const hashValue = parseInt(hash.substring(0, 8), 16);
  return hashValue % TOTAL_SHARDS;
}

// On connection, check if user belongs to this shard
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const userId = verifyToken(token).userId;
  const userShard = determineUserShard(userId);
  
  if (userShard === INSTANCE_SHARD) {
    next();
  } else {
    next(new Error(`Please connect to shard ${userShard}`));
  }
});
```