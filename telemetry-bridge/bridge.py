#!/usr/bin/env python3
"""
Telemetry bridge — consumes waste.bin.telemetry with direct partition assignment
(no consumer group, bypassing the KRaft controller FindCoordinator issue) and
forwards each message to the bin-status and notification services via HTTP.
"""
import os, json, logging, time
import requests
from kafka import KafkaConsumer, TopicPartition

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger("telemetry-bridge")
logging.getLogger("kafka").setLevel(logging.WARNING)
logging.getLogger("kafka.conn").setLevel(logging.CRITICAL)

BROKER           = os.environ["KAFKA_BROKER"]
USER             = os.environ.get("KAFKA_USER")
PASS             = os.environ.get("KAFKA_PASS")
TOPIC            = os.environ.get("KAFKA_TOPIC", "waste.bin.telemetry")
BIN_STATUS_URL   = os.environ.get("BIN_STATUS_URL",   "http://bin-status:3002")
NOTIFICATION_URL = os.environ.get("NOTIFICATION_URL", "http://notification:3004")

def make_consumer():
    kwargs = dict(
        bootstrap_servers=[BROKER],
        group_id=None,
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        api_version=(2, 5, 0),
        request_timeout_ms=10000,
        connections_max_idle_ms=30000,
    )
    if USER and PASS:
        kwargs.update(
            security_protocol="SASL_PLAINTEXT",
            sasl_mechanism="SCRAM-SHA-256",
            sasl_plain_username=USER,
            sasl_plain_password=PASS,
        )
    consumer = KafkaConsumer(**kwargs)
    tp = TopicPartition(TOPIC, 0)
    consumer.assign([tp])
    consumer.seek_to_end(tp)
    return consumer

def post(url, body):
    try:
        requests.post(url, json=body, timeout=2)
    except Exception as e:
        log.warning(f"POST {url} failed: {e}")

def run():
    log.info(f"Connecting to {BROKER}, topic={TOPIC}")
    while True:
        try:
            consumer = make_consumer()
            log.info("Ready — waiting for messages")
            for msg in consumer:
                raw = msg.value
                # Support both envelope ({payload: {...}}) and flat formats
                body = raw.get("payload", raw)
                if isinstance(raw, dict) and "timestamp" not in body:
                    body["timestamp"] = raw.get("timestamp")

                post(f"{BIN_STATUS_URL}/internal/bins/ingest",       body)
                post(f"{NOTIFICATION_URL}/internal/notify/bin-update", body)
        except Exception as e:
            log.error(f"Consumer error: {e} — retrying in 5s")
            time.sleep(5)

if __name__ == "__main__":
    run()
