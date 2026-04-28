"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const pino_1 = __importDefault(require("pino"));
const socket_io_1 = require("socket.io");
const bins_1 = __importDefault(require("./routes/bins"));
const zones_1 = __importDefault(require("./routes/zones"));
const internal_1 = __importDefault(require("./routes/internal"));
const socket_1 = require("./socket");
const consumer_1 = require("./kafka/consumer");
const SERVICE = 'bin-status-service';
const VERSION = '1.0.0';
const logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
});
async function start() {
    const app = (0, fastify_1.default)({
        logger: false, // We'll use pino directly
    });
    await app.register(helmet_1.default, { contentSecurityPolicy: false });
    await app.register(cors_1.default, { origin: '*' });
    // Health check
    app.get('/health', async () => ({
        status: 'ok',
        service: SERVICE,
        version: VERSION,
        timestamp: new Date().toISOString(),
    }));
    // Register routes
    await app.register(bins_1.default);
    await app.register(zones_1.default);
    await app.register(internal_1.default);
    // Start server
    const PORT = Number(process.env.PORT ?? 3002);
    const HOST = process.env.HOST ?? '0.0.0.0';
    await app.listen({ port: PORT, host: HOST });
    logger.info(`${SERVICE} v${VERSION} listening on ${HOST}:${PORT}`);
    // Setup Socket.IO
    const io = new socket_io_1.Server(app.server, {
        cors: { origin: '*' },
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        pingTimeout: 20000,
        pingInterval: 10000,
    });
    (0, socket_1.setBinSocketServer)(io);
    io.on('connection', (socket) => {
        logger.debug({ client_id: socket.id }, 'Socket.IO client connected');
        socket.on('join', (rooms) => {
            if (!Array.isArray(rooms))
                return;
            rooms.forEach((room) => socket.join(room));
            logger.debug({ client_id: socket.id, rooms }, 'Socket.IO client joined rooms');
        });
        socket.on('leave', (rooms) => {
            if (!Array.isArray(rooms))
                return;
            rooms.forEach((room) => socket.leave(room));
            logger.debug({ client_id: socket.id, rooms }, 'Socket.IO client left rooms');
        });
        socket.on('disconnect', () => {
            logger.debug({ client_id: socket.id }, 'Socket.IO client disconnected');
        });
        socket.on('error', (error) => {
            logger.error({ client_id: socket.id, error }, 'Socket.IO error');
        });
    });
    // Start Kafka consumer
    try {
        await (0, consumer_1.startKafkaConsumer)();
        logger.info('Kafka consumers started successfully');
    }
    catch (error) {
        logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Kafka consumer failed to start — running without live bin data');
    }
}
start().catch((error) => {
    logger.error(error, 'Failed to start service');
    process.exit(1);
});
//# sourceMappingURL=index.js.map