#!/usr/bin/env python3
"""
Kafka bridge for the Fastify backend.
Uses direct partition assignment (group_id=None) to bypass the KRaft
coordinator, which is not reachable from outside the cluster.
Outputs one JSON line per message to stdout so the Node.js parent can parse it.
"""
import os, sys, json, logging
from dotenv import load_dotenv
from kafka import KafkaConsumer, TopicPartition

logging.getLogger("kafka").setLevel(logging.CRITICAL)

load_dotenv()

BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
USER   = os.getenv("KAFKA_USER")
PASS   = os.getenv("KAFKA_PASS")

TOPICS = [
    "waste.bin.telemetry",
    "waste.bin.processed",
    "waste.bin.status.changed",
    "waste.collection.jobs",
    "waste.routes.optimized",
    "waste.job.completed",
    "waste.zone.statistics",
    "waste.vehicle.location",
]

try:
    consumer = KafkaConsumer(
        bootstrap_servers=[BROKER],
        security_protocol="SASL_PLAINTEXT",
        sasl_mechanism="SCRAM-SHA-256",
        sasl_plain_username=USER,
        sasl_plain_password=PASS,
        group_id=None,
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        api_version=(2, 5, 0),
    )

    tps = [TopicPartition(t, 0) for t in TOPICS]
    consumer.assign(tps)
    for tp in tps:
        consumer.seek_to_end(tp)

    print(json.dumps({"status": "ready"}), flush=True)

    for message in consumer:
        line = json.dumps({"topic": message.topic, "payload": message.value})
        print(line, flush=True)

except Exception as e:
    print(json.dumps({"status": "error", "error": str(e)}), flush=True)
    sys.exit(1)
