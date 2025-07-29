'use client'

import { useState, useEffect } from 'react'

interface ServerStatus {
  status: string
  connections: number
  rooms: number
  messages: number
  uptime: number
}

export default function DashboardPage() {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/status')
        const data = await response.json()
        setStatus(data)
      } catch (error) {
        console.error('Failed to fetch status:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hours}h ${minutes}m ${secs}s`
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
        <h1 className="text-3xl font-bold text-white">Service Overview</h1>
        <p className="mt-2 text-slate-300">
          Real-time communication service status and statistics
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                status?.status === 'running' 
                  ? 'bg-green-500/20' 
                  : 'bg-red-500/20'
              }`}>
                <span className={`text-lg ${
                  status?.status === 'running' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {status?.status === 'running' ? '✅' : '❌'}
                </span>
              </div>
              <span className="text-sm font-medium text-secondary">Service Status</span>
            </div>
          </div>
          <div className={`text-2xl font-bold mb-2 ${
            status?.status === 'running' ? 'text-green-400' : 'text-red-400'
          }`}>
            {status?.status === 'running' ? 'Running' : 'Error'}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-secondary">Online Connections</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-2">
            {status?.connections || 0}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <span className="text-sm font-medium text-secondary">Active Rooms</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-2">
            {status?.rooms || 0}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-secondary">Total Messages</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-2">
            {status?.messages || 0}
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">System Information</h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-secondary">System running normally</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-600/30">
            <dt className="text-sm font-medium text-secondary mb-2">Uptime</dt>
            <dd className="text-lg font-semibold text-white">
              {status?.uptime ? formatUptime(status.uptime) : 'N/A'}
            </dd>
          </div>
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-600/30">
            <dt className="text-sm font-medium text-secondary mb-2">Service Port</dt>
            <dd className="text-lg font-semibold text-white">Socket.IO WebSocket</dd>
          </div>
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-600/30">
            <dt className="text-sm font-medium text-secondary mb-2">Protocol Version</dt>
            <dd className="text-lg font-semibold text-white">Socket.IO v4.7.5</dd>
          </div>
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-600/30">
            <dt className="text-sm font-medium text-secondary mb-2">Last Updated</dt>
            <dd className="text-lg font-semibold text-white">
              {new Date().toLocaleString()}
            </dd>
          </div>
        </div>
      </div>
    </div>
  )
}