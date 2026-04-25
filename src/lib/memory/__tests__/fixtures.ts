import type {
  MemoryItem,
  MemoryItemSource,
  MemoryItemType,
  MemoryItemStatus,
  SignalKind,
  SourceType,
} from "../types";
import type { SignalId } from "../state/signalRegistry";
import type {
  EvidenceEvent,
  ObservationFact,
} from "../state/transitions";

export const TEST_USER_ID = "user_test";
export const TEST_ITEM_ID = "item_1";

export function makeItem(overrides: Partial<MemoryItem> = {}): MemoryItem {
  const now = new Date("2026-04-19T00:00:00Z");
  const iso = now.toISOString();
  const base: MemoryItem = {
    id: TEST_ITEM_ID,
    user_id: TEST_USER_ID,
    type: "hypothesis",
    status: "active",
    statement_user_facing: "You seem to recover after a short walk.",
    statement_internal: "short_walk_helps_recovery",
    content: {
      claim: "short walk helps recovery",
      domain: "support",
      polarity: "positive",
      intensity: 0.5,
    },
    internal_evidence_summary: null,
    confidence: 0.5,
    freshness_score: 1,
    active_confidence: 0.5,
    last_confidence_computed_at: iso,
    first_seen_at: iso,
    last_supported_at: iso,
    user_feedback_state: "none",
    sources: [],
    source_event_ids: [],
    sensitivity_level: "personal",
    visibility_scope: "memory_screen",
    theme_tags: ["recovery"],
    related_focus_areas: [],
    state_history: [
      {
        from_status: null,
        to_status: "active",
        trigger_event_id: "bootstrap",
        timestamp: iso,
        auto_or_manual: "auto",
      },
    ],
    supersedes_id: null,
    version: 1,
    created_at: iso,
    updated_at: iso,
  };
  return { ...base, ...overrides };
}

export function makeSource(overrides: Partial<MemoryItemSource> = {}): MemoryItemSource {
  const now = new Date("2026-04-19T00:00:00Z");
  const base: MemoryItemSource = {
    source_type: "check_in_text",
    source_event_id: "evt_0",
    session_id: null,
    timestamp: now.toISOString(),
    weight: 0.5,
    signal_kind: "corroboration",
  };
  return { ...base, ...overrides };
}

export function makeEvidence(overrides: Partial<EvidenceEvent> = {}): EvidenceEvent {
  const base: EvidenceEvent = {
    event_id: "evt_1",
    signal_id: "check_in_text",
    signal_kind: "corroboration",
    timestamp: new Date("2026-04-19T00:00:00Z"),
    memory_item_id: TEST_ITEM_ID,
  };
  return { ...base, ...overrides };
}

export function makeObservation(
  overrides: Partial<ObservationFact> = {},
): ObservationFact {
  const base: ObservationFact = {
    id: "obs_1",
    theme_tag: "recovery",
    signal_strength: 0.5,
    timestamp: new Date("2026-04-19T00:00:00Z"),
  };
  return { ...base, ...overrides };
}

export function makeYesThatFits(
  when: Date,
  overrides: Partial<EvidenceEvent> = {},
): EvidenceEvent {
  return makeEvidence({
    event_id: `yes_${when.toISOString()}`,
    signal_id: "yes_that_fits",
    signal_kind: "truth_confirmation",
    timestamp: when,
    ...overrides,
  });
}

export function makeNotQuite(
  when: Date,
  overrides: Partial<EvidenceEvent> = {},
): EvidenceEvent {
  return makeEvidence({
    event_id: `nq_${when.toISOString()}`,
    signal_id: "not_quite",
    signal_kind: "contradiction",
    timestamp: when,
    ...overrides,
  });
}

export function makeCorroboration(
  when: Date,
  overrides: Partial<EvidenceEvent> = {},
): EvidenceEvent {
  return makeEvidence({
    event_id: `corr_${when.toISOString()}`,
    signal_id: "check_in_text",
    signal_kind: "corroboration",
    timestamp: when,
    ...overrides,
  });
}

export function makeLike(
  when: Date,
  overrides: Partial<EvidenceEvent> = {},
): EvidenceEvent {
  return makeEvidence({
    event_id: `like_${when.toISOString()}`,
    signal_id: "like",
    signal_kind: "resonance",
    timestamp: when,
    ...overrides,
  });
}

export function addStateHistoryEntry(
  item: MemoryItem,
  toStatus: MemoryItemStatus,
  at: Date,
): MemoryItem {
  return {
    ...item,
    state_history: [
      ...item.state_history,
      {
        from_status: item.state_history.at(-1)?.to_status ?? null,
        to_status: toStatus,
        trigger_event_id: `tr_${at.toISOString()}`,
        timestamp: at.toISOString(),
        auto_or_manual: "user",
      },
    ],
    status: toStatus,
    updated_at: at.toISOString(),
  };
}

export function withType(item: MemoryItem, type: MemoryItemType): MemoryItem {
  return { ...item, type };
}

export function withSource(
  item: MemoryItem,
  source: MemoryItemSource,
): MemoryItem {
  return {
    ...item,
    sources: [...item.sources, source],
    source_event_ids: [...item.source_event_ids, source.source_event_id],
  };
}

export function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

export type { SignalId, SignalKind, SourceType };
