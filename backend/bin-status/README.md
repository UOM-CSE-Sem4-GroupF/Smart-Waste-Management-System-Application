# Bin Status Service

The bin status service is the domain authority for everything related to bin and cluster state. It translates raw sensor intelligence into business-meaningful state, decides what the dashboard needs to know, and enriches that data before forwarding it for live delivery.

## Architecture

### Responsibilities

- Consume `waste.bin.processed` and apply business rules
- Consume `waste.zone.statistics` and decide whether to forward to dashboard
- Provide cluster snapshot API for the orchestrator
- Mark bins as collected when orchestrator reports completion
- Expose bin and cluster query APIs for the dashboard
- Enrich all data before publishing to `waste.bin.dashboard.updates`
- Apply smart filtering — decide what is worth pushing to the dashboard

### Tech Stack

- **Runtime**: Node.js 20
- **Language**: TypeScript (strict mode)
- **HTTP**: Fastify
- **Logging**: Pino
- **Messaging**: KafkaJS
- **Validation**: Zod
- **Testing**: Vitest + Supertest

## Project Structure

```
src/
├── consumers/              # Kafka consumers
│   ├── binProcessedConsumer.ts
│   └── zoneStatisticsConsumer.ts
├── rules/                  # Business logic
│   ├── urgencyClassifier.ts    # Status classification
│   ├── collectionTrigger.ts    # When to trigger collection
│   ├── dashboardFilter.ts      # Smart filtering for dashboard
│   └── weightCalculator.ts     # Weight estimation
├── enrichment/            # Data enrichment
│   ├── binEnricher.ts
│   └── zoneEnricher.ts
├── publishers/            # Event publishing
│   └── dashboardPublisher.ts   # Publish to Kafka
├── queries/               # Data queries
│   ├── binQueries.ts
│   ├── clusterQueries.ts
│   └── zoneQueries.ts
├── routes/                # HTTP API
│   ├── bins.ts           # Public API
│   ├── zones.ts          # Zone management
│   └── internal.ts       # Orchestrator API
├── cache/                # Caching logic
│   └── zoneCache.ts
├── kafka/                # Kafka integration
│   └── consumer.ts
├── store.ts             # In-memory state store
├── types.ts             # TypeScript definitions
├── socket.ts            # WebSocket management
├── index.ts             # Main entry point
└── __tests__/           # Unit tests
```

## API Endpoints

### Public Routes (via Kong, requires JWT)

#### GET /api/v1/bins
List all bins with filtering and pagination.

**Query Parameters:**
- `zone_id` - Filter by zone
- `status` - Filter by status (normal|monitor|urgent|critical|offline)
- `waste_category` - Filter by waste category
- `cluster_id` - Filter by cluster
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50, max: 200)

**Example:**
```bash
curl -H "Authorization: Bearer <JWT>" \
  "http://localhost:8000/api/v1/bins?zone_id=1&status=urgent&limit=10"
```

#### GET /api/v1/bins/:bin_id
Get detailed information for a single bin including recent collection history.

#### GET /api/v1/bins/:bin_id/history
Get fill level time-series from InfluxDB.

**Query Parameters:**
- `from` - Start of range (default: -7d)
- `to` - End of range (default: now)
- `interval` - Aggregation interval (1h|6h|1d, default: 1h)

#### GET /api/v1/clusters/:cluster_id
Get full cluster state with all bins and summary metrics.

#### GET /api/v1/zones/:zone_id/summary
Get zone overview with status breakdown and category breakdown.

### Internal Routes (Cluster-only, requires X-Service-Name header)

#### POST /internal/clusters/:cluster_id/snapshot
Get the full state of all bins in a cluster for decision making.

**Request:**
```json
{
  "X-Service-Name": "workflow-orchestrator"
}
```

**Response:**
```json
{
  "cluster_id": "CLUSTER-012",
  "cluster_name": "Main Depot",
  "zone_id": 1,
  "bins": [...],
  "collectible_bins_count": 3,
  "collectible_bins_weight_kg": 245.5,
  "highest_urgency_score": 92,
  "highest_urgency_bin_id": "BIN-047"
}
```

#### POST /internal/clusters/:cluster_id/scan-nearby
Find other urgent clusters nearby to consolidate collection.

