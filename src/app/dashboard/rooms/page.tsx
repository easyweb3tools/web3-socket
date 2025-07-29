'use client'

import { useState, useEffect } from 'react'

interface Room {
  id: string
  name: string
  createdAt: string
  userCount: number
  users: string[]
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [selectedRoom, setSelectedRoom] = useState<string>('')

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await fetch('/api/rooms')
        const data = await response.json()
        if (data.success) {
          setRooms(data.rooms)
        }
      } catch (error) {
        console.error('Failed to fetch rooms:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRooms()
    const interval = setInterval(fetchRooms, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      alert('Please enter a message to send')
      return
    }

    try {
      const response = await fetch('/api/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room: selectedRoom || undefined,
          event: 'notification',
          data: {
            type: 'admin',
            message: broadcastMessage,
            timestamp: new Date().toISOString()
          }
        })
      })

      const data = await response.json()
      
      if (data.success) {
        alert(`Message sent successfully: ${data.message}`)
        setBroadcastMessage('')
      } else {
        alert('Send failed: ' + data.message)
      }
    } catch (error) {
      alert('Send failed')
      console.error('Failed to broadcast message:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
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
        <h1 className="text-3xl font-bold text-white">Room Management</h1>
        <p className="mt-2 text-slate-300">
          View all active rooms and user distribution
        </p>
      </div>

      {/* Broadcast Message */}
      <div className="dashboard-card mb-8">
        <h3 className="text-xl font-semibold text-white mb-6">Message Broadcast</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="room-select" className="block text-sm font-medium text-secondary mb-2">
              Target Room (leave empty to broadcast to all users)
            </label>
            <select
              id="room-select"
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="block w-full px-4 py-3 bg-slate-800/80 border border-slate-600/40 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
            >
              <option value="">All Users (Global Broadcast)</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.name}>
                  {room.name} ({room.userCount} users)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-secondary mb-2">
              Message Content
            </label>
            <div className="flex rounded-lg overflow-hidden">
              <input
                type="text"
                id="message"
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-800/80 border border-slate-600/40 border-r-0 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                placeholder="Enter message to broadcast..."
              />
              <button
                onClick={handleBroadcast}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors border border-blue-500 hover:border-blue-600"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
        <div className="dashboard-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary mb-2">Active Rooms</p>
              <p className="text-3xl font-bold text-white">{rooms.length}</p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="dashboard-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary mb-2">Total Users</p>
              <p className="text-3xl font-bold text-white">
                {rooms.reduce((sum, room) => sum + room.userCount, 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="dashboard-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary mb-2">Avg Users per Room</p>
              <p className="text-3xl font-bold text-white">
                {rooms.length > 0 ? Math.round(rooms.reduce((sum, room) => sum + room.userCount, 0) / rooms.length) : 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Rooms List */}
      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">
            Room List
          </h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-secondary">Real-time Updates</span>
          </div>
        </div>
        
        {rooms.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-slate-400">No active rooms</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-600/30">
                  <th className="px-6 py-4 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    Room Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    User Count
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    Created Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    Room ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-600/20">
                {rooms.map((room, index) => (
                  <tr key={room.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                            <span className="text-purple-400 font-medium text-sm">
                              {room.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-white">
                            {room.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                        {room.userCount} users
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                      {formatDate(room.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                      <code className="bg-slate-800/50 px-2 py-1 rounded text-xs border border-slate-600/30">
                        {room.id.slice(0, 8)}...
                      </code>
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