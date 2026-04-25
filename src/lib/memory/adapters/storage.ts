/**
 * StorageAdapter — platform boundary for persistence.
 *
 * Spec §3.1. Canonical shapes come from SSOT D.3 (memory_items),
 * D.6 (audit), D.8 (stable_profile), E.3 (session_card), E.4
 * (session summaries), E.5 (daily_snapshot), F.1 (safety_events).
 *
 * Two portal-side implementations:
 *   - `InMemoryStorageAdapter` — default for smoke tests; persists via
 *     localStorage mirror when available; SSR-safe (no window
 *     references in pure TS).
 *   - `SupabaseStorageAdapter` — activated manually if owner creates
 *     tables (migrations are forbidden per Spec §0.2).
 */

import type {
  DailySnapshot,
  MemoryAuditEvent,
  MemoryItem,
  MemoryItemStatus,
  MemoryItemType,
  SafetyEvent,
  SessionCard,
  SessionSummaryV1Sync,
  SessionSummaryV2Enriched,
  StableProfile,
} from "../types";

export interface MemoryItemFilter {
  /** If provided, include only items in this set. */
  types?: readonly MemoryItemType[];
  /** If provided, include only items in this set. */
  statuses?: readonly MemoryItemStatus[];
  /** If provided, include only items whose theme_tags intersect this set. */
  theme_tags?: readonly string[];
  /** If provided, include only items whose related_focus_areas intersect this set. */
  focus_areas?: readonly string[];
}

export interface StorageAdapter {
  /* --------------------------------------------------- memory_items (D.3) */
  getMemoryItems(
    userId: string,
    filter?: MemoryItemFilter,
  ): Promise<MemoryItem[]>;

  /**
   * Atomic upsert: persists the new item state AND its corresponding
   * audit event. SSOT D.6: audit is paired with every change; EPIC 6
   * relies on this contract to keep history consistent.
   */
  upsertMemoryItem(
    item: MemoryItem,
    audit: MemoryAuditEvent,
  ): Promise<MemoryItem>;

  /** Append an audit event that is not tied to an item state change. */
  appendAudit(audit: MemoryAuditEvent): Promise<void>;

  getAuditTrail(memoryItemId: string): Promise<MemoryAuditEvent[]>;

  /* -------------------------------------------------------- sessions (E.3) */
  saveSessionCard(card: SessionCard): Promise<void>;

  /* ------------------------------------------------ session_summaries (E.4) */
  saveSessionSummary(
    summary: SessionSummaryV1Sync | SessionSummaryV2Enriched,
  ): Promise<void>;
  getRecentSessionSummaries(
    userId: string,
    limit: number,
  ): Promise<SessionSummaryV1Sync[]>;

  /* ---------------------------------------------------- stable_profile (D.8) */
  getStableProfile(userId: string): Promise<StableProfile | null>;
  upsertStableProfile(profile: StableProfile): Promise<void>;

  /* ----------------------------------------------------- daily_snapshot (E.5) */
  getDailySnapshot(
    userId: string,
    date: string,
  ): Promise<DailySnapshot | null>;
  upsertDailySnapshot(snapshot: DailySnapshot): Promise<void>;

  /* ----------------------------------------------------------- safety (F.1) */
  appendSafetyEvent(evt: SafetyEvent): Promise<void>;
}
