"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const redis_1 = require("redis");
const internal_1 = __importDefault(require("./routes/internal"));
const socket_1 = require("./socket");
const consumer_1 = require("./kafka/consumer");
const auth_1 = require("./auth");
const fcm_1 = require("./fcm");
const SERVICE = 'notification-service';
const VERSION = '1.0.0';
const slog = (level, msg) => process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: SERVICE, message: msg }) + '\n');
async function start() {
    const app = (0, fastify_1.default)({ logger: false });
    await app.register(helmet_1.default, { contentSecurityPolicy: false });
    await app.register(cors_1.default, { origin: '*' });
    app.get('/health', async () => ({ status: 'ok', service: SERVICE, version: VERSION }));
    await app.register(internal_1.default);
    const PORT = Number(process.env.PORT ?? 3004);
    await app.listen({ port: PORT, host: '0.0.0.0' });
    slog('INFO', `Listening on :${PORT}`);
    // Attach Socket.IO to the same Fastify HTTP server
    const io = new socket_io_1.Server(app.server, {
        cors: { origin: '*' },
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        pingTimeout: 20000,
        pingInterval: 10000,
    });
    // Add Redis adapter if REDIS_URL is set (for multi-pod scaling)
    if (process.env.REDIS_URL) {
        try {
            const pubClient = (0, redis_1.createClient)({ url: process.env.REDIS_URL });
            const subClient = pubClient.duplicate();
            await Promise.all([pubClient.connect(), subClient.connect()]);
            io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
            slog('INFO', 'Redis adapter connected for multi-pod Socket.IO sync');
        }
        catch (error) {
            slog('WARN', `Redis adapter failed (single-pod mode): ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // JWT authentication middleware
    io.use(async (socket, next) => {
        const token = (0, auth_1.extractToken)(socket.handshake);
        if (!token) {
            return next(new Error('Authentication required'));
        }
        try {
            const decoded = (0, auth_1.verifyKeycloakToken)(token);
            socket.data.userId = decoded.sub;
            socket.data.role = (0, auth_1.getRole)(decoded);
            socket.data.zoneId = decoded.zone_id;
            socket.data.driverId = decoded.driver_id;
            next();
        }
        catch (error) {
            next(new Error(`Invalid token: ${error instanceof Error ? error.message : String(error)}`));
        }
    });
    // Auto room assignment on connection based on role
    io.on('connection', (socket) => {
        slog('INFO', `Client connected: ${socket.id} (user: ${socket.data.userId}, role: ${socket.data.role})`);
        const { role, zoneId, driverId } = socket.data;
        // Auto-join rooms based on role
        switch (role) {
            case 'supervisor':
                socket.join('dashboard-all');
                if (zoneId)
                    socket.join(`dashboard-zone-${zoneId}`);
                socket.join('alerts-all');
                slog('INFO', `${socket.id} (supervisor) joined dashboard-all, dashboard-zone-${zoneId}, alerts-all`);
                break;
            case 'fleet-operator':
                socket.join('dashboard-all');
                socket.join('fleet-ops');
                socket.join('alerts-all');
                slog('INFO', `${socket.id} (fleet-operator) joined dashboard-all, fleet-ops, alerts-all`);
                break;
            case 'driver':
                if (driverId) {
                    socket.join(`driver-${driverId}`);
                    slog('INFO', `${socket.id} (driver: ${driverId}) joined driver-${driverId}`);
                }
                break;
            case 'viewer':
            default:
                socket.join('dashboard-all');
                slog('INFO', `${socket.id} (${role}) joined dashboard-all`);
                break;
        }
        // Allow manual room join/leave for flexibility
        socket.on('join', (rooms) => {
            if (!Array.isArray(rooms))
                return;
            rooms.forEach(room => socket.join(room));
            slog('INFO', `${socket.id} manually joined rooms: ${rooms.join(', ')}`);
        });
        socket.on('leave', (rooms) => {
            if (!Array.isArray(rooms))
                return;
            rooms.forEach(room => socket.leave(room));
            slog('INFO', `${socket.id} manually left rooms: ${rooms.join(', ')}`);
        });
        socket.on('disconnect', () => slog('INFO', `Client disconnected: ${socket.id}`));
    });
    (0, socket_1.setSocketServer)(io);
    // Initialize Firebase for FCM
    (0, fcm_1.initFirebase)();
    (0, consumer_1.startKafkaConsumer)().catch(err => slog('WARN', `Kafka unavailable — Socket.IO alerts from Kafka disabled: ${err.message}`));
}
start().catch(err => { console.error(err); process.exit(1); });
