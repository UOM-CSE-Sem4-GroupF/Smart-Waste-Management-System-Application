"""
Direct host test - run this with Python directly (NOT in Docker).
Requires: pip install kafka-python
"""
import json
import uuid
from kafka import KafkaConsumer

BROKER = "a4a1f7d85b2974282881bef8432350e7-ef5d86e442d3945a.elb.eu-north-1.amazonaws.com:9094"
USER = "user1"
PASS = "Ajkv0XR2Io"
TOPIC = "waste.bin.telemetry"
GROUP = f"test-{uuid.uuid4().hex[:6]}"

print(f"Connecting to {BROKER} as group '{GROUP}'...")
print(f"Topic: {TOPIC}")

consumer = KafkaConsumer(
    TOPIC,
    bootstrap_servers=[BROKER],
    security_protocol="SASL_PLAINTEXT",
    sasl_mechanism="SCRAM-SHA-256",
    sasl_plain_username=USER,
    sasl_plain_password=PASS,
    auto_offset_reset='earliest',
    group_id=GROUP,
    value_deserializer=lambda v: json.loads(v.decode('utf-8')),
    api_version=(2, 5, 0),
    consumer_timeout_ms=30000,  # Stop after 30s of no messages
)

print("Connected! Waiting for messages (30s timeout)...")

count = 0
for message in consumer:
    count += 1
    print(f"\n--- Message #{count} ---")
    print(f"Partition: {message.partition}, Offset: {message.offset}")
    print(json.dumps(message.value, indent=2))
    if count >= 5:
        print("\nGot 5 messages. Pipeline is WORKING!")
        break

if count == 0:
    print("No messages received after 30 seconds.")

consumer.close()
