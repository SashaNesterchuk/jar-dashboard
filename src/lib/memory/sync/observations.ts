/**
 * Session → observation upserter. SSOT D.2.1 ("Session signal →
 * OBSERVATION") + D.5.1 (`check_in_text` / `trigger_tags`).
 *
 * A check-in that names specific triggers produces (or reinforces) an
 * `observation` item per trigger theme. This module is the SSOT-side
 * equivalent of the `observation` seed row in the state-machine
 * diagram: it keeps the accumulation loop that later flips three
 * observations into a `hypothesis` via `async/pattern.ts`.
 *
 * Pure computation on the current item list + a session card. Callers
 * (hooks / API routes) persist the output through the StorageAdapter.
 */

import { newUuid } from "../async/id";
import { computeActiveConfidence } from "../state/confidence";
import { freshnessScore } from "../state/decay";
import { getSignal } from "../state/signalRegistry";
import type {
  MemoryAuditEvent,
  MemoryItem,
  MemoryItemSource,
  SessionCard,
} from "../types";

export interface EnsureObservationsParams {
  user_id: string;
  card: SessionCard;
  existing: readonly MemoryItem[];
  now: Date;
}

export interface EnsureObservationsResult {
  items: MemoryItem[];
  audits: MemoryAuditEvent[];
  /** Items whose confidence was bumped by the reinforcement (vs. created). */
  reinforced: MemoryItem[];
}

export function ensureObservationsFromCard(
  params: EnsureObservationsParams,
): EnsureObservationsResult {
  const themes = extractThemes(params.card);
  const evidence_delta = getSignal("trigger_tags").evidence_delta ?? 0.1;
  const signal_strength = estimateSignalStrength(params.card);

  const items: MemoryItem[] = [];
  const audits: MemoryAuditEvent[] = [];
  const reinforced: MemoryItem[] = [];

  for (const theme of themes) {
    const tag = `theme:${slug(theme)}`;
    const existing = findActiveObservation(params.existing, tag);
    if (existing) {
      const next = reinforceObservation(
        existing,
        params.card,
        evidence_delta,
        signal_strength,
        params.now,
      );
      items.push(next.item);
      audits.push(next.audit);
      reinforced.push(next.item);
    } else {
      const fresh = createObservation({
        theme,
        tag,
        user_id: params.user_id,
        card: params.card,
        signal_strength,
        now: params.now,
      });
      items.push(fresh.item);
      audits.push(fresh.audit);
    }
  }

  return { items, audits, reinforced };
}

/* ------------------------------------------------------------ helpers */

function extractThemes(card: SessionCard): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const trigger of card.selected_triggers) {
    const value = trigger.label.trim();
    if (!value) continue;
    if (seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push(value);
  }
  return out;
}

function findActiveObservation(
  items: readonly MemoryItem[],
  tag: string,
): MemoryItem | null {
  for (const item of items) {
    if (item.type !== "observation") continue;
    if (item.status !== "active") continue;
    if (item.theme_tags.includes(tag)) return item;
  }
  return null;
}

