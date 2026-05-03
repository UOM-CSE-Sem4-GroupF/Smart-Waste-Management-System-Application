# Claude Code Handoff: Workflow Orchestrator Backend Migration

## Goal
Complete the integration of the `workflow-orchestrator` with the shared `waste_management` PostgreSQL database, ensuring all services can successfully run within the Docker stack.

## Context
We have shifted away from the "database decoupling" strategy. The Orchestrator will now connect to the centralized `f3` schema inside the PostgreSQL instance managed by the DataAnalysis stack. 

Here is what has already been done:
1. **Prisma Setup**: `backend/orchestrator/prisma/schema.prisma` is created and mapped to the `f3` schema.
2. **Docker Network**: `docker-compose.yml` is updated to attach to the `garabadge` external network, allowing cross-project communication to the database.
3. **Dependencies**: `@prisma/client` and `prisma` have been added to the orchestrator's `package.json`.
4. **Dockerfile**: Updated to generate the Prisma client during the build stage.
5. **Data Access Refactoring**: `src/db/queries.ts` has been completely rewritten to replace in-memory `Map` storage with Prisma queries (`$transaction`, `upsert`, etc.). A singleton `prisma.ts` was also created.

## Your Tasks

Please follow this sequence to finalize the backend migration:

### 1. Fix Docker Networking
We encountered an issue where the `garabadge` network was declared as external but not found. 
- Ensure the `DataAnalysis/db/docker-compose.yml` correctly creates the `garabadge` network without declaring it as external (it should be the creator), and the `Application/docker-compose.yml` references it as external.
- Start the `DataAnalysis` database stack so `db-postgres-1` is running and attached to `garabadge`.

### 2. Update Consumers and Core Logic (Async Refactoring)
The previous `queries.ts` used synchronous `Map` operations. The new Prisma queries return `Promise`s. You MUST update the callers to `await` these functions:
- Search through `src/consumers/` (e.g., `binProcessedConsumer.ts`, `routineScheduleConsumer.ts`) and ensure calls to `insertJob` are awaited.
- Update `src/core/orchestrator.ts` and `stateMachine.ts` where necessary to ensure all state transitions and updates (`updateJob`, `recordStep`, `transition`) are awaited properly.

### 3. API Routes Update
Review `src/api/jobRoutes.ts`. Ensure all endpoints fetching jobs or stats from `queries.ts` are using `async/await` appropriately to handle the new Prisma Promises.

### 4. Client Integration
- The clients in `src/clients/` currently point to mock endpoints or direct ports. Update `binStatusClient.ts`, `hyperledgerClient.ts`, and `schedulerClient.ts` to route requests through the Kong API Gateway (or directly using internal Docker hostnames where appropriate, as defined in `02-workflow-orchestrator.md`).

### 5. Local Prisma Generation & Testing
- Inside `backend/orchestrator`, run `npm install` and `npx prisma generate` to populate the types locally.
- Run `npm run build` to verify there are no lingering TypeScript errors related to the Promise refactoring.
- Run the Vitest test suite (`npm run test`). You will likely need to update the mocks in `orchestrator.test.ts` to mock Prisma instead of the old `Map` functions.

### 6. Full Stack Spin-up
- Once the code builds successfully, run `docker compose up -d orchestrator bin-status scheduler notification telemetry-bridge kong` from the `Application` root.
- Check the orchestrator container logs (`docker compose logs -f orchestrator`) to ensure it successfully connects to PostgreSQL and Kafka.

Please refer to `02-workflow-orchestrator.md` for the original specification and state machine requirements.
