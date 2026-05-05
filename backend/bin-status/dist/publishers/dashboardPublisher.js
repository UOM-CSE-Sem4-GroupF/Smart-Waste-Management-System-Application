"use strict";
/**
 * Dashboard Publisher — Publishes enriched events to waste.bin.dashboard.updates
 * This Kafka topic is consumed by the notification service and frontend
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishToDashboard = publishToDashboard;
exports.disconnectProducer = disconnectProducer;
const kafkajs_1 = require("kafkajs");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
});
let kafkaProducer = null;
async function getProducer() {
    if (!kafkaProducer) {
        const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092')
            .split(',')
            .map((b) => b.trim());
        const user = process.env.KAFKA_USER;
        const pass = process.env.KAFKA_PASS;
        const kafka = new kafkajs_1.Kafka({
            clientId: 'bin-status-service-publisher',
            brokers,
            logLevel: kafkajs_1.logLevel.ERROR,
            ...(user && pass
                ? {
                    sasl: { mechanism: 'scram-sha-256', username: user, password: pass },
                }
                : {}),
        });
        kafkaProducer = kafka.producer();
        await kafkaProducer.connect();
    }
    return kafkaProducer;
}
async function publishToDashboard(event) {
    try {
        const producer = await getProducer();
        const message = {
            key: event.payload.bin_id || event.payload.zone_id?.toString() || 'unknown',
            value: JSON.stringify(event),
            timestamp: new Date().getTime().toString(),
        };
        await producer.send({
            topic: 'waste.bin.dashboard.updates',
            messages: [message],
            timeout: 5000,
            compression: 1, // GZIP
        });
        logger.debug({ event_type: event.event_type, key: message.key }, 'Published to waste.bin.dashboard.updates');
    }
    catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error), event_type: event.event_type }, 'Failed to publish to dashboard topic');
        // Do not throw — log and continue
    }
}
async function disconnectProducer() {
    if (kafkaProducer) {
        await kafkaProducer.disconnect();
        kafkaProducer = null;
    }
}
//# sourceMappingURL=dashboardPublisher.js.map