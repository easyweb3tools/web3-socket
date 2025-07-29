'use client'

import { useState, useEffect } from 'react'

interface ConnectedUser {
  id: string
  socketId: string
  username?: string
  connectedAt: string
  lastActivity: string
  rooms: string[]
}

export default function ConnectionsPage() {
  const [users, setUsers] = useState<ConnectedUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const response = await fetch('/api/connections')
        const data = await response.json()
        if (data.success) {
          setUsers(data.users)
        }
      } catch (error) {
        console.error('Failed to fetch connections:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchConnections()
    const interval = setInterval(fetchConnections, 3000)

    return () => clearInterval(interval)
  }, [])

  const handleDisconnectUser = async (socketId: string) => {
    if (!confirm('Are you sure you want to disconnect this user?')) return

    try {
      const response = await fetch(`/api/connections?socketId=${socketId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.success) {
        setUsers(users.filter(user => user.socketId !== socketId))
        alert('User connection disconnected')
      } else {
        alert('Failed to disconnect: ' + data.message)
      }
    } catch (error) {
      alert('Failed to disconnect')
      console.error('Failed to disconnect user:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getTimeDiff = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
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
        <h1 className="text-3xl font-bold text-white">Connection Management</h1>
        <p className="mt-2 text-slate-300">
          Manage all online connected users, view connection status and activity information
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8">
        <div className="dashboard-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary mb-2">Online Users</p>
              <p className="text-3xl font-bold text-white">{users.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">
            Online User List
          </h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-secondary">Real-time Updates</span>
          </div>
        </div>
        
        {users.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <p className="text-slate-400">No online users</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-600/30">
                  <th className="px-6 py-4 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    User Info
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    Socket ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    Connection Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    Rooms
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-600/20">
                {users.map((user, index) => (
                  <tr key={user.socketId} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                            <span className="text-blue-400 font-medium text-sm">
                              {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-white">
                            {user.username || 'Anonymous'}
                          </div>
                          <div className="text-sm text-secondary">
                            ID: {user.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                      <code className="bg-slate-800/50 px-2 py-1 rounded text-xs border border-slate-600/30">
                        {user.socketId.slice(0, 10)}...
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                      <div className="text-white">{formatDate(user.connectedAt)}</div>
                      <div className="text-xs text-muted">
                        {getTimeDiff(user.connectedAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                      <div className="text-white">{formatDate(user.lastActivity)}</div>
                      <div className="text-xs text-muted">
                        {getTimeDiff(user.lastActivity)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.rooms.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.rooms.map((room, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30"
                            >
                              {room}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">No rooms</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleDisconnectUser(user.socketId)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors border border-red-500/30 hover:border-red-500/50"
                      >
                        Disconnect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}