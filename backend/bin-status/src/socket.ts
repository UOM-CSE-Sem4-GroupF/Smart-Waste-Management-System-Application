import { Server as SocketServer } from 'socket.io';

let io: SocketServer | null = null;

export function setBinSocketServer(server: SocketServer): void { io = server; }

export function emitBinUpdate(room: string, event: string, data: unknown): void {
  io?.to(room).emit(event, data);
}
