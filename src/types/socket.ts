import { Server as NetServer } from 'http'
import { NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'

export interface NextApiResponseServerIO extends NextApiResponse {
  socket: any & {
    server: NetServer & {
      io: ServerIO
    }
  }
} 