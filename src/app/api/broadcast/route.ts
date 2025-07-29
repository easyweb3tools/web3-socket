import { NextRequest } from 'next/server'
import { socketService } from '@/lib/socket'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, type = 'info', data } = body

    if (!message) {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Message content is required'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const broadcastData = {
      type,
      message,
      data,
      timestamp: new Date().toISOString()
    }

    socketService.broadcastToAll('notification', broadcastData)
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Notification broadcast successfully',
        data: broadcastData
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
        message: 'Failed to broadcast notification',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}