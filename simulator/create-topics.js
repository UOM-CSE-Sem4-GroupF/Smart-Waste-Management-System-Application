#!/usr/bin/env node
'use strict';

const { Kafka, logLevel } = require('kafkajs');

const BROKER     = process.env.KAFKA_BROKER || '163.47.8.3:9094';
const KAFKA_USER = process.env.KAFKA_USER   || 'user1';
const KAFKA_PASS = process.env.KAFKA_PASS   || 'QA7aKGtPHV';

const TOPICS = [
  { topic: 'waste.bin.telemetry',            numPartitions: 1, replicationFactor: 1 },
  { topic: 'waste.bin.processed',            numPartitions: 3, replicationFactor: 1 },
  { topic: 'waste.bin.dashboard.updates',    numPartitions: 3, replicationFactor: 1 },
  { topic: 'waste.vehicle.location',         numPartitions: 3, replicationFactor: 1 },
  { topic: 'waste.vehicle.deviation',        numPartitions: 3, replicationFactor: 1 },
  { topic: 'waste.vehicle.dashboard.updates',numPartitions: 3, replicationFactor: 1 },
  { topic: 'waste.routine.schedule.trigger', numPartitions: 3, replicationFactor: 1 },
  { topic: 'waste.job.completed',            numPartitions: 3, replicationFactor: 1 },
  { topic: 'waste.driver.responses',         numPartitions: 3, replicationFactor: 1 },
  { topic: 'waste.audit.events',             numPartitions: 3, replicationFactor: 1 },
];

async function main() {
  const kafka = new Kafka({
    clientId: 'topic-admin',
    brokers:  [BROKER],
    logLevel: logLevel.ERROR,
    ...(KAFKA_USER && KAFKA_PASS
      ? { sasl: { mechanism: 'scram-sha-256', username: KAFKA_USER, password: KAFKA_PASS } }
      : {}),
  });

  const admin = kafka.admin();
  await admin.connect();
  console.log(`Connected to ${BROKER}`);

  const existing = await admin.listTopics();
  console.log(`Existing topics: ${existing.length > 0 ? existing.join(', ') : '(none)'}`);

  const toCreate = TOPICS.filter(t => !existing.includes(t.topic));

  if (toCreate.length === 0) {
    console.log('All topics already exist — nothing to do.');
  } else {
    await admin.createTopics({ topics: toCreate, waitForLeaders: true });
    toCreate.forEach(t => console.log(`  Created: ${t.topic} (${t.numPartitions} partitions)`));
  }

  await admin.disconnect();
  console.log('Done.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
