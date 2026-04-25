/**
 * `InMemoryStorageAdapter` — default portal persistence.
 *
 * Spec §3.1 + §0.2: we are forbidden from creating DB migrations, so
 * the portal starts on an in-memory adapter that mirrors state to
 * `localStorage` (when available) so reload-persistence is possible
 * without any server-side setup.
 *
 * Design notes:
 *   - Pure TS; accepts an optional `StorageLike` (shape-compatible
 *     with `Storage`) so tests run headless without mocking the DOM.
 *   - Every public method is `async` to keep interface parity with a
 *     future `SupabaseStorageAdapter`; internal work is sync.
 *   - Audit trail is append-only; `upsertMemoryItem` writes the item
 *     and audit in one logical step (SSOT D.6).
 */

import type { StorageLike } from "./subscriptionStore";
import type {
  MemoryItemFilter,
  StorageAdapter,
} from "../storage";
import type {
  DailySnapshot,
  MemoryAuditEvent,
  MemoryItem,
  SafetyEvent,
  SessionCard,
  SessionSummaryV1Sync,
  SessionSummaryV2Enriched,
  StableProfile,
} from "../../types";

const STORAGE_KEY = "mindjar_memory_portal_store:v1";

interface Snapshot {
  memory_items: Record<string, MemoryItem[]>; // user_id → items
  audit: Record<string, MemoryAuditEvent[]>; // memory_item_id → events
  unattached_audit: MemoryAuditEvent[]; // audits with no matching item yet
  sessions: SessionCard[];
  summaries_v1: SessionSummaryV1Sync[];
  summaries_v2: SessionSummaryV2Enriched[];
  stable_profile: Record<string, StableProfile>; // user_id → profile
  daily_snapshots: Record<string, Record<string, DailySnapshot>>; // user_id → date → snapshot
  safety_events: SafetyEvent[];
}

function emptySnapshot(): Snapshot {
  return {
    memory_items: {},
    audit: {},
    unattached_audit: [],
    sessions: [],
    summaries_v1: [],
    summaries_v2: [],
    stable_profile: {},
    daily_snapshots: {},
    safety_events: [],
  };
}

export interface InMemoryStorageAdapterOptions {
  /** Injected storage for persistence; `null` = RAM-only. */
  storage?: StorageLike | null;
  /** Storage key override (tests). */
  storageKey?: string;
}

export class InMemoryStorageAdapter implements StorageAdapter {
  private state: Snapshot;
  private readonly storage: StorageLike | null;
  private readonly key: string;

  constructor(options: InMemoryStorageAdapterOptions = {}) {
    this.storage = options.storage ?? null;
    this.key = options.storageKey ?? STORAGE_KEY;
    this.state = this.hydrate() ?? emptySnapshot();
  }

  /* ------------------------------------------------------------ memory_items */

  async getMemoryItems(
    userId: string,
    filter?: MemoryItemFilter,
  ): Promise<MemoryItem[]> {
    const all = this.state.memory_items[userId] ?? [];
    if (!filter) return clone(all);

    const typeSet = filter.types ? new Set(filter.types) : null;
    const statusSet = filter.statuses ? new Set(filter.statuses) : null;
    const themeSet = filter.theme_tags ? new Set(filter.theme_tags) : null;
    const focusSet = filter.focus_areas ? new Set(filter.focus_areas) : null;

    const filtered = all.filter((item) => {
      if (typeSet && !typeSet.has(item.type)) return false;
      if (statusSet && !statusSet.has(item.status)) return false;
      if (themeSet && !item.theme_tags.some((t) => themeSet.has(t))) return false;
      if (
        focusSet &&
        !item.related_focus_areas.some((f) => focusSet.has(f))
      ) {
        return false;
      }
      return true;
    });
    return clone(filtered);
  }

  async upsertMemoryItem(
    item: MemoryItem,
    audit: MemoryAuditEvent,
  ): Promise<MemoryItem> {
    const bucket = this.state.memory_items[item.user_id] ?? [];
    const idx = bucket.findIndex((i) => i.id === item.id);
    const persisted = clone(item);
    if (idx === -1) {
      bucket.push(persisted);
    } else {
      bucket[idx] = persisted;
    }
    this.state.memory_items[item.user_id] = bucket;
    this.appendAuditInternal(audit);
    this.persist();
    return clone(persisted);
  }

  async appendAudit(audit: MemoryAuditEvent): Promise<void> {
    this.appendAuditInternal(audit);
    this.persist();
  }

