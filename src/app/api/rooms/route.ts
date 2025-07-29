import { NextRequest } from 'next/server'
import { socketService } from '@/lib/socket'

export async function GET(req: NextRequest) {
  try {
    const rooms = socketService.getRooms()
    
    return new Response(
      JSON.stringify({
        success: true,
        count: rooms.length,
        rooms: rooms.map(room => ({
          id: room.id,
          name: room.name,
          createdAt: room.createdAt,
          userCount: room.userCount,
          users: room.users
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
    return new Response(
      JSON.stringify({ 
        success: false,
        message: 'Failed to get rooms',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}