export interface LogLevel {
  INFO: 'info'
  WARN: 'warn'
  ERROR: 'error'
  DEBUG: 'debug'
}

export interface LogEntry {
  timestamp: Date
  level: keyof LogLevel
  message: string
  data?: any
  socketId?: string
  userId?: string
}

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 1000

  log(level: keyof LogLevel, message: string, data?: any, socketId?: string, userId?: string) {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      socketId,
      userId
    }

    this.logs.unshift(entry)
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs)
    }

    console.log(`[${entry.timestamp.toISOString()}] ${level.toUpperCase()}: ${message}`, data || '')
  }

  info(message: string, data?: any, socketId?: string, userId?: string) {
    this.log('INFO', message, data, socketId, userId)
  }

  warn(message: string, data?: any, socketId?: string, userId?: string) {
    this.log('WARN', message, data, socketId, userId)
  }

  error(message: string, data?: any, socketId?: string, userId?: string) {
    this.log('ERROR', message, data, socketId, userId)
  }

  debug(message: string, data?: any, socketId?: string, userId?: string) {
    this.log('DEBUG', message, data, socketId, userId)
  }

  getLogs(limit?: number): LogEntry[] {
    return limit ? this.logs.slice(0, limit) : this.logs
  }

  clearLogs() {
    this.logs = []
  }
}

export const logger = new Logger()