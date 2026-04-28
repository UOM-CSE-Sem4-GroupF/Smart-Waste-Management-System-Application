"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBinSocketServer = setBinSocketServer;
exports.emitBinUpdate = emitBinUpdate;
let io = null;
function setBinSocketServer(server) { io = server; }
function emitBinUpdate(room, event, data) {
    io?.to(room).emit(event, data);
}
//# sourceMappingURL=socket.js.map