"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const internal_1 = __importDefault(require("./routes/internal"));
const collections_1 = __importDefault(require("./routes/collections"));
const vehicles_1 = __importDefault(require("./routes/vehicles"));
const drivers_1 = __importDefault(require("./routes/drivers"));
const consumer_1 = require("./kafka/consumer");
const SERVICE = 'scheduler-service';
const VERSION = '1.0.0';
const slog = (level, msg) => process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: SERVICE, message: msg }) + '\n');
async function start() {
    const app = (0, fastify_1.default)({ logger: false });
    await app.register(helmet_1.default, { contentSecurityPolicy: false });
    await app.register(cors_1.default, { origin: '*' });
    app.get('/health', async () => ({ status: 'ok', service: SERVICE, version: VERSION }));
    await app.register(internal_1.default);
    await app.register(collections_1.default);
    await app.register(vehicles_1.default);
    await app.register(drivers_1.default);
    const PORT = Number(process.env.PORT ?? 3003);
    await app.listen({ port: PORT, host: '0.0.0.0' });
    slog('INFO', `Listening on :${PORT}`);
    (0, consumer_1.startKafkaConsumer)().catch(err => slog('WARN', `Kafka unavailable — running without live vehicle positions: ${err.message}`));
}
start().catch(err => { console.error(err); process.exit(1); });
