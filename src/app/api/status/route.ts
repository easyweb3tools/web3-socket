import { NextRequest } from 'next/server'
import { socketService } from '@/lib/socket'

export async function GET(req: NextRequest) {
  try {
    const status = socketService.getServerStatus()
    
    console.log('Status API called:', status)
    
    return new Response(
      JSON.stringify(status),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    console.error('Status API error:', error)
    return new Response(
      JSON.stringify({ 
        status: 'error',
        message: 'Failed to get server status',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}