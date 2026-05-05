const { Kafka } = require('kafkajs');
const kafka = new Kafka({ clientId: 'test', brokers: ['163.47.8.3:9094'] });
const admin = kafka.admin();

async function test() {
  await admin.connect();
  // In KafkaJS v2, the cluster might be accessible on the admin object if we are lucky
  // Or we can check where it is stored.
  console.log('Admin keys:', Object.keys(admin));
  const cluster = (admin as any).cluster;
  if (cluster) {
     console.log('Found cluster on admin!');
  } else {
     console.log('Cluster not found on admin.');
  }
  await admin.disconnect();
}
test();
