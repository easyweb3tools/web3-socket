# Secure Logging Guide

This document provides guidelines and best practices for implementing secure logging in the Socket Server.

## Table of Contents

- [Overview](#overview)
- [PII Handling](#pii-handling)
- [Log Levels and Content](#log-levels-and-content)
- [Secure Storage](#secure-storage)
- [Compliance Considerations](#compliance-considerations)
- [Implementation Examples](#implementation-examples)

## Overview

Secure logging is essential for maintaining privacy, security, and compliance while still providing the necessary information for debugging and monitoring. The Socket Server implements secure logging practices to protect sensitive information while ensuring operational visibility.

## PII Handling

### Identifying PII

Personal Identifiable Information (PII) that should be protected includes:

- User IDs
- IP addresses
- Email addresses
- Names
- Session tokens
- Authentication credentials
- Any other personal data

### Redaction Techniques

The Socket Server uses the following techniques to protect PII:

1. **Masking**: Replace part of the data with asterisks or other characters
   - Example: Convert `user@example.com` to `u***@example.com`

2. **Hashing**: Replace the entire value with a hash
   - Example: Convert IP address to a hash value

3. **Tokenization**: Replace sensitive data with non-sensitive equivalents
   - Example: Replace actual user ID with a session-specific token

4. **Removal**: Completely remove sensitive fields from logs

### Implementation

```typescript
// IP address masking utility
export function maskIpAddress(ip: string): string {
  if (!ip) return 'unknown';
  
  // For IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  
  // For IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts[0]}:${parts[1]}:****:****:****:****`;
  }
  
  return 'invalid-ip';
}

// User ID masking utility
export function maskUserId(userId: string): string {
  if (!userId) return 'unknown';
  
  if (userId.length <= 8) {
    return `${userId.substring(0, 2)}****`;
  }
  
  return `${userId.substring(0, 3)}****${userId.substring(userId.length - 2)}`;
}

// Email masking utility
export function maskEmail(email: string): string {
  if (!email) return 'unknown';
  if (!email.includes('@')) return 'invalid-email';
  
  const [localPart, domain] = email.split('@');
  const maskedLocalPart = localPart.length <= 3 
    ? `${localPart[0]}**` 
    : `${localPart[0]}${localPart[1]}****`;
  
  return `${maskedLocalPart}@${domain}`;
}
```

## Log Levels and Content

### Log Levels

Use appropriate log levels to control the amount of detail:

- **ERROR**: Errors that require immediate attention
- **WARN**: Warning conditions that should be reviewed
- **INFO**: General operational information
- **DEBUG**: Detailed debugging information (no PII)
- **TRACE**: Very detailed debugging (development only, may contain masked PII)

### Content Guidelines

1. **ERROR and WARN logs**:
   - Include enough context to understand the issue
   - Include error codes and types
   - Mask any PII
   - Include instance and request identifiers

2. **INFO logs**:
   - Record significant events (connections, disconnections)
   - Use aggregated metrics instead of individual events when possible
   - Mask all PII

3. **DEBUG logs**:
   - Include detailed flow information
   - Mask all PII
   - Only enable in non-production environments by default

4. **TRACE logs**:
   - Most detailed level
   - May contain masked PII
   - Only enable during development or specific debugging sessions

### Implementation

```typescript
// Logger configuration with PII protection
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      // Sanitize metadata before logging
      const sanitizedMeta = sanitizeLogMetadata(meta);
      return `${timestamp} ${level}: ${message} ${JSON.stringify(sanitizedMeta)}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/server.log' })
  ]
});

// Sanitize log metadata to remove/mask PII
function sanitizeLogMetadata(meta: any): any {
  if (!meta) return {};
  
  const result = { ...meta };
  
  // Mask specific fields
  if (result.userId) result.userId = maskUserId(result.userId);
  if (result.ip) result.ip = maskIpAddress(result.ip);
  if (result.email) result.email = maskEmail(result.email);
  
  // Remove sensitive fields
  delete result.password;
  delete result.token;
  delete result.jwt;
  delete result.authToken;
  delete result.sessionToken;
  
  // Recursively sanitize nested objects
  Object.keys(result).forEach(key => {
    if (typeof result[key] === 'object' && result[key] !== null) {
      result[key] = sanitizeLogMetadata(result[key]);
    }
  });
  
  return result;
}
```## Se
cure Storage

### Log File Security

1. **File Permissions**:
   - Restrict log file permissions to the application user only
   - Example: `chmod 600 logs/server.log`

2. **Log Directory Permissions**:
   - Restrict log directory permissions
   - Example: `chmod 700 logs/`

3. **Log Rotation**:
   - Implement log rotation to prevent excessive disk usage
   - Compress and encrypt archived logs
   - Set appropriate retention periods

### Implementation

```typescript
// Configure log rotation
const logRotateConfig = {
  files: 'logs/server.log',
  size: '10M',
  compress: true,
  keep: 7, // Keep 7 days of logs
  createMode: '0600' // Secure file permissions
};

// Set up log rotation
logrotate(logRotateConfig, (err) => {
  if (err) {
    console.error('Error setting up log rotation:', err);
  }
});

// Ensure log directory has proper permissions
fs.chmod('logs', 0o700, (err) => {
  if (err) {
    console.error('Error setting log directory permissions:', err);
  }
});
```

### Centralized Logging

For production environments, use a centralized logging system:

1. **Transport Encryption**:
   - Use TLS/SSL for log transmission
   - Verify server certificates

2. **Authentication**:
   - Use strong authentication for log shipping
   - Rotate credentials regularly

3. **Access Control**:
   - Implement role-based access control for log access
   - Audit log access

### Implementation

```typescript
// Example: Secure Elasticsearch transport
const esTransport = new ElasticsearchTransport({
  level: 'info',
  clientOpts: {
    node: process.env.ELASTICSEARCH_URL,
    auth: {
      username: process.env.ELASTICSEARCH_USER,
      password: process.env.ELASTICSEARCH_PASSWORD
    },
    ssl: {
      ca: fs.readFileSync(process.env.ELASTICSEARCH_CA_PATH),
      rejectUnauthorized: true
    }
  },
  transformer: (logData) => {
    // Additional sanitization before sending to centralized storage
    return sanitizeLogMetadata(logData);
  }
});

// Add transport to logger
logger.add(esTransport);
```

## Compliance Considerations

### GDPR Compliance

1. **Data Minimization**:
   - Only log what is necessary
   - Regularly review and justify logged fields

2. **Retention Limits**:
   - Implement log retention policies
   - Automatically delete logs after the retention period

3. **Right to Erasure**:
   - Implement mechanisms to remove specific user data from logs
   - Consider using user identifiers that can be mapped back only with a separate secure mapping table

### PCI DSS Compliance

If handling payment information:

1. **Prohibited Data**:
   - Never log full credit card numbers
   - Never log CVV/CVC codes
   - Never log PIN data

2. **Masked Data**:
   - Only log the last 4 digits of credit card numbers if necessary
   - Mask all other digits

3. **Log Access**:
   - Restrict log access to authorized personnel
   - Implement dual control for sensitive log access

### HIPAA Compliance

If handling health information:

1. **PHI Protection**:
   - Encrypt all logs containing Protected Health Information
   - Implement strict access controls

2. **Audit Trails**:
   - Maintain detailed audit trails of log access
   - Log all actions performed on logs containing PHI

## Implementation Examples

### Connection Logging

```typescript
// Secure connection logging
io.on('connection', (socket) => {
  const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.conn.remoteAddress;
  const userAgent = socket.handshake.headers['user-agent'];
  
  logger.info('Client connected', {
    socketId: socket.id,
    ip: maskIpAddress(clientIp as string),
    userAgent: userAgent ? userAgent.substring(0, 50) : 'unknown',
    transport: socket.conn.transport.name
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    logger.info('Client disconnected', {
      socketId: socket.id,
      reason,
      duration: (Date.now() - socket.handshake.issued) / 1000
    });
  });
});
```

### Authentication Logging

```typescript
// Secure authentication logging
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      logger.warn('Authentication failed: No token provided', {
        socketId: socket.id,
        ip: maskIpAddress(socket.conn.remoteAddress)
      });
      return next(new Error('Authentication failed'));
    }
    
    const decoded = verifyToken(token);
    
    logger.info('Authentication successful', {
      socketId: socket.id,
      userId: maskUserId(decoded.userId),
      // Don't log the token or any token contents
    });
    
    socket.data.userId = decoded.userId;
    next();
  } catch (error) {
    logger.warn('Authentication failed: Invalid token', {
      socketId: socket.id,
      ip: maskIpAddress(socket.conn.remoteAddress),
      error: error.message // Don't log the full error object which might contain token fragments
    });
    next(new Error('Authentication failed'));
  }
});
```

### Error Logging

```typescript
// Secure error logging
try {
  // Some operation that might fail
  processUserMessage(message);
} catch (error) {
  logger.error('Error processing message', {
    messageType: message.type,
    errorCode: error.code || 'UNKNOWN_ERROR',
    errorMessage: error.message,
    // Don't include the full message content which might contain PII
    // Don't include the full error stack which might reveal code structure
    userId: maskUserId(userId)
  });
  
  // Send sanitized error to client
  socket.emit('error', {
    code: error.code || 'UNKNOWN_ERROR',
    message: 'Failed to process message'
  });
}
```

### Request Logging Middleware

```typescript
// Secure HTTP request logging middleware
app.use((req, res, next) => {
  // Generate request ID for correlation
  const requestId = randomUUID();
  req.requestId = requestId;
  
  // Log request start
  const startTime = Date.now();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Don't log authorization headers or request bodies
  logger.info(`HTTP ${req.method} ${req.path}`, {
    requestId,
    ip: maskIpAddress(clientIp as string),
    userAgent: req.headers['user-agent'],
    contentLength: req.headers['content-length']
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`HTTP ${req.method} ${req.path} ${res.statusCode}`, {
      requestId,
      statusCode: res.statusCode,
      duration,
      contentLength: res.getHeader('content-length')
    });
  });
  
  next();
});
```

### Audit Logging

```typescript
// Secure audit logging for sensitive operations
function auditLog(action: string, actor: string, resource: string, result: string, details?: any) {
  logger.info('AUDIT', {
    action,
    actor: maskUserId(actor),
    resource,
    result,
    timestamp: new Date().toISOString(),
    details: sanitizeLogMetadata(details)
  });
}

// Example usage
function updateUserPermissions(adminId: string, targetUserId: string, permissions: string[]) {
  try {
    // Perform permission update
    const success = performPermissionUpdate(targetUserId, permissions);
    
    // Log the audit event
    auditLog(
      'UPDATE_PERMISSIONS',
      adminId,
      `user:${maskUserId(targetUserId)}`,
      success ? 'SUCCESS' : 'FAILURE',
      { permissionCount: permissions.length }
    );
    
    return success;
  } catch (error) {
    auditLog(
      'UPDATE_PERMISSIONS',
      adminId,
      `user:${maskUserId(targetUserId)}`,
      'ERROR',
      { errorCode: error.code }
    );
    throw error;
  }
}
```