'use client'

import { useState, useEffect } from 'react'

interface Metrics {
  connections: number
  rooms: number
  messages: number
  uptime: number
  status: string
}

interface Message {
  id: string
  userId: string
  username?: string
  content: string
  timestamp: string
  room?: string
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusResponse, messagesResponse] = await Promise.all([
          fetch('/api/status'),
          fetch('/api/push?limit=20')
        ])

        const statusData = await statusResponse.json()
        const messagesData = await messagesResponse.json()

        setMetrics(statusData)
        if (messagesData.success) {
          setMessages(messagesData.messages)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000)

    return () => clearInterval(interval)
  }, [])

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getMessagesPerHour = () => {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    return messages.filter(msg => new Date(msg.timestamp) > oneHourAgo).length
  }

  const getUniqueUsers = () => {
    const userIds = new Set(messages.map(msg => msg.userId))
    return userIds.size
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Metrics Dashboard</h1>
        <p className="mt-2 text-slate-300">
          Real-time monitoring of system performance metrics and usage statistics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                metrics?.status === 'running' 
                  ? 'bg-green-500/20' 
                  : 'bg-red-500/20'
              }`}>
                <span className={`text-lg ${
                  metrics?.status === 'running' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {metrics?.status === 'running' ? '🟢' : '🔴'}
                </span>
              </div>
              <span className="text-sm font-medium text-secondary">System Status</span>
            </div>
          </div>
          <div className={`text-xl font-bold mb-2 ${
            metrics?.status === 'running' ? 'text-green-400' : 'text-red-400'
          }`}>
            {metrics?.status === 'running' ? 'Running' : 'Error'}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-secondary">Uptime</span>
            </div>
          </div>
          <div className="text-xl font-bold text-white mb-2">
            {metrics?.uptime ? formatUptime(metrics.uptime) : 'N/A'}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-secondary">Messages/Hour</span>
            </div>
          </div>
          <div className="text-xl font-bold text-white mb-2">
            {getMessagesPerHour()}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-secondary">Active Users</span>
            </div>
          </div>
          <div className="text-xl font-bold text-white mb-2">
            {getUniqueUsers()}
          </div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 mb-8">
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">
              Live Statistics
            </h3>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-secondary">Live Updates</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-600/30">
              <span className="text-sm text-secondary">Online Connections</span>
              <span className="text-lg font-semibold text-white">{metrics?.connections || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-600/30">
              <span className="text-sm text-secondary">Active Rooms</span>
              <span className="text-lg font-semibold text-white">{metrics?.rooms || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-600/30">
              <span className="text-sm text-secondary">Total Messages</span>
              <span className="text-lg font-semibold text-white">{metrics?.messages || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-600/30">
              <span className="text-sm text-secondary">Avg. Users per Room</span>
              <span className="text-lg font-semibold text-white">
                {metrics?.rooms && metrics.rooms > 0 
                  ? Math.round((metrics.connections || 0) / metrics.rooms) 
                  : 0}
              </span>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">
              System Information
            </h3>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-secondary">Environment</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-600/30">
              <span className="text-sm text-secondary">Node.js Version</span>
              <span className="text-sm font-medium text-white">{process.version}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-600/30">
              <span className="text-sm text-secondary">Socket.IO Version</span>
              <span className="text-sm font-medium text-white">v4.7.5</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-600/30">
              <span className="text-sm text-secondary">Memory Usage</span>
              <span className="text-sm font-medium text-white">
                {typeof window !== 'undefined' ? 'N/A (Client)' : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-600/30">
              <span className="text-sm text-secondary">Last Updated</span>
              <span className="text-sm font-medium text-white">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Messages */}
      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">
            Recent Messages ({messages.length})
          </h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-secondary">Live Messages</span>
          </div>
        </div>
        
        {messages.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-slate-400">No messages yet</p>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <div className="divide-y divide-slate-600/20">
              {messages.slice(0, 10).map((message, index) => (
                <div key={message.id || index} className="p-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-sm font-medium text-white">
                          {message.username || 'Anonymous'}
                        </span>
                        <span className="text-xs text-secondary">
                          {message.userId.slice(0, 8)}...
                        </span>
                        {message.room && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            {message.room}
                          </span>
                        )}
                        <span className="text-xs text-muted">
                          {formatDate(message.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 truncate">{message.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}