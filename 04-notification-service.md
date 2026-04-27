# Technical Specification — Notification Service
**Owner:** F3  
**Repo:** group-f-application/notification-service  
**Version:** 1.0  
**Stack:** Node.js 20 · TypeScript · Fastify · Socket.IO · KafkaJS · Firebase Admin SDK · Redis (Socket.IO adapter)

---

## 1. Purpose

The notification service owns all real-time connections to clients. It is a pure delivery layer — it never enriches data, never makes business decisions, and never queries domain databases. It receives pre-enriched payloads from domain services and delivers them to the right clients via Socket.IO (dashboard) or FCM push (Flutter app).

---

## 2. Context in the system

```
waste.bin.dashboard.updates  ──► Notification service ──► Socket.IO ──► Next.js dashboard
waste.vehicle.dashboard.updates ──►                    └──► FCM ──────► Flutter app

Orchestrator  ──► POST /internal/notify/job-created
              ──► POST /internal/notify/job-escalated
              ──► POST /internal/notify/job-completed
              ──► POST /internal/notify/job-cancelled

Scheduler     ──► POST /internal/notify/job-assigned
              ──► POST /internal/notify/vehicle-position
              ──► POST /internal/notify/alert-deviation

Bin service   ──► (via Kafka waste.bin.dashboard.updates)
```

---

## 3. Responsibilities

- Maintain Socket.IO connections from all dashboard clients
- Maintain Socket.IO connections from all Flutter driver clients
- Consume `waste.bin.dashboard.updates` → emit to dashboard rooms
- Consume `waste.vehicle.dashboard.updates` → emit to dashboard rooms
- Receive HTTP calls from orchestrator and scheduler → deliver to correct clients
- Send FCM push notifications to Flutter app when driver is not connected

---

## 4. Socket.IO setup

### Redis adapter — required for multi-pod scaling

```typescript
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'

const pubClient = createClient({ url: process.env.REDIS_URL })
const subClient = pubClient.duplicate()

await Promise.all([pubClient.connect(), subClient.connect()])

io.adapter(createAdapter(pubClient, subClient))
```

Without Redis adapter, a client connected to pod A cannot receive events emitted on pod B. The Redis adapter synchronises all pods so any pod can emit to any connected client.

### Kong sticky session config (F4 responsibility)

F4 must configure Kong to route WebSocket connections from the same client to the same pod:

```yaml
# Kong plugin for notification service route
plugins:
  - name: session
    config:
      cookie_name: NGSESSIONID
      storage: cookie
      cookie_samesite: Strict
```

### Connection authentication

Every Socket.IO connection must include a valid Keycloak JWT:

```typescript
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token
    || socket.handshake.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return next(new Error('Authentication required'))
  }

  try {
    const decoded = await verifyKeycloakToken(token)
    socket.data.userId = decoded.sub
    socket.data.role = decoded.realm_access.roles[0]
    socket.data.zoneId = decoded.zone_id     // from Keycloak custom attribute
    socket.data.driverId = decoded.driver_id // from Keycloak custom attribute
    next()
  } catch {
    next(new Error('Invalid token'))
  }
})
```

---

## 5. Room structure

```typescript
// On connection — automatically join appropriate rooms based on role

io.on('connection', (socket) => {

  const { role, zoneId, driverId } = socket.data

  switch (role) {
    case 'supervisor':
      socket.join('dashboard-all')
      socket.join(`dashboard-zone-${zoneId}`)
      socket.join('alerts-all')
      break

    case 'fleet-operator':
      socket.join('dashboard-all')
      socket.join('fleet-ops')
      socket.join('alerts-all')
      break

    case 'driver':
      socket.join(`driver-${driverId}`)
      break

    case 'viewer':
      socket.join('dashboard-all')
      break
  }
})
```

---

## 6. Kafka consumers

### 6.1 Bin dashboard updates consumer

**Topic:** `waste.bin.dashboard.updates`  
**Group ID:** `notification-bin-updates`

```typescript
interface DashboardUpdateEvent {
  event_type: 'bin:update' | 'zone:stats' | 'alert:urgent'
  payload: BinUpdatePayload | ZoneStatsPayload | AlertPayload
  // pre-enriched by bin-status-service — no processing needed here
}
```

**Processing — zero business logic:**

```typescript
consumer.on('message', async (event) => {
  const { event_type, payload } = event

  switch (event_type) {

    case 'bin:update':
      // Route to zone-specific and all-zones rooms
      io.to(`dashboard-zone-${payload.zone_id}`)
        .to('dashboard-all')
        .emit('bin:update', payload)
      break

    case 'zone:stats':
      io.to(`dashboard-zone-${payload.zone_id}`)
        .to('dashboard-all')
        .emit('zone:stats', payload)
      break

    case 'alert:urgent':
      io.to(`dashboard-zone-${payload.zone_id}`)
        .to('dashboard-all')
        .to('alerts-all')
        .emit('alert:urgent', payload)
      break
  }
})
```

---

### 6.2 Vehicle dashboard updates consumer

