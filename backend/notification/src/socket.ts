import { Server as SocketServer } from 'socket.io';

let io: SocketServer | null = null;

export function setSocketServer(server: SocketServer): void { io = server; }

export function emitToRoom(room: string, event: string, data: unknown): void {
  io?.to(room).emit(event, data);
}

export function emitToAll(event: string, data: unknown): void {
  io?.emit(event, data);
}

/**
 * Check if a specific user (by socket ID or driver ID) is currently connected.
 * Returns the socket ID if found, otherwise null.
 */
export function findConnectedSocket(predicate: (socket: any) => boolean): string | null {
  if (!io) return null;
  for (const [socketId, socket] of io.of('/').sockets) {
    if (predicate(socket)) {
      return socketId;
    }
  }
  return null;
}

/**
 * Get the Socket.IO server instance (for testing/direct manipulation).
 */
export function getSocketServer(): SocketServer | null {
  return io;
}

