/**
 * Process-wide adapter bundle for memory API routes.
 *
 * Shared across /api/memory/* so the InMemoryStorageAdapter instance is
 * the same between a POST /session and a follow-up POST /feedback. Fine
 * for smoke tests and portal dev — NEVER used in production traffic
 * (would need a persistent adapter bundle).
 */

import { InMemoryStorageAdapter } from "@/lib/memory/adapters/portal/inMemoryStorage";
import { edgeServerAIAdapter } from "@/lib/memory/adapters/portal/edgeAIServer";
import { createPortalTelemetryAdapter } from "@/lib/memory/adapters/portal/portalTelemetry";
import { systemClock } from "@/lib/memory/adapters/portal/systemClock";

export const sharedStorage = new InMemoryStorageAdapter({ storage: null });
export const sharedAi = edgeServerAIAdapter;
export const sharedClock = systemClock;
export const sharedTelemetry = createPortalTelemetryAdapter();
