import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface UseWebSocketProps {
  connectionId: string
  onConnect?: () => void
  onDisconnect?: () => void
  onMessage?: (data: any) => void
}

export function useWebSocket({ connectionId, onConnect, onDisconnect, onMessage }: UseWebSocketProps) {
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!connectionId) return

    // Connect to the WebSocket server
    const socket = io(window.location.origin, {
      query: { connectionId }
    })

    // Set up event listeners
    socket.on('connect', () => {
      setIsConnected(true)
      onConnect?.()
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      onDisconnect?.()
    })

    socket.on('message', (data) => {
      onMessage?.(data)
    })

    socketRef.current = socket

    // Cleanup on unmount
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [connectionId, onConnect, onDisconnect, onMessage])

  const sendMessage = (data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message', data)
      return true
    }
    return false
  }

  return {
    isConnected,
    sendMessage
  }
} 