**Topic:** `waste.vehicle.dashboard.updates`  
**Group ID:** `notification-vehicle-updates`

```typescript
interface VehicleUpdateEvent {
  event_type: 'vehicle:position' | 'job:progress'
  payload: VehiclePositionPayload | JobProgressPayload
  // pre-enriched by scheduler-service — no processing needed here
}
```

**Processing:**

```typescript
consumer.on('message', async (event) => {
  const { event_type, payload } = event

  switch (event_type) {

    case 'vehicle:position':
      io.to(`dashboard-zone-${payload.zone_id}`)
        .to('dashboard-all')
        .to('fleet-ops')
        .emit('vehicle:position', payload)
      break

    case 'job:progress':
      io.to(`dashboard-zone-${payload.zone_id}`)
        .to('dashboard-all')
        .emit('job:progress', payload)
      break
  }
})
```

---

## 7. Internal HTTP API

All routes are cluster-internal — not exposed via Kong.

### POST /internal/notify/job-assigned

Called by scheduler when driver is dispatched.

**Request body:**
```typescript
{
  driver_id: string
  vehicle_id: string
  job_id: string
  job_type: 'routine' | 'emergency'
  clusters: Array<{ cluster_id, cluster_name, address }>
  route: Array<{
    sequence: number
    cluster_id: string
    cluster_name: string
    lat: number
    lng: number
    bins: string[]
    estimated_arrival: string
  }>
  estimated_duration_min: number
  planned_weight_kg: number
  total_bins: number
}
```

**Processing:**

```
1. Emit via Socket.IO to driver-{driver_id} room:
   Event: job:assigned
   Payload: full request body

2. If driver is not connected to Socket.IO:
   Send FCM push notification:
   Title: "New collection job assigned"
   Body: "You have a new ${job_type} collection — ${total_bins} bins"
   Data: { job_id, job_type, screen: 'job-detail' }
   Token: load driver's fcm_token from Keycloak user attributes
```

---

### POST /internal/notify/job-created

Called by orchestrator after successful dispatch — notifies dashboard.

**Request body:**
```typescript
{
  job_id: string
  job_type: 'routine' | 'emergency'
  zone_id: number
  zone_name: string
  clusters: string[]
  vehicle_id: string
  driver_id: string
  total_bins: number
  planned_weight_kg: number
  priority: number
  route: Array<{
    sequence: number
    cluster_id: string
    cluster_name: string
    lat: number
    lng: number
    bins: string[]
    estimated_arrival: string
  }>
}
```

**Processing:**

```
Emit to: dashboard-zone-{zone_id}, dashboard-all, fleet-ops
Event: job:created
Payload: full request body
(Dashboard adds new job card + draws route polyline on map)
```

---

### POST /internal/notify/job-completed

Called by orchestrator when job reaches COMPLETED state.

**Request body:**
```typescript
{
  job_id: string
  zone_id: number
  vehicle_id: string
  driver_id: string
  bins_collected: number
  bins_skipped: number
  actual_weight_kg: number
  duration_minutes: number
  hyperledger_tx_id: string | null
}
```

**Processing:**

```
1. Emit to dashboard:
   Event: job:completed
   Rooms: dashboard-zone-{zone_id}, dashboard-all, fleet-ops
   (Dashboard moves job card from active to completed panel)

2. Emit to driver:
   Event: job:completed
   Room: driver-{driver_id}
   Payload: { job_id, message: "Job complete. Well done!" }

3. Optional FCM to driver if disconnected
```

---

### POST /internal/notify/job-escalated

Called by orchestrator when no vehicle can be found.

**Request body:**
```typescript
{
  job_id: string
  zone_id: number
  reason: string
  urgent_bins: Array<{ bin_id, urgency_score, predicted_full_at }>
  total_weight_kg: number
}
```

**Processing:**

```
Emit to: dashboard-zone-{zone_id}, dashboard-all, alerts-all
Event: alert:escalated
Payload: {
  job_id, zone_id, reason,
  message: "Emergency collection needs manual dispatch — no vehicle available",
  urgent_bins
}
```

---

### POST /internal/notify/job-cancelled

Called by orchestrator when job is cancelled.

**Request body:**
```typescript
{
  job_id: string
  zone_id: number
  driver_id: string | null
  reason: string
}
```

**Processing:**

```
1. Notify dashboard:
   Event: job:cancelled
   Rooms: dashboard-zone-{zone_id}, dashboard-all

2. Notify driver (if assigned):
   Event: job:cancelled
   Room: driver-{driver_id}
   FCM push if disconnected:
     Title: "Job cancelled"
     Body: reason
```

---

### POST /internal/notify/vehicle-position

Called by scheduler with enriched vehicle position (non-Kafka path for immediate events).

Note: most vehicle positions go through `waste.vehicle.dashboard.updates` Kafka topic. This HTTP endpoint is used for immediate events like bin arrival or weight warnings where latency matters.