#### POST /internal/bins/:bin_id/mark-collected
Mark a bin as collected by the driver.

**Request:**
```json
{
  "job_id": "JOB-001",
  "driver_id": "DRIVER-042",
  "collected_at": "2026-01-15T14:30:00Z",
  "fill_level_at_collection": 5,
  "actual_weight_kg": 235.5
}
```

## Business Rules

### Urgency Classification

- **normal**: urgency_score < 65
- **monitor**: urgency_score 65-79
- **urgent**: urgency_score 80-89
- **critical**: urgency_score >= 90
- **offline**: bin status is offline

### Collection Trigger

A bin triggers collection when:
- urgency_score >= 80 AND
- no active collection job exists for its cluster

### Dashboard Filter

**Always push:**
- Bin status changed
- urgency_score >= 80
- battery_level_pct < 10
- status = 'offline'

**Throttle (max 1 per 60 seconds):**
- status = 'normal' and unchanged
- status = 'monitor' and unchanged

**Suppress:**
- fill_level_pct changed < 1% and status unchanged
- bin has active job already in progress

## Weight Calculation

The canonical weight calculation formula:

```
estimated_weight_kg = (fill_level_pct / 100) × volume_litres × avg_kg_per_litre
```

**Waste Category Densities:**
- food_waste: 0.90 kg/L
- paper: 0.10 kg/L
- glass: 2.50 kg/L
- plastic: 0.05 kg/L
- general: 0.30 kg/L
- e_waste: 3.20 kg/L

## Development

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Server starts on http://localhost:3002

### Build

```bash
npm run build
```

Outputs to `dist/`

### Run Tests

```bash
npm run test          # Run tests once
npm run test:watch   # Watch mode
```

### Environment Variables

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Key variables:
- `KAFKA_BROKERS` - Kafka broker addresses
- `LOG_LEVEL` - Logging level (debug|info|warn|error)
- `PORT` - HTTP port (default: 3002)
- `NODE_ENV` - Environment (development|production)

## Running with Docker

```bash
docker build -t bin-status-service:latest .
docker run -p 3002:3002 \
  -e KAFKA_BROKERS=kafka:9092 \
  -e LOG_LEVEL=info \
  bin-status-service:latest
```

## Acceptance Criteria

✅ Consumer processes waste.bin.processed messages  
✅ Consumer correctly calculates estimated_weight_kg  
✅ Consumer applies urgency classification rules  
✅ Consumer applies smart filtering  
✅ Consumer publishes enriched events  
✅ Consumer processes waste.zone.statistics messages  
✅ API: GET /internal/clusters/:id/snapshot returns correct state  
✅ API: POST /internal/bins/:id/mark-collected resets bin  
✅ API: GET /api/v1/bins returns paginated list  
✅ API: All public routes require JWT  
✅ Error handling: Bad message doesn't crash consumer  
✅ Error handling: InfluxDB unavailable doesn't block Kafka  
✅ Performance: /api/v1/bins for 1000 bins < 200ms  

## Error Handling

### Kafka Consumer Errors

If processing a message fails:
1. Log the error with context (bin_id, offset, etc.)
2. Commit the offset (don't retry indefinitely)
3. Continue processing next message

Bad messages do NOT crash the consumer.

### Database Connection Failure

On startup:
1. Retry connection 5 times with exponential backoff
2. If DB unavailable after retries: log CRITICAL and exit
3. Kubernetes will restart the pod
4. Do not accept messages until DB is confirmed healthy

### InfluxDB Unavailable

- History queries return 503
- Kafka consumer continues processing (history not critical path)
- Log warning and continue

### Missing Bin Metadata

- Log warning if sensor registered late
- Skip message
- Do NOT crash

## Monitoring

Structured JSON logging with Pino:

```json
{
  "level": "info",
  "time": "2026-01-15T14:30:00.000Z",
  "service": "bin-status-service",
  "bin_id": "BIN-047",
  "message": "Processed bin.processed message",
  "status": "urgent",
  "urgency_score": 92
}
```

## References

- [Specification](../../01-bin-status-service.md)
- [System Architecture](../../README.md)
- [Kafka Topics](../../CLAUDE.md)
