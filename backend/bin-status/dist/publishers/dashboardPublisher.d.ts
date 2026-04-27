/**
 * Dashboard Publisher — Publishes enriched events to waste.bin.dashboard.updates
 * This Kafka topic is consumed by the notification service and frontend
 */
import { DashboardUpdateEvent } from '../types';
export declare function publishToDashboard(event: DashboardUpdateEvent): Promise<void>;
export declare function disconnectProducer(): Promise<void>;
//# sourceMappingURL=dashboardPublisher.d.ts.map