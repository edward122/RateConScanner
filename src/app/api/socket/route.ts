import { Server } from 'socket.io'
import { NextApiRequest } from 'next'
import { NextApiResponseServerIO } from '@/types/socket'

const connections = new Map<string, Set<string>>()

export default function SocketHandler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server)
    res.socket.server.io = io

    io.on('connection', (socket) => {
      const { connectionId } = socket.handshake.query

      if (typeof connectionId !== 'string') {
        socket.disconnect()
        return
      }

      // Add this socket to the connection group
      if (!connections.has(connectionId)) {
        connections.set(connectionId, new Set())
      }
      connections.get(connectionId)?.add(socket.id)

      // Forward messages to all sockets in the same connection group
      socket.on('message', (data) => {
        const group = connections.get(connectionId)
        if (group) {
          for (const socketId of group) {
            if (socketId !== socket.id) {
              io.to(socketId).emit('message', data)
            }
          }
        }
      })

      // Clean up on disconnect
      socket.on('disconnect', () => {
        const group = connections.get(connectionId)
        if (group) {
          group.delete(socket.id)
          if (group.size === 0) {
            connections.delete(connectionId)
          }
        }
      })
    })
  }

  res.end()
} 