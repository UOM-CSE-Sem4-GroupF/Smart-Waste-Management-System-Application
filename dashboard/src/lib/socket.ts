import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(token: string): Socket {
  if (socket?.connected) return socket

  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
    auth: { token },                      // Keycloak JWT — required
    path: '/ws/socket.io',                // Kong routes /ws → notification-service
    transports: ['websocket', 'polling'], // websocket first, polling fallback
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  })

  socket.on('connect_error', (err) => {
    console.error('[Socket.IO] connect error:', err.message)
  })

  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__socket = { get: () => socket }
}
