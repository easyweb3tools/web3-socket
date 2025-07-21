# Socket Server Deployment Guide

This document provides comprehensive instructions for deploying, configuring, and scaling the Socket.IO server.

## Table of Contents

- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Standard Installation](#standard-installation)
  - [Docker Installation](#docker-installation)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Security Configuration](#security-configuration)
  - [Logging Configuration](#logging-configuration)
  - [Metrics Configuration](#metrics-configuration)
- [Scaling Options](#scaling-options)
  - [Horizontal Scaling](#horizontal-scaling)
  - [Redis Adapter Setup](#redis-adapter-setup)
  - [Load Balancer Configuration](#load-balancer-configuration)
- [Monitoring](#monitoring)
  - [Health Checks](#health-checks)
  - [Metrics Integration](#metrics-integration)
  - [Log Management](#log-management)
- [Troubleshooting](#troubleshooting)
  - [Common Issues](#common-issues)
  - [Debugging Techniques](#debugging-techniques)
  - [Performance Optimization](#performance-optimization)

## Installation

### Prerequisites

Before installing the Socket Server, ensure you have the following prerequisites:

- Node.js 16.x or higher
- npm 7.x or higher
- Redis 6.x or higher (for multi-instance deployments)
- Access to the Go backend service

### Standard Installation

1. Clone the repository:

```bash
git clone https://github.com/your-org/socket-server.git
cd socket-server
```

2. Install dependencies:

```bash
npm install --production
```

3. Create a `.env` file based on the example:

```bash
cp .env.example .env
```

4. Edit the `.env` file with your configuration values.

5. Start the server:

```bash
npm start
```

### Docker Installation

1. Build the Docker image:

```bash
docker build -t socket-server .
```

2. Run the container:

```bash
docker run -d --name socket-server \
  -p 8081:8081 \
  -e NODE_ENV=production \
  -e PORT=8081 \
  -e BACKEND_URL=http://your-backend-url \
  -e JWT_SECRET=your-jwt-secret \
  socket-server
```

Alternatively, use Docker Compose:

```yaml
# docker-compose.yml
version: '3'
services:
  socket-server:
    build: .
    ports:
      - "8081:8081"
    environment:
      - NODE_ENV=production
      - PORT=8081
      - BACKEND_URL=http://your-backend-url
      - JWT_SECRET=your-jwt-secret
    restart: unless-stopped
  
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

Run with:

```bash
docker-compose up -d
```

## Configuration

### Environment Variables

The Socket Server uses environment variables for configuration. Here are the available options:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment (development, production, test) | `development` | No |
| `PORT` | HTTP and Socket.IO server port | `8081` | No |
| `BACKEND_URL` | URL of the Go backend service | - | Yes |
| `JWT_SECRET` | Secret key for JWT verification | - | Yes |
| `API_KEY` | API key for HTTP endpoints | - | Yes |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `*` | No |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` | No |
| `LOG_FILE` | Path to log file | `logs/server.log` | No |
| `REDIS_URL` | Redis connection URL for adapter | - | No* |
| `MAX_CONNECTIONS` | Maximum allowed connections | `10000` | No |
| `METRICS_ENABLED` | Enable Prometheus metrics | `true` | No |
| `DASHBOARD_ENABLED` | Enable monitoring dashboard | `true` | No |
| `DASHBOARD_AUTH_USER` | Dashboard basic auth username | - | No |
| `DASHBOARD_AUTH_PASS` | Dashboard basic auth password | - | No |

*Required for multi-instance deployments

### Security Configuration

#### JWT Authentication

The server uses JWT for authenticating Socket.IO connections. Configure the JWT secret in the environment variables:

```
JWT_SECRET=your-secure-jwt-secret
```

The JWT token should contain at minimum:

```json
{
  "userId": "user-123",
  "exp": 1609459200
}
```

#### API Authentication

HTTP API endpoints are secured with an API key. Set this in the environment:

```
API_KEY=your-secure-api-key
```

Include this key in all HTTP requests to the API:

```
X-API-Key: your-secure-api-key
```

For endpoints requiring request signing, include:

```
X-Request-Timestamp: current-timestamp
X-Request-Nonce: unique-nonce
X-Signature-Version: v1
X-Signature: request-signature
```

The signature is calculated as:

```
signature = HMAC-SHA256(apiKey, method + path + timestamp + nonce)
```

### Logging Configuration

Configure logging behavior through environment variables:

```
LOG_LEVEL=info
LOG_FILE=logs/server.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=7
LOG_CONSOLE=true
```

For production environments, consider using a log aggregation service. The server supports sending logs to external services through appropriate transports.

### Metrics Configuration

Enable and configure Prometheus metrics:

```
METRICS_ENABLED=true
METRICS_PATH=/metrics
```

## Scaling Options

### Horizontal Scaling

The Socket Server supports horizontal scaling through multiple instances. To enable this:

1. Deploy multiple instances of the server
2. Configure Redis adapter for all instances
3. Set up a load balancer with sticky sessions

### Redis Adapter Setup

To enable the Redis adapter for multi-instance deployments:

1. Ensure Redis is installed and running
2. Configure the Redis connection in environment variables:

```
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=socket-io
```

3. The server will automatically use the Redis adapter when `REDIS_URL` is provided

### Load Balancer Configuration

When deploying behind a load balancer:

1. Enable sticky sessions based on client IP or cookies
2. Configure health checks to point to the `/health` endpoint
3. Set appropriate timeouts (WebSocket connections need longer timeouts)
4. Example NGINX configuration:

```nginx
upstream socket_nodes {
    ip_hash;  # Enable sticky sessions
    server socket1:8081;
    server socket2:8081;
    server socket3:8081;
}

server {
    listen 80;
    server_name socket.example.com;

    location / {
        proxy_pass http://socket_nodes;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }
}
```

## Monitoring

### Health Checks

The server provides a health check endpoint at `/health`. Use this for monitoring and load balancer configuration.

Example response:

```json
{
  "status": "ok",
  "uptime": 3600,
  "connections": 42,
  "memory": {
    "rss": 75000000,
    "heapTotal": 50000000,
    "heapUsed": 40000000
  }
}
```

### Metrics Integration

Prometheus metrics are available at the `/metrics` endpoint. Configure Prometheus to scrape this endpoint:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'socket-server'
    scrape_interval: 15s
    static_configs:
      - targets: ['socket-server:8081']
```

Key metrics available:

- `socket_connections_total`: Total connection count
- `socket_connections_active`: Current active connections
- `socket_messages_sent_total`: Total messages sent
- `socket_messages_received_total`: Total messages received
- `socket_errors_total`: Total error count
- `socket_room_count`: Number of active rooms
- `socket_message_latency`: Message processing latency histogram

### Log Management

For production deployments, consider using a log management solution:

1. Configure the server to output JSON logs:

```
LOG_FORMAT=json
```

2. Use a tool like Filebeat to ship logs to Elasticsearch:

```yaml
# filebeat.yml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /path/to/logs/server.log
  json.keys_under_root: true
  json.add_error_key: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

## Troubleshooting

### Common Issues

#### Connection Failures

**Symptoms:**
- Clients cannot connect
- Connection errors in client console

**Solutions:**
1. Check if the server is running
2. Verify JWT token is valid and not expired
3. Check CORS configuration if connecting from browser
4. Ensure load balancer is configured for WebSockets

#### Message Delivery Issues

**Symptoms:**
- Messages not being delivered
- One-way communication

**Solutions:**
1. Check if the recipient is connected
2. Verify room membership for room messages
3. Check Redis connection for multi-instance setups
4. Look for errors in server logs

#### High Memory Usage

**Symptoms:**
- Increasing memory usage
- Occasional crashes

**Solutions:**
1. Check for memory leaks using heap snapshots
2. Implement connection limits
3. Enable message batching for high-volume scenarios
4. Consider horizontal scaling

### Debugging Techniques

#### Enable Debug Logs

Set the log level to debug for more detailed information:

```
LOG_LEVEL=debug
```

#### Socket.IO Admin UI

Enable the Socket.IO Admin UI for debugging:

```
SOCKET_IO_ADMIN=true
```

Access it at `/admin` with the configured credentials.

#### Connection Tracing

Enable connection tracing to log all events for specific connections:

```
TRACE_CONNECTIONS=user-123,user-456
```

### Performance Optimization

#### Node.js Optimization

1. Use Node.js 16+ for performance improvements
2. Set appropriate garbage collection flags:

```
NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"
```

#### Message Batching

Enable message batching for high-throughput scenarios:

```
ENABLE_MESSAGE_BATCHING=true
MESSAGE_BATCH_SIZE=100
MESSAGE_BATCH_WINDOW_MS=50
```

#### Event Loop Optimization

Monitor and optimize event loop utilization:

```
EVENT_LOOP_MONITORING=true
EVENT_LOOP_THRESHOLD_MS=100
```

This will log warnings when the event loop is blocked for too long.## Clo
ud Deployment

### AWS Deployment

#### Using Elastic Beanstalk

1. Install the EB CLI:

```bash
pip install awsebcli
```

2. Initialize your EB application:

```bash
eb init socket-server --platform node.js --region us-west-2
```

3. Create a `.ebextensions/nodecommand.config` file:

```yaml
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "npm start"
    NodeVersion: "16.x"
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    PORT: 8080
```

4. Create a `.ebextensions/environment.config` file for environment variables (replace with your values):

```yaml
option_settings:
  aws:elasticbeanstalk:application:environment:
    BACKEND_URL: https://your-backend-url
    JWT_SECRET: your-jwt-secret
    API_KEY: your-api-key
    REDIS_URL: redis://your-elasticache-endpoint:6379
```

5. Deploy your application:

```bash
eb create socket-server-production --instance_type t3.small --elb-type application
```

#### Using ECS with Fargate

1. Create a task definition:

```json
{
  "family": "socket-server",
  "networkMode": "awsvpc",
  "executionRoleArn": "arn:aws:iam::your-account-id:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "socket-server",
      "image": "your-account-id.dkr.ecr.your-region.amazonaws.com/socket-server:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8081,
          "hostPort": 8081,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "8081" },
        { "name": "BACKEND_URL", "value": "https://your-backend-url" },
        { "name": "REDIS_URL", "value": "redis://your-elasticache-endpoint:6379" }
      ],
      "secrets": [
        { "name": "JWT_SECRET", "valueFrom": "arn:aws:ssm:your-region:your-account-id:parameter/socket-server/jwt-secret" },
        { "name": "API_KEY", "valueFrom": "arn:aws:ssm:your-region:your-account-id:parameter/socket-server/api-key" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/socket-server",
          "awslogs-region": "your-region",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048"
}
```

2. Create a service:

```bash
aws ecs create-service \
  --cluster your-cluster \
  --service-name socket-server \
  --task-definition socket-server:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-12345678,subnet-87654321],securityGroups=[sg-12345678],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:your-region:your-account-id:targetgroup/socket-server/12345678,containerName=socket-server,containerPort=8081"
```

### Google Cloud Deployment

#### Using Google Cloud Run

1. Build and push your Docker image:

```bash
gcloud builds submit --tag gcr.io/your-project/socket-server
```

2. Deploy to Cloud Run:

```bash
gcloud run deploy socket-server \
  --image gcr.io/your-project/socket-server \
  --platform managed \
  --allow-unauthenticated \
  --port 8081 \
  --memory 1Gi \
  --set-env-vars="NODE_ENV=production,BACKEND_URL=https://your-backend-url" \
  --set-secrets="JWT_SECRET=jwt-secret:latest,API_KEY=api-key:latest" \
  --region us-central1
```

3. For WebSocket support, use Cloud Run VPC connector with a Network Load Balancer.

#### Using Google Kubernetes Engine (GKE)

1. Create a Kubernetes deployment file `deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: socket-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: socket-server
  template:
    metadata:
      labels:
        app: socket-server
    spec:
      containers:
      - name: socket-server
        image: gcr.io/your-project/socket-server:latest
        ports:
        - containerPort: 8081
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "8081"
        - name: BACKEND_URL
          value: "https://your-backend-url"
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        envFrom:
        - secretRef:
            name: socket-server-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: socket-server-service
spec:
  selector:
    app: socket-server
  ports:
  - port: 80
    targetPort: 8081
  type: LoadBalancer
```

2. Create secrets:

```bash
kubectl create secret generic socket-server-secrets \
  --from-literal=JWT_SECRET=your-jwt-secret \
  --from-literal=API_KEY=your-api-key
```

3. Apply the deployment:

```bash
kubectl apply -f deployment.yaml
```

### Azure Deployment

#### Using Azure App Service

1. Create an App Service plan:

```bash
az appservice plan create --name socket-server-plan --resource-group your-resource-group --sku P1V2 --is-linux
```

2. Create a web app:

```bash
az webapp create --name your-socket-server --plan socket-server-plan --resource-group your-resource-group --runtime "NODE|16-lts"
```

3. Configure environment variables:

```bash
az webapp config appsettings set --name your-socket-server --resource-group your-resource-group --settings \
  NODE_ENV=production \
  WEBSITE_NODE_DEFAULT_VERSION=~16 \
  BACKEND_URL=https://your-backend-url \
  JWT_SECRET=your-jwt-secret \
  API_KEY=your-api-key
```

4. Enable WebSockets:

```bash
az webapp config set --name your-socket-server --resource-group your-resource-group --web-sockets-enabled true
```

5. Deploy your code:

```bash
az webapp deployment source config-zip --name your-socket-server --resource-group your-resource-group --src ./socket-server.zip
```

#### Using Azure Container Instances

1. Create a container group:

```bash
az container create \
  --resource-group your-resource-group \
  --name socket-server \
  --image your-registry.azurecr.io/socket-server:latest \
  --dns-name-label socket-server \
  --ports 8081 \
  --environment-variables \
    NODE_ENV=production \
    PORT=8081 \
    BACKEND_URL=https://your-backend-url \
  --secure-environment-variables \
    JWT_SECRET=your-jwt-secret \
    API_KEY=your-api-key
```

## CI/CD Integration

### GitHub Actions

Create a `.github/workflows/deploy.yml` file:

```yaml
name: Deploy Socket Server

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Set up Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test
      
    - name: Build Docker image
      run: |
        docker build -t socket-server:${{ github.sha }} .
        docker tag socket-server:${{ github.sha }} your-registry/socket-server:latest
        docker tag socket-server:${{ github.sha }} your-registry/socket-server:${{ github.sha }}
      
    - name: Log in to container registry
      run: echo ${{ secrets.REGISTRY_PASSWORD }} | docker login your-registry -u ${{ secrets.REGISTRY_USERNAME }} --password-stdin
      
    - name: Push Docker image
      run: |
        docker push your-registry/socket-server:latest
        docker push your-registry/socket-server:${{ github.sha }}
      
    - name: Deploy to production
      run: |
        # Add your deployment commands here
        # For example, update Kubernetes deployment:
        # kubectl set image deployment/socket-server socket-server=your-registry/socket-server:${{ github.sha }}
```

### GitLab CI/CD

Create a `.gitlab-ci.yml` file:

```yaml
stages:
  - test
  - build
  - deploy

test:
  stage: test
  image: node:16
  script:
    - npm ci
    - npm test

build:
  stage: build
  image: docker:20.10.12
  services:
    - docker:20.10.12-dind
  variables:
    DOCKER_TLS_CERTDIR: "/certs"
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA -t $CI_REGISTRY_IMAGE:latest .
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY_IMAGE:latest

deploy:
  stage: deploy
  image: alpine:latest
  script:
    - apk add --no-cache curl
    - curl -X POST -F token=$DEPLOYMENT_TOKEN -F ref=main https://gitlab.example.com/api/v4/projects/$CI_PROJECT_ID/trigger/pipeline
  only:
    - main
```

## Backup and Disaster Recovery

### Data Backup

1. **Redis Data**: Configure Redis persistence and regular backups:

```
# redis.conf
save 900 1
save 300 10
save 60 10000
```

For Redis on AWS ElastiCache or similar services, enable automatic backups.

2. **Configuration Backup**: Store environment variables and configuration in a secure location:
   - Use AWS Parameter Store, Azure Key Vault, or Google Secret Manager
   - Include these in your infrastructure-as-code templates

3. **Log Backup**: Configure log retention and archiving:
   - Set up log rotation with archiving
   - Ship logs to a centralized logging service

### Disaster Recovery Plan

1. **High Availability Setup**:
   - Deploy multiple instances across availability zones
   - Use a load balancer for traffic distribution
   - Configure health checks for automatic instance replacement

2. **Recovery Procedure**:
   - Maintain infrastructure-as-code templates for quick deployment
   - Document manual recovery steps
   - Regularly test the recovery process

3. **Monitoring and Alerts**:
   - Set up alerts for critical metrics
   - Configure automatic scaling based on load
   - Implement dead man's switch for detecting complete outages