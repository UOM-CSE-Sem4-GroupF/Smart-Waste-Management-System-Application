import { Server as SocketServer } from 'socket.io';

let io: SocketServer | null = null;

export function setSocketServer(server: SocketServer): void { io = server; }

export function emitToRoom(room: string, event: string, data: unknown): void {
  io?.to(room).emit(event, data);
}

export function emitToAll(event: string, data: unknown): void {
  io?.emit(event, data);
}
