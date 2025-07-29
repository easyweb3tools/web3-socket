'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import ChatComponent from '@/components/dashboard/ChatComponent'

export default function Home() {
  const [status, setStatus] = useState<string>('Checking...')
  const [connectionCount, setConnectionCount] = useState<number>(0)

  useEffect(() => {
    // First initialize Socket.IO server
    const initializeSocketIO = async () => {
      try {
        await fetch('/api/socket/io')
        console.log('Socket.IO server initialization triggered')
      } catch (error) {
        console.log('Failed to initialize Socket.IO:', error)
      }
    }

    initializeSocketIO()

    // Then check service status
    const checkStatus = () => {
      fetch('/api/status')
        .then(res => res.json())
        .then(data => {
          setStatus(data.status)
          setConnectionCount(data.connections || 0)
        })
        .catch(() => setStatus('Service Error'))
    }

    // Wait a moment for Socket.IO to initialize
    setTimeout(checkStatus, 1000)
  }, [])

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Socket.IO Dashboard</h1>
              <p className="text-secondary">Real-time Communication Service Management</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-white bg-blue-500 px-3 py-1 rounded-full">Healthy</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="dashboard-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a8.5 8.5 0 0112.16 0" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-secondary">Total Connections</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">{connectionCount.toLocaleString()}</div>
            <div className="flex items-center text-sm text-green-400">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              +12% from yesterday
            </div>
          </div>

          <div className="dashboard-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-secondary">Active Users</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">731</div>
            <div className="flex items-center text-sm text-green-400">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              +8% from yesterday
            </div>
          </div>

          <div className="dashboard-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-secondary">Total Rooms</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">156</div>
            <div className="flex items-center text-sm text-secondary">
              +3 new rooms
            </div>
          </div>

          <div className="dashboard-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-secondary">Messages/sec</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">52</div>
            <div className="flex items-center text-sm text-secondary">
              Real-time message rate
            </div>
          </div>
        </div>

        {/* Status Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          <div className="dashboard-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Service Status</h3>
              <div className={`w-3 h-3 rounded-full ${status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            </div>
            <p className={`text-2xl font-bold mb-4 ${status === 'running' ? 'text-green-400' : 'text-red-400'}`}>
              {status === 'running' ? 'Running' : status}
            </p>
            <div className="text-center">
              <Link 
                href="/dashboard" 
                className="btn-primary inline-block px-6 py-3"
              >
                Go to Console
              </Link>
            </div>
          </div>

          <div className="dashboard-card lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">System Monitoring</h3>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-secondary">All services running normally</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-secondary">Uptime</span>
                <span className="text-green-400 font-mono">15d 8h 32m</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-secondary">CPU Usage</span>
                <div className="flex items-center space-x-3">
                  <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="w-1/4 h-full bg-blue-500 rounded-full"></div>
                  </div>
                  <span className="text-blue-400 font-mono text-sm">23%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-secondary">Memory Usage</span>
                <div className="flex items-center space-x-3">
                  <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="w-2/3 h-full bg-purple-500 rounded-full"></div>
                  </div>
                  <span className="text-purple-400 font-mono text-sm">67%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-secondary">Network I/O</span>
                <div className="flex items-center space-x-3">
                  <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="w-2/5 h-full bg-orange-500 rounded-full"></div>
                  </div>
                  <span className="text-orange-400 font-mono text-sm">45%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Test Component */}
        <div>
          <ChatComponent />
        </div>
      </div>
    </main>
  )
}