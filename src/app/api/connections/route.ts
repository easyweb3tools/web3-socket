import { NextRequest } from 'next/server'
import { socketService } from '@/lib/socket'

export async function GET(req: NextRequest) {
  try {
    const users = socketService.getConnectedUsers()
    console.log('Connections API called, users count:', users.length) // 添加调试日志
    
    return new Response(
      JSON.stringify({
        success: true,
        count: users.length,
        users: users.map(user => ({
          id: user.id,
          socketId: user.socketId,
          username: user.username,
          connectedAt: user.connectedAt,
          lastActivity: user.lastActivity,
          rooms: user.rooms
        }))
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    console.error('Connections API error:', error) // 添加错误日志
    return new Response(
      JSON.stringify({ 
        success: false,
        message: 'Failed to get connections',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const socketId = searchParams.get('socketId')
    
    if (!socketId) {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Socket ID is required'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    socketService.disconnectUser(socketId)
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User disconnected successfully'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false,
        message: 'Failed to disconnect user',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}