function createObservation(args: {
  theme: string;
  tag: string;
  user_id: string;
  card: SessionCard;
  signal_strength: number;
  now: Date;
}): { item: MemoryItem; audit: MemoryAuditEvent } {
  const source_event_id = args.card.session_id;
  const item_id = newUuid();
  const confidence = 0.25;
  const source: MemoryItemSource = {
    source_type: "trigger_tags",
    source_event_id,
    session_id: args.card.session_id,
    timestamp: args.now.toISOString(),
    weight: args.signal_strength,
    signal_kind: "corroboration",
  };

  const fresh = freshnessScore("observation", args.now, args.now);
  const item: MemoryItem = {
    id: item_id,
    user_id: args.user_id,
    type: "observation",
    status: "active",
    statement_user_facing: `Recent pattern around ${args.theme}.`,
    statement_internal: `observation_theme=${args.theme}`,
    content: {
      claim: `Recent mentions of ${args.theme}`,
      domain: "context",
      polarity: "neutral",
      intensity: 0.4,
    },
    internal_evidence_summary: null,
    confidence,
    freshness_score: fresh,
    active_confidence: computeActiveConfidence(confidence, fresh),
    last_confidence_computed_at: args.now.toISOString(),
    first_seen_at: args.now.toISOString(),
    last_supported_at: args.now.toISOString(),
    user_feedback_state: "none",
    sources: [source],
    source_event_ids: [source_event_id],
    sensitivity_level: "personal",
    visibility_scope: "memory_screen",
    theme_tags: [args.tag],
    related_focus_areas: [],
    state_history: [
      {
        from_status: null,
        to_status: "active",
        trigger_event_id: source_event_id,
        timestamp: args.now.toISOString(),
        auto_or_manual: "auto",
      },
    ],
    supersedes_id: null,
    version: 1,
    created_at: args.now.toISOString(),
    updated_at: args.now.toISOString(),
  };

  const audit: MemoryAuditEvent = {
    event_id: newUuid(),
    memory_item_id: item_id,
    action: "correction",
    user_id: args.user_id,
    timestamp: args.now.toISOString(),
    previous_state: {
      confidence: 0,
      status: "active",
      user_feedback_state: "none",
      visibility_scope: "memory_screen",
    },
    new_state: {
      confidence,
      status: "active",
      user_feedback_state: "none",
      visibility_scope: "memory_screen",
    },
    context_surface: "smart_summary",
    source_event_id,
  };

  return { item, audit };
}

function reinforceObservation(
  item: MemoryItem,
  card: SessionCard,
  delta: number,
  signal_strength: number,
  now: Date,
): { item: MemoryItem; audit: MemoryAuditEvent } {
  const previous = {
    confidence: item.confidence,
    status: item.status,
    user_feedback_state: item.user_feedback_state,
    visibility_scope: item.visibility_scope,
  };
  const nextConfidence = clamp01(item.confidence + delta);
  const source: MemoryItemSource = {
    source_type: "trigger_tags",
    source_event_id: card.session_id,
    session_id: card.session_id,
    timestamp: now.toISOString(),
    weight: signal_strength,
    signal_kind: "corroboration",
  };
  const sources = [...item.sources, source];
  const source_event_ids = item.source_event_ids.includes(card.session_id)
    ? item.source_event_ids
    : [...item.source_event_ids, card.session_id];

  const fresh = freshnessScore("observation", now, now);
  const next: MemoryItem = {
    ...item,
    confidence: nextConfidence,
    freshness_score: fresh,
    active_confidence: computeActiveConfidence(nextConfidence, fresh),
    last_confidence_computed_at: now.toISOString(),
    last_supported_at: now.toISOString(),
    sources,
    source_event_ids,
    version: item.version + 1,
    updated_at: now.toISOString(),
  };

  const audit: MemoryAuditEvent = {
    event_id: newUuid(),
    memory_item_id: item.id,
    action: "correction",
    user_id: item.user_id,
    timestamp: now.toISOString(),
    previous_state: previous,
    new_state: {
      confidence: next.confidence,
      status: next.status,
      user_feedback_state: next.user_feedback_state,
      visibility_scope: next.visibility_scope,
    },
    context_surface: "smart_summary",
    source_event_id: card.session_id,
  };

  return { item: next, audit };
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Lightweight signal_strength approximation (SSOT D.2.2). Formula:
 *   strength = 0.4 * text_factor + 0.3 * explicit_user_signal +
 *              0.2 * cross_source + 0.1 * recency
 *
 * Source-on-event is always "now" so `recency = 1`. Cross-source is 0
 * for a single session. Text factor = 1 iff the user stated text.
 * Explicit_user_signal ∈ {0, 0.5, 1} driven by selected emotions /
 * triggers count.
 */
function estimateSignalStrength(card: SessionCard): number {
  const text_factor = (card.user_stated_text ?? "").trim().length > 0 ? 1 : 0;
  const explicit =
    card.selected_emotions.length + card.selected_triggers.length;
  const explicit_factor = explicit >= 2 ? 1 : explicit >= 1 ? 0.5 : 0;
  const cross_source = 0;
  const recency = 1;
  return (
    0.4 * text_factor +
    0.3 * explicit_factor +
    0.2 * cross_source +
    0.1 * recency
  );
}

function slug(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
