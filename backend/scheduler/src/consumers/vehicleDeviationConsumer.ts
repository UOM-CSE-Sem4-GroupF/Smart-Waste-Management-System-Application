import { Kafka, logLevel } from 'kafkajs';
import { VehicleDeviationEvent } from '../types';
import { getJobAssignment, vehicles } from '../db/queries';
import { notifyAlertDeviation } from '../clients/notificationClient';
import { getRoutePlanByJob } from '../db/queries';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'scheduler', message: msg }) + '\n');

function buildKafka() {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;
  return new Kafka({
    clientId: 'scheduler-deviation-handler',
    brokers,
    logLevel: logLevel.ERROR,
    ...(user && pass ? { sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass } } : {}),
  });
}

export async function handleVehicleDeviationEvent(event: VehicleDeviationEvent): Promise<void> {
  const { vehicle_id, job_id, deviation_metres, duration_seconds } = event.payload;

  const assignment = getJobAssignment(job_id);
  const vehicle    = vehicles.get(vehicle_id);
  const plan       = getRoutePlanByJob(job_id);
  if (!assignment || !vehicle) return;

  const vehicleName = vehicle.name ?? vehicle_id;

  await notifyAlertDeviation({
    vehicle_id,
    driver_id:        assignment.driver_id,
    job_id,
    zone_id:          plan?.zone_id ?? 0,
    deviation_metres,
    duration_seconds,
    message:          `${vehicleName} is ${Math.round(deviation_metres)}m off planned route`,
  });
}

export async function startVehicleDeviationConsumer(): Promise<void> {
  const kafka    = buildKafka();
  const consumer = kafka.consumer({ groupId: 'scheduler-deviation-handler' });

  await consumer.connect();
  await consumer.subscribe({ topic: 'waste.vehicle.deviation', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const event = JSON.parse(message.value.toString()) as VehicleDeviationEvent;
        await handleVehicleDeviationEvent(event);
      } catch (e) {
        slog('ERROR', `vehicle.deviation handler error: ${e}`);
      }
    },
  });

  slog('INFO', 'Consumer ready — waste.vehicle.deviation (scheduler-deviation-handler)');
}
