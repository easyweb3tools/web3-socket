import { NextApiRequest } from 'next'
import { SocketIOResponse, socketService } from '@/lib/socket'

export default function handler(req: NextApiRequest, res: SocketIOResponse) {
  if (res.socket.server.io) {
    console.log('Socket.IO server already running')
  } else {
    console.log('Initializing Socket.IO server...')
    const io = socketService.initialize(res.socket.server)
    res.socket.server.io = io
    console.log('Socket.IO server initialized successfully')
  }
  
  res.end()
}

export const config = {
  api: {
    bodyParser: false,
  },
}