# Kafka Debugging Notes — 2026-04-26

## Broker

- **Endpoint:** `a2124eca3295942ebbecfa3ea783693d-fc2f125c6004ef47.elb.eu-north-1.amazonaws.com:9094`
- **Auth:** SASL_PLAINTEXT / SCRAM-SHA-256, user `user1`
- **Brokers in cluster:** 2
  - Broker 100 — NLB endpoint (externally reachable, controller)
  - Broker 0 — `controller.internal:9094` (internal only, not reachable from outside the cluster)

### Broker 0 Issue

Partitions led by broker 0 show `isrs: 0` from outside the cluster, meaning they are unreachable externally. Any produce/consume targeting those partitions will fail with `Local: Broker transport failure`. Only partitions led by broker 100 are accessible.

**Workaround:** Drop the `-X broker.address.family=v4` flag and specify partitions explicitly with `-p <n>`.

---

## Topics

13 topics registered in the cluster:

| Topic | Partitions |
|-------|-----------|
| `waste.bin.telemetry` | 1 |
| `waste.bin.processed` | 6 |
| `waste.bin.status.changed` | 3 |
| `waste.collection.jobs` | 3 |
| `waste.job.completed` | 3 |
| `waste.routes.optimized` | 3 |
| `waste.routine.schedule.trigger` | 3 |
| `waste.vehicle.location` | 6 |
| `waste.vehicle.deviation` | 3 |
| `waste.driver.responses` | 3 |
| `waste.zone.statistics` | 3 |
| `waste.audit.events` | 3 |
| `waste.model.retrained` | 3 |

---

## waste.bin.telemetry — Active

- **Partitions:** 1 (partition 0, leader broker 100 — fully accessible)
- **Offset:** 225,031+ and growing
- **Source:** `emqx-oss-bridge`
- **Status: Data flowing normally**

Messages arrive approximately every second from 10 active bins (BIN-001 to BIN-010).

### Message Structure

```json
{
  "version": "1.0-bridge",
  "source_service": "emqx-oss-bridge",
  "timestamp": 1777180828512,
  "payload": {
    "bin_id": "BIN-001",
    "fill_level_pct": 89.03,
    "battery_level_pct": 88.4,
    "signal_strength_dbm": -78,
    "temperature_c": 26.4,
    "timestamp": "2026-04-26T05:20:28Z",
    "firmware_version": "2.1.4",
    "error_flags": 0
  }
}
```

### Bin Fill Levels Observed (sample)

| Bin | Fill Level | Status |
|-----|-----------|--------|
| BIN-001 | ~89% | Urgent |
| BIN-004 | ~83% | Urgent |
| BIN-007 | ~82% | Urgent |
| BIN-010 | ~83% | Urgent |
| BIN-002 | ~77% | Urgent |
| BIN-005 | ~44% | Normal |
| BIN-006 | ~39% | Normal |
| BIN-008 | ~29% | Normal |
| BIN-009 | ~36% | Normal |
| BIN-003 | ~10% | Normal |

`error_flags: 1` observed on BIN-004 and BIN-010 in some messages.

---

## waste.bin.processed — Empty

- **Partitions:** 6 (partitions 0, 2, 5 on broker 100; partitions 1, 3, 4 on broker 0)
- **Offset on all accessible partitions:** 0 (no messages ever written)
- **Status: Empty — Flink (F2) is not publishing**

### Root Cause

Flink stream processor (F2) does not appear to be running or deployed. It is responsible for consuming `waste.bin.telemetry`, enriching the data (urgency scores, weight calculations), and publishing to `waste.bin.processed`. Since the topic is empty, none of this processing is happening.

### Impact

The following downstream services are starved of data:
- Collection workflow orchestrator (F3) — reads `waste.bin.processed`
- Any service depending on urgency scores or processed bin state

---

## Pipeline Summary

```
simulator → EMQX → waste.bin.telemetry  ✓ (active, 225k+ messages)
                         |
                      Flink F2           ✗ (not running)
                         |
                  waste.bin.processed    ✗ (empty, offset 0)
                         |
              Collection orchestrator F3  ✗ (starved)
```

---

## Action Required

Check whether the Flink (F2) service has been deployed to the Kubernetes cluster (`messaging` namespace or equivalent). The raw telemetry pipeline is healthy — the bottleneck is entirely at the Flink processing layer.