  async getAuditTrail(memoryItemId: string): Promise<MemoryAuditEvent[]> {
    return clone(this.state.audit[memoryItemId] ?? []);
  }

  private appendAuditInternal(audit: MemoryAuditEvent): void {
    if (!audit.memory_item_id) {
      this.state.unattached_audit.push(clone(audit));
      return;
    }
    const bucket = this.state.audit[audit.memory_item_id] ?? [];
    bucket.push(clone(audit));
    this.state.audit[audit.memory_item_id] = bucket;
  }

  /* ---------------------------------------------------------------- sessions */

  async saveSessionCard(card: SessionCard): Promise<void> {
    const idx = this.state.sessions.findIndex(
      (s) => s.session_id === card.session_id,
    );
    if (idx === -1) {
      this.state.sessions.push(clone(card));
    } else {
      this.state.sessions[idx] = clone(card);
    }
    this.persist();
  }

  /* ------------------------------------------------------- session_summaries */

  async saveSessionSummary(
    summary: SessionSummaryV1Sync | SessionSummaryV2Enriched,
  ): Promise<void> {
    if (summary.summary_version === "v1_sync") {
      upsertById(
        this.state.summaries_v1,
        summary,
        (s) => s.session_id,
      );
    } else {
      upsertById(
        this.state.summaries_v2,
        summary,
        (s) => s.session_id,
      );
    }
    this.persist();
  }

  async getRecentSessionSummaries(
    userId: string,
    limit: number,
  ): Promise<SessionSummaryV1Sync[]> {
    // Session-level summaries do not carry user_id directly; we look
    // up via the parent session_card.
    const userSessionIds = new Set(
      this.state.sessions
        .filter((s) => s.user_id === userId)
        .map((s) => s.session_id),
    );
    const filtered = this.state.summaries_v1
      .filter((s) => userSessionIds.has(s.session_id))
      .sort((a, b) =>
        new Date(b.completed_at).getTime() -
        new Date(a.completed_at).getTime(),
      )
      .slice(0, Math.max(0, limit));
    return clone(filtered);
  }

  /* --------------------------------------------------------- stable_profile */

  async getStableProfile(userId: string): Promise<StableProfile | null> {
    const p = this.state.stable_profile[userId];
    return p ? clone(p) : null;
  }

  async upsertStableProfile(profile: StableProfile): Promise<void> {
    this.state.stable_profile[profile.user_id] = clone(profile);
    this.persist();
  }

  /* ---------------------------------------------------------- daily_snapshot */

  async getDailySnapshot(
    userId: string,
    date: string,
  ): Promise<DailySnapshot | null> {
    const bucket = this.state.daily_snapshots[userId];
    if (!bucket) return null;
    const snap = bucket[date];
    return snap ? clone(snap) : null;
  }

  async upsertDailySnapshot(snapshot: DailySnapshot): Promise<void> {
    const bucket =
      this.state.daily_snapshots[snapshot.user_id] ?? {};
    bucket[snapshot.date] = clone(snapshot);
    this.state.daily_snapshots[snapshot.user_id] = bucket;
    this.persist();
  }

  /* ------------------------------------------------------------------ safety */

  async appendSafetyEvent(evt: SafetyEvent): Promise<void> {
    this.state.safety_events.push(clone(evt));
    this.persist();
  }

  /* --------------------------------------------------------- test/debug API */

  /** @internal test-only */
  __getSnapshot(): Snapshot {
    return clone(this.state);
  }

  /** @internal test-only — destructive reset */
  __reset(): void {
    this.state = emptySnapshot();
    this.persist();
  }

  /* ------------------------------------------------------------ persistence */

  private hydrate(): Snapshot | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<Snapshot>;
      const base = emptySnapshot();
      return { ...base, ...parsed } as Snapshot;
    } catch {
      return null;
    }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.key, JSON.stringify(this.state));
    } catch {
      // Quota / SSR — ignore; RAM copy is still coherent.
    }
  }
}

function upsertById<T, K extends string>(
  bucket: T[],
  incoming: T,
  getKey: (x: T) => K,
): void {
  const k = getKey(incoming);
  const idx = bucket.findIndex((x) => getKey(x) === k);
  if (idx === -1) bucket.push(clone(incoming));
  else bucket[idx] = clone(incoming);
}

function clone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") {
    return structuredClone(value) as T;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export const INMEMORY_STORAGE_KEY = STORAGE_KEY;
