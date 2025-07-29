import { NextRequest } from 'next/server'
import { Server as NetServer } from 'http'
import { Server as ServerIO } from 'socket.io'
import { socketService } from '@/lib/socket'

export interface SocketIOServer extends NetServer {
  io?: ServerIO
}

export async function GET(req: NextRequest) {
  // This endpoint is used to initialize Socket.IO server
  return new Response(
    JSON.stringify({ 
      message: 'Socket.IO server endpoint', 
      path: '/api/socket/io',
      status: 'ready' 
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}