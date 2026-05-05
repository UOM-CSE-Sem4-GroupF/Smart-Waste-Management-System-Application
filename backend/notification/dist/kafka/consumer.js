"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
exports.startKafkaConsumer = startKafkaConsumer;
const kafkajs_1 = require("kafkajs");
const socket_1 = require("../socket");
const slog = (level, msg) => process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'notification', message: msg }) + '\n');
// Spec topics
const TOPICS = [
    'waste.bin.dashboard.updates', // Pre-enriched bin updates from bin-status
    'waste.vehicle.dashboard.updates', // Pre-enriched vehicle updates from scheduler
];
function buildKafka() {
    const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
    const user = process.env.KAFKA_USER;
    const pass = process.env.KAFKA_PASS;
    return new kafkajs_1.Kafka({
        clientId: 'notification-service',
        brokers,
        logLevel: kafkajs_1.logLevel.ERROR,
        ...(user && pass ? {
            sasl: { mechanism: 'scram-sha-256', username: user, password: pass },
        } : {}),
    });
}
function handle(topic, event, timestamp) {
    switch (topic) {
        case 'waste.bin.dashboard.updates': {
            const binEvent = event;
            const { event_type, payload } = binEvent;
            switch (event_type) {
                case 'bin:update': {
                    const binPayload = payload;
                    (0, socket_1.emitToRoom)(`dashboard-zone-${binPayload.zone_id}`, 'bin:update', { ...binPayload, timestamp });
                    (0, socket_1.emitToRoom)('dashboard-all', 'bin:update', { ...binPayload, timestamp });
                    break;
                }
                case 'zone:stats': {
                    const zonePayload = payload;
                    (0, socket_1.emitToRoom)(`dashboard-zone-${zonePayload.zone_id}`, 'zone:stats', { ...zonePayload, timestamp });
                    (0, socket_1.emitToRoom)('dashboard-all', 'zone:stats', { ...zonePayload, timestamp });
                    break;
                }
                case 'alert:urgent': {
                    const alertPayload = payload;
                    (0, socket_1.emitToRoom)(`dashboard-zone-${alertPayload.zone_id}`, 'alert:urgent', { ...alertPayload, timestamp });
                    (0, socket_1.emitToRoom)('dashboard-all', 'alert:urgent', { ...alertPayload, timestamp });
                    (0, socket_1.emitToRoom)('alerts-all', 'alert:urgent', { ...alertPayload, timestamp });
                    break;
                }
            }
            break;
        }
        case 'waste.vehicle.dashboard.updates': {
            const vehicleEvent = event;
            const { event_type, payload } = vehicleEvent;
            switch (event_type) {
                case 'vehicle:position': {
                    const posPayload = payload;
                    (0, socket_1.emitToRoom)(`dashboard-zone-${posPayload.zone_id}`, 'vehicle:position', { ...posPayload, timestamp });
                    (0, socket_1.emitToRoom)('dashboard-all', 'vehicle:position', { ...posPayload, timestamp });
                    (0, socket_1.emitToRoom)('fleet-ops', 'vehicle:position', { ...posPayload, timestamp });
                    break;
                }
                case 'job:progress': {
                    const jobPayload = payload;
                    (0, socket_1.emitToRoom)(`dashboard-zone-${jobPayload.zone_id}`, 'job:progress', { ...jobPayload, timestamp });
                    (0, socket_1.emitToRoom)('dashboard-all', 'job:progress', { ...jobPayload, timestamp });
                    break;
                }
            }
            break;
        }
    }
}
async function startKafkaConsumer() {
    const kafka = buildKafka();
    const consumer = kafka.consumer({ groupId: 'notification-vehicle-updates' });
    await consumer.connect();
    await consumer.subscribe({ topics: TOPICS, fromBeginning: false });
    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            if (!message.value)
                return;
            try {
                const envelope = JSON.parse(message.value.toString());
                const event = envelope;
                const timestamp = String(envelope.timestamp ?? new Date().toISOString());
                handle(topic, event, timestamp);
            }
            catch (e) {
                slog('ERROR', `Handler error on ${topic}: ${e instanceof Error ? e.message : String(e)}`);
                // Do not crash — continue consuming
            }
        },
    });
    slog('INFO', `Kafka consumer ready — subscribed to ${TOPICS.length} topics`);
}
