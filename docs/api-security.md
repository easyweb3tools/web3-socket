# API Security Guide

This document provides guidelines and best practices for securing the Socket Server API endpoints.

## Table of Contents

- [Overview](#overview)
- [Authentication Methods](#authentication-methods)
- [Request Validation](#request-validation)
- [Rate Limiting](#rate-limiting)
- [Input Sanitization](#input-sanitization)
- [Security Headers](#security-headers)
- [Implementation Examples](#implementation-examples)

## Overview

The Socket Server exposes HTTP API endpoints for backend integration and administration. Securing these endpoints is critical to prevent unauthorized access and protect the system from attacks.

## Authentication Methods

### API Key Authentication

For simple API authentication, the server uses API keys:

```typescript
// API key middleware
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    logger.warn('API authentication failed: Invalid API key', {
      ip: maskIpAddress(req.ip),
      path: req.path
    });
    
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      code: 'INVALID_API_KEY'
    });
  }
  
  next();
}
```

### Request Signing

For more secure endpoints, implement request signing:

```typescript
// Request signing middleware
export function signatureAuth(req: Request, res: Response, next: NextFunction) {
  const timestamp = req.headers['x-request-timestamp'];
  const nonce = req.headers['x-request-nonce'];
  const signature = req.headers['x-signature'];
  const version = req.headers['x-signature-version'];
  
  // Validate required headers
  if (!timestamp || !nonce || !signature || !version) {
    return res.status(401).json({
      success: false,
      error: 'Missing authentication headers',
      code: 'MISSING_AUTH_HEADERS'
    });
  }
  
  // Validate timestamp (prevent replay attacks)
  const requestTime = parseInt(timestamp as string, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  
  if (isNaN(requestTime) || Math.abs(currentTime - requestTime) > 300) {
    return res.status(401).json({
      success: false,
      error: 'Request expired',
      code: 'REQUEST_EXPIRED'
    });
  }
  
  // Validate signature
  const expectedSignature = calculateSignature(
    req.method,
    req.path,
    timestamp as string,
    nonce as string,
    process.env.API_SECRET
  );
  
  if (signature !== expectedSignature) {
    logger.warn('API authentication failed: Invalid signature', {
      ip: maskIpAddress(req.ip),
      path: req.path
    });
    
    return res.status(401).json({
      success: false,
      error: 'Invalid signature',
      code: 'INVALID_SIGNATURE'
    });
  }
  
  next();
}

// Calculate signature
function calculateSignature(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  secret: string
): string {
  const data = method + path + timestamp + nonce;
  return createHmac('sha256', secret).update(data).digest('hex');
}
```

### JWT Authentication

For admin endpoints, use JWT authentication:

```typescript
// JWT authentication middleware
export function jwtAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing authorization header',
      code: 'MISSING_AUTH_HEADER'
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('JWT authentication failed', {
      ip: maskIpAddress(req.ip),
      path: req.path,
      error: error.message
    });
    
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
}
```

## Request Validation

### Schema Validation

Use JSON Schema validation for request bodies:

```typescript
// Schema validation middleware
export function validateSchema(schema: JSONSchemaType<any>) {
  const ajv = new Ajv();
  const validate = ajv.compile(schema);
  
  return (req: Request, res: Response, next: NextFunction) => {
    const valid = validate(req.body);
    
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        code: 'INVALID_REQUEST',
        details: validate.errors
      });
    }
    
    next();
  };
}

// Example schema for push message
const pushMessageSchema = {
  type: 'object',
  properties: {
    userId: { type: 'string' },
    roomId: { type: 'string' },
    event: { type: 'string' },
    data: { type: 'object' }
  },
  required: ['event', 'data'],
  oneOf: [
    { required: ['userId'] },
    { required: ['roomId'] }
  ],
  additionalProperties: false
};

// Apply validation middleware
app.post('/api/push', 
  apiKeyAuth,
  validateSchema(pushMessageSchema),
  pushController.handlePush
);
```## Rate
 Limiting

Implement rate limiting to prevent abuse:

```typescript
// Rate limiting middleware
export function rateLimiter(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute default
  const max = options.max || 100; // 100 requests per window default
  const keyGenerator = options.keyGenerator || ((req: Request) => {
    return req.headers['x-api-key'] as string || req.ip;
  });
  
  // Store for rate limit counters
  const store: Record<string, { count: number, resetTime: number }> = {};
  
  // Clean up expired entries periodically
  setInterval(() => {
    const now = Date.now();
    Object.keys(store).forEach(key => {
      if (store[key].resetTime <= now) {
        delete store[key];
      }
    });
  }, windowMs);
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Initialize or reset if window expired
    if (!store[key] || store[key].resetTime <= now) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs
      };
    }
    
    // Increment counter
    store[key].count += 1;
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - store[key].count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(store[key].resetTime / 1000));
    
    // Check if rate limit exceeded
    if (store[key].count > max) {
      logger.warn('Rate limit exceeded', {
        ip: maskIpAddress(req.ip),
        path: req.path,
        key
      });
      
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((store[key].resetTime - now) / 1000)
      });
    }
    
    next();
  };
}

// Apply rate limiting to API routes
app.use('/api', rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // 100 requests per minute
}));

// More strict rate limiting for authentication endpoints
app.use('/api/auth', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10 // 10 requests per 15 minutes
}));
```

## Input Sanitization

Sanitize all input to prevent injection attacks:

```typescript
// HTML sanitization for string inputs
export function sanitizeHtml(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Recursive object sanitization
export function sanitizeObject(obj: any): any {
  if (!obj) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeHtml(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    
    Object.keys(obj).forEach(key => {
      // Sanitize both keys and values
      const sanitizedKey = sanitizeHtml(key);
      result[sanitizedKey] = sanitizeObject(obj[key]);
    });
    
    return result;
  }
  
  return obj;
}

// Apply sanitization middleware
app.use((req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
});
```

## Security Headers

Add security headers to all responses:

```typescript
// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict Transport Security (only in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'no-referrer');
  
  next();
}

// Apply security headers to all responses
app.use(securityHeaders);
```

## Implementation Examples

### Secure Push API

```typescript
// Push API controller
export class PushController {
  constructor(private socketServer: SocketServer) {}
  
  async handlePush(req: Request, res: Response): Promise<void> {
    try {
      const { userId, roomId, event, data } = req.body;
      
      // Validate event name
      if (!this.isValidEventName(event)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid event name',
          code: 'INVALID_EVENT'
        });
      }
      
      // User-specific message
      if (userId) {
        const delivered = this.socketServer.emitToUser(userId, event, data);
        
        return res.json({
          success: true,
          delivered,
          userId
        });
      }
      
      // Room message
      if (roomId) {
        const recipients = this.socketServer.broadcastToRoom(roomId, event, data);
        
        return res.json({
          success: true,
          recipients,
          roomId
        });
      }
      
      // This should never happen due to schema validation
      res.status(400).json({
        success: false,
        error: 'Either userId or roomId is required',
        code: 'MISSING_TARGET'
      });
    } catch (error) {
      logger.error('Error handling push request', {
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'SERVER_ERROR'
      });
    }
  }
  
  // Validate event name to prevent injection
  private isValidEventName(event: string): boolean {
    // Only allow alphanumeric characters, colons, and underscores
    return /^[a-zA-Z0-9:_]+$/.test(event);
  }
}

// Register the push API route
app.post('/api/push',
  apiKeyAuth,
  signatureAuth,
  validateSchema(pushMessageSchema),
  rateLimiter({ windowMs: 60 * 1000, max: 100 }),
  (req, res) => pushController.handlePush(req, res)
);
```

### Secure Admin API

```typescript
// Admin API controller
export class AdminController {
  constructor(private socketServer: SocketServer) {}
  
  async getConnections(req: Request, res: Response): Promise<void> {
    try {
      // Pagination parameters
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Get connections with pagination
      const connections = this.socketServer.getConnections(limit, offset);
      const total = this.socketServer.getConnectionCount();
      
      // Mask sensitive information
      const sanitizedConnections = connections.map(conn => ({
        socketId: conn.socketId,
        userId: maskUserId(conn.userId),
        connectedAt: conn.connectedAt,
        ip: maskIpAddress(conn.ip),
        userAgent: conn.userAgent
      }));
      
      res.json({
        success: true,
        connections: sanitizedConnections,
        total
      });
    } catch (error) {
      logger.error('Error getting connections', {
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'SERVER_ERROR'
      });
    }
  }
  
  async disconnectUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId, socketId, reason } = req.body;
      
      // Audit log for this sensitive operation
      auditLog(
        'DISCONNECT_USER',
        req.user.userId,
        userId ? `user:${userId}` : `socket:${socketId}`,
        'ATTEMPT',
        { reason }
      );
      
      let disconnected = 0;
      
      if (userId) {
        disconnected = this.socketServer.disconnectUser(userId, reason || 'Admin disconnected');
      } else if (socketId) {
        disconnected = this.socketServer.disconnectSocket(socketId, reason || 'Admin disconnected');
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either userId or socketId is required',
          code: 'MISSING_TARGET'
        });
      }
      
      // Audit log for result
      auditLog(
        'DISCONNECT_USER',
        req.user.userId,
        userId ? `user:${userId}` : `socket:${socketId}`,
        'SUCCESS',
        { disconnected }
      );
      
      res.json({
        success: true,
        disconnected
      });
    } catch (error) {
      logger.error('Error disconnecting user', {
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'SERVER_ERROR'
      });
    }
  }
}

// Register admin API routes
const adminRouter = express.Router();

adminRouter.use(jwtAuth); // Require JWT authentication for all admin routes

adminRouter.get('/connections',
  rateLimiter({ windowMs: 60 * 1000, max: 30 }),
  (req, res) => adminController.getConnections(req, res)
);

adminRouter.post('/disconnect',
  validateSchema(disconnectUserSchema),
  rateLimiter({ windowMs: 60 * 1000, max: 10 }),
  (req, res) => adminController.disconnectUser(req, res)
);

app.use('/api/admin', adminRouter);
```