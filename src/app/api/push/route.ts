import { NextRequest } from 'next/server'
import { socketService } from '@/lib/socket'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { room, event, data, message } = body

    if (!event) {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Event name is required'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (room) {
      socketService.broadcastToRoom(room, event, data || { message })
      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Message sent to room: ${room}`
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    } else {
      socketService.broadcastToAll(event, data || { message })
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Message broadcast to all users'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false,
        message: 'Failed to send message',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const room = searchParams.get('room')
    const limit = searchParams.get('limit')
    
    const messages = socketService.getMessages(
      room || undefined, 
      limit ? parseInt(limit) : undefined
    )
    
    return new Response(
      JSON.stringify({
        success: true,
        count: messages.length,
        messages,
        room: room || 'global'
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
    return new Response(
      JSON.stringify({ 
        success: false,
        message: 'Failed to get messages',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}