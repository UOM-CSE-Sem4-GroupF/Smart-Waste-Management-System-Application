"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSocketServer = setSocketServer;
exports.emitToRoom = emitToRoom;
exports.emitToAll = emitToAll;
exports.findConnectedSocket = findConnectedSocket;
exports.getSocketServer = getSocketServer;
let io = null;
function setSocketServer(server) { io = server; }
function emitToRoom(room, event, data) {
    io?.to(room).emit(event, data);
}
function emitToAll(event, data) {
    io?.emit(event, data);
}
/**
 * Check if a specific user (by socket ID or driver ID) is currently connected.
 * Returns the socket ID if found, otherwise null.
 */
function findConnectedSocket(predicate) {
    if (!io)
        return null;
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
function getSocketServer() {
    return io;
}
