import { Server as SocketServer } from 'socket.io';

let io: SocketServer | null = null;

export function setSocketServer(server: SocketServer): void { io = server; }

export function getSocketServer(): SocketServer | null { return io; }

export function emitToRoom(room: string, event: string, data: unknown): void {
  io?.to(room).emit(event, data);
}

export function emitToRooms(rooms: string[], event: string, data: unknown): void {
  if (!io || rooms.length === 0) return;
  io.to(rooms).emit(event, data);
}

export function emitToAll(event: string, data: unknown): void {
  io?.emit(event, data);
}

export async function isDriverConnected(driverId: string): Promise<boolean> {
  if (!io) return false;
  const sockets = await io.in(`driver-${driverId}`).fetchSockets();
  return sockets.length > 0;
}