**Request body:**
```typescript
{
  vehicle_id: string
  driver_id: string
  job_id: string
  zone_id: number
  lat: number
  lng: number
  speed_kmh: number
  cargo_weight_kg: number
  cargo_limit_kg: number
  cargo_utilisation_pct: number
  bins_collected: number
  bins_total: number
  arrived_at_cluster?: string    // cluster_id if just arrived
  weight_limit_warning?: boolean // true if > 90% capacity
}
```

**Processing:**

```
Emit to: dashboard-zone-{zone_id}, dashboard-all, fleet-ops
Event: vehicle:position
Payload: request body

If weight_limit_warning = true:
  Also emit event: alert:weight-limit
  Rooms: fleet-ops, dashboard-all
  Payload: { vehicle_id, driver_id, cargo_utilisation_pct, message }
```

---

### POST /internal/notify/alert-deviation

Called by scheduler when vehicle is off route.

**Request body:**
```typescript
{
  vehicle_id: string
  driver_id: string
  job_id: string
  zone_id: number
  deviation_metres: number
  duration_seconds: number
  message: string
}
```

**Processing:**

```
Emit to: fleet-ops, dashboard-zone-{zone_id}, alerts-all
Event: alert:deviation
Payload: request body
```

---

## 8. FCM push notification helper

```typescript
// fcmPush.ts

import * as admin from 'firebase-admin'

async function sendPush(
  driverId: string,
  notification: { title: string; body: string },
  data?: Record<string, string>
): Promise<void> {

  // Load FCM token from Keycloak user attributes
  const fcmToken = await keycloak.getUserAttribute(driverId, 'fcm_token')

  if (!fcmToken) {
    logger.warn({ message: 'No FCM token for driver', driver_id: driverId })
    return
  }

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification,
      data: data ?? {},
      android: {
        priority: 'high',
        notification: { sound: 'default' }
      },
      apns: {
        payload: {
          aps: { sound: 'default', badge: 1 }
        }
      }
    })
  } catch (error) {
    // FCM failure is not critical — log and continue
    logger.warn({
      message: 'FCM push failed',
      driver_id: driverId,
      error: error.message
    })
  }
}
```

---

## 9. Socket.IO events reference

Complete list of all events emitted by notification service:

```
Event                 Direction    Rooms                         Source
─────────────────────────────────────────────────────────────────────────────
bin:update            → client     dashboard-zone-{id},all       Kafka consumer
zone:stats            → client     dashboard-zone-{id},all       Kafka consumer
alert:urgent          → client     dashboard-zone-{id},all,alerts Kafka consumer
vehicle:position      → client     dashboard-zone-{id},all,fleet HTTP + Kafka
job:progress          → client     dashboard-zone-{id},all       Kafka consumer
job:created           → client     dashboard-zone-{id},all,fleet HTTP (orchestrator)
job:completed         → client     dashboard-zone-{id},all,fleet HTTP (orchestrator)
job:cancelled         → client     dashboard-zone-{id},all       HTTP (orchestrator)
job:assigned          → driver     driver-{id}                   HTTP (scheduler)
alert:escalated       → client     dashboard-zone-{id},all,alerts HTTP (orchestrator)
alert:deviation       → client     fleet-ops,dashboard-zone-{id} HTTP (scheduler)
alert:weight-limit    → client     fleet-ops,dashboard-all       HTTP (scheduler)
```

---

## 10. Error handling

```
Kafka consumer failure:
  Log error, skip message, commit offset
  Never crash on single message failure

Socket.IO emit failure:
  Log warning
  Client will miss this update but next update will correct state
  Do not retry emits

FCM failure:
  Log warning, continue
  Non-critical — driver will see update when they open app

Redis unavailable:
  Log CRITICAL
  Service continues with single-pod mode (no cross-pod delivery)
  Alert F4 immediately

Internal HTTP endpoint failure:
  Return 500 with error detail
  Caller (orchestrator/scheduler) may retry
  Log with full context
```

---

## 11. Acceptance criteria

```
[ ] Socket.IO: connections require valid Keycloak JWT
[ ] Socket.IO: supervisors join correct zone rooms on connect
[ ] Socket.IO: drivers join driver-{id} room on connect
[ ] Kafka: bin:update events routed to correct zone rooms
[ ] Kafka: zone:stats events routed to correct zone rooms
[ ] Kafka: alert:urgent events routed to alert rooms
[ ] Kafka: vehicle:position events routed to fleet-ops + zone rooms
[ ] HTTP: job:assigned emits via Socket.IO + FCM to driver
[ ] HTTP: job:created emits to dashboard rooms
[ ] HTTP: job:completed emits to dashboard + driver rooms
[ ] HTTP: job:escalated emits alert to dashboard
[ ] HTTP: alert:deviation emits to fleet-ops
[ ] FCM: push sent when driver not connected to Socket.IO
[ ] FCM: FCM failure does not crash service
[ ] Redis: Socket.IO adapter syncs across multiple pods
[ ] Auth: unauthenticated connections rejected
[ ] Error: Kafka consumer failure does not crash service
```
