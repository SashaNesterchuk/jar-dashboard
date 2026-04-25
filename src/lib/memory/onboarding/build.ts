/**
 * Pure onboarding translator — SSOT C.1.9 (anketa) + D.1.2 (mapping).
 *
 * `buildOnboardingItems(answers, ctx)` returns the full set of memory
 * items + paired audit records that an onboarding submission produces.
 * Zero storage, zero network, zero clock side-effects: `now` is
 * supplied by the caller (`ClockAdapter.now()` in hooks / API routes).
 *
 * Mapping table (SSOT D.1.2):
 *
 *   user_name                 → immutable_fact
 *   primary_motivation        → declared_preference (+ top_value)
 *   pain_map                  → temporary_constraint (decay-enabled)
 *   focus_areas               → declared_preference
 *   support_style             → declared_preference
 *   realistic_action_modes    → declared_preference
 *   daily_time_budget         → declared_preference
 *   support_timing_preference → declared_preference
 *   avoided_topics            → declared_boundary
 *
 * Signal: every item is seeded by `onboarding_direct_answer`
 * (base_confidence = 0.85, signal_kind = declaration) per SSOT D.5.1.
 */

import { newUuid } from "../async/id";
import { computeActiveConfidence } from "../state/confidence";
import { freshnessScore } from "../state/decay";
import { getSignal } from "../state/signalRegistry";
import type {
  ContentDomain,
  ContextSurface,
  MemoryAuditEvent,
  MemoryItem,
  MemoryItemContent,
  MemoryItemSource,
  MemoryItemType,
  StableProfileDeclared,
  StableProfileCurrentConstraints,
  StableProfileBasics,
} from "../types";
import type { OnboardingAnswers } from "./types";

/** Context passed by the caller (hook / API) to keep the function pure. */
export interface BuildOnboardingContext {
  user_id: string;
  /** Shared clock time — used as `first_seen_at`, `timestamp`, etc. */
  now: Date;
  /** Source event id (defaults to a fresh UUID). Audit rows pin to it. */
  source_event_id?: string;
  /**
   * Surface where the answer originated. Onboarding happens before any
   * memory screen exists; SSOT C.3.4 treats this as `memory_screen`
   * audit context so downstream tooling can filter it consistently.
   */
  context_surface?: ContextSurface;
}

export interface OnboardingStableProfilePatch {
  basics: Partial<StableProfileBasics>;
  declared: Partial<StableProfileDeclared>;
  current_constraints: Partial<StableProfileCurrentConstraints>;
}

export interface BuildOnboardingResult {
  items: MemoryItem[];
  audits: MemoryAuditEvent[];
  stable_profile: OnboardingStableProfilePatch;
}

interface DraftItem {
  type: MemoryItemType;
  statement_user_facing: string;
  statement_internal: string;
  domain: ContentDomain;
  theme_tags: string[];
  related_focus_areas: string[];
  intensity: number;
}

export function buildOnboardingItems(
  answers: OnboardingAnswers,
  ctx: BuildOnboardingContext,
): BuildOnboardingResult {
  const source_event_id = ctx.source_event_id ?? newUuid();
  const surface: ContextSurface = ctx.context_surface ?? "memory_screen";
  const drafts = collectDrafts(answers);

  const items: MemoryItem[] = [];
  const audits: MemoryAuditEvent[] = [];
  const signal = getSignal("onboarding_direct_answer");
  const confidence = signal.base_confidence ?? 0.85;

  for (const draft of drafts) {
    const itemId = newUuid();
    const content: MemoryItemContent = {
      claim: draft.statement_internal,
      domain: draft.domain,
      polarity: "neutral",
      intensity: clamp01(draft.intensity),
    };

    const source: MemoryItemSource = {
      source_type: "onboarding",
      source_event_id,
      session_id: null,
      timestamp: ctx.now.toISOString(),
      weight: confidence,
      signal_kind: "declaration",
    };

    const fresh = freshnessScore(draft.type, ctx.now, ctx.now);
    const active = computeActiveConfidence(confidence, fresh);

    const item: MemoryItem = {
      id: itemId,
      user_id: ctx.user_id,
      type: draft.type,
      status: "active",
      statement_user_facing: draft.statement_user_facing,
      statement_internal: draft.statement_internal,
      content,
      internal_evidence_summary: null,
      confidence,
      freshness_score: fresh,
      active_confidence: active,
      last_confidence_computed_at: ctx.now.toISOString(),
      first_seen_at: ctx.now.toISOString(),
      last_supported_at: ctx.now.toISOString(),
      user_feedback_state: "none",
      sources: [source],
      source_event_ids: [source_event_id],
      sensitivity_level: sensitivityFor(draft),
      visibility_scope: visibilityFor(draft.type),
      theme_tags: draft.theme_tags,
      related_focus_areas: draft.related_focus_areas,
      state_history: [
        {
          from_status: null,
          to_status: "active",
          trigger_event_id: source_event_id,
          timestamp: ctx.now.toISOString(),
          auto_or_manual: "user",
        },
      ],
      supersedes_id: null,
      version: 1,
      created_at: ctx.now.toISOString(),
      updated_at: ctx.now.toISOString(),
    };

    const audit: MemoryAuditEvent = {
      event_id: newUuid(),
      memory_item_id: itemId,
      action: "confirm",
      user_id: ctx.user_id,
      timestamp: ctx.now.toISOString(),
      previous_state: {
        confidence: 0,
        status: "active",
        user_feedback_state: "none",
        visibility_scope: item.visibility_scope,
      },
      new_state: {
        confidence,
        status: "active",
        user_feedback_state: "none",
        visibility_scope: item.visibility_scope,
      },
      context_surface: surface,
      source_event_id,
    };

    items.push(item);
    audits.push(audit);
  }

  return {
    items,
    audits,
    stable_profile: buildStableProfilePatch(answers),
  };
}

/* ------------------------------------------------------------- helpers */

function collectDrafts(a: OnboardingAnswers): DraftItem[] {
  const drafts: DraftItem[] = [];

  if (a.user_name && a.user_name.trim().length > 0) {
    const name = a.user_name.trim();
    drafts.push({
      type: "immutable_fact",
      statement_user_facing: `Your name is ${name}.`,
      statement_internal: `user_name = ${name}`,
      domain: "identity",
      theme_tags: ["identity"],
      related_focus_areas: [],
      intensity: 1,
    });
  }

  if (a.primary_motivation && a.primary_motivation.length > 0) {
    for (const motive of unique(a.primary_motivation)) {
      drafts.push({
        type: "declared_preference",
        statement_user_facing: userFacingMotivation(motive),
        statement_internal: `primary_motivation = ${motive}`,
        domain: "preference",
        theme_tags: [tag("motivation", motive)],
        related_focus_areas: [],
        intensity: 0.8,
      });
    }
  }

  if (a.pain_map && a.pain_map.length > 0) {
    for (const pain of unique(a.pain_map)) {
      if (pain === "prefer_not_to_say") continue;
      drafts.push({
        type: "temporary_constraint",
        statement_user_facing: `Right now, ${humanizePain(pain)} feels heavier.`,
        statement_internal: `pain_map.active = ${pain}`,
        domain: "context",
        theme_tags: [tag("pain", pain)],
        related_focus_areas: [],
        intensity: 0.6,
      });
    }
  }

  if (a.focus_areas && a.focus_areas.length > 0) {
    for (const focus of unique(a.focus_areas)) {
      drafts.push({
        type: "declared_preference",
        statement_user_facing: `You want to focus on ${humanizeFocus(focus)}.`,
        statement_internal: `focus_area = ${focus}`,
        domain: "preference",
        theme_tags: [tag("focus", focus)],
        related_focus_areas: [focus],
        intensity: 0.7,
      });
    }
  }

  if (a.support_style && a.support_style.trim().length > 0) {
    const style = a.support_style.trim();
    drafts.push({
      type: "declared_preference",
      statement_user_facing: `Short, ${humanizeSupport(style)} support tends to land better.`,
      statement_internal: `support_style = ${style}`,
      domain: "support",
      theme_tags: [tag("support_style", style)],
      related_focus_areas: [],
      intensity: 0.7,
    });
  }

  if (a.realistic_action_modes && a.realistic_action_modes.length > 0) {
    for (const mode of unique(a.realistic_action_modes)) {
      drafts.push({
        type: "declared_preference",
        statement_user_facing: `You feel more willing to try ${humanizeMode(mode)}.`,
        statement_internal: `realistic_action_modes.includes = ${mode}`,
        domain: "behavior",
        theme_tags: [tag("action_mode", mode)],
        related_focus_areas: [],
        intensity: 0.6,
      });
    }
  }

  if (a.daily_time_budget) {
    drafts.push({
      type: "declared_preference",
      statement_user_facing: `You prefer sessions around ${humanizeBudget(a.daily_time_budget)}.`,
      statement_internal: `daily_time_budget = ${a.daily_time_budget}`,
      domain: "behavior",
      theme_tags: [tag("time_budget", a.daily_time_budget)],
      related_focus_areas: [],
      intensity: 0.6,
    });
  }

  if (a.support_timing_preference) {
    drafts.push({
      type: "declared_preference",
      statement_user_facing: `Support tends to land best ${humanizeTiming(a.support_timing_preference)}.`,
      statement_internal: `support_timing_preference = ${a.support_timing_preference}`,
      domain: "behavior",
      theme_tags: [tag("timing", a.support_timing_preference)],
      related_focus_areas: [],
      intensity: 0.6,
    });
  }

  if (a.avoided_topics && a.avoided_topics.length > 0) {
    for (const topic of unique(a.avoided_topics)) {
      drafts.push({
        type: "declared_boundary",
        statement_user_facing: `Approach ${humanizeBoundary(topic)} carefully.`,
        statement_internal: `avoided_topic = ${topic}`,
        domain: "boundary",
        theme_tags: [tag("boundary", topic)],
        related_focus_areas: [],
        intensity: 0.9,
      });
    }
  }

  return drafts;
}

function buildStableProfilePatch(
  a: OnboardingAnswers,
): OnboardingStableProfilePatch {
  return {
    basics: {
      ...(a.user_name ? { name: a.user_name.trim() } : {}),
    },
    declared: {
      ...(a.primary_motivation
        ? {
            primary_motivation: [...a.primary_motivation],
            top_value: a.primary_motivation[0] ?? null,
          }
        : {}),
      ...(a.focus_areas ? { focus_areas: [...a.focus_areas] } : {}),
      ...(a.support_style ? { support_style: a.support_style } : {}),
      ...(a.realistic_action_modes
        ? { realistic_action_modes: [...a.realistic_action_modes] }
        : {}),
      ...(a.daily_time_budget
        ? { daily_time_budget: a.daily_time_budget }
        : {}),
      ...(a.support_timing_preference
        ? { support_timing_preference: a.support_timing_preference }
        : {}),
    },
    current_constraints: {
      ...(a.pain_map ? { pain_map: [...a.pain_map] } : {}),
      ...(a.avoided_topics ? { avoided_topics: [...a.avoided_topics] } : {}),
    },
  };
}

function sensitivityFor(draft: DraftItem): MemoryItem["sensitivity_level"] {
  if (draft.domain === "boundary") return "sensitive";
  if (draft.domain === "identity") return "personal";
  return "personal";
}

function visibilityFor(type: MemoryItemType): MemoryItem["visibility_scope"] {
  return "memory_screen";
}

function unique<T>(xs: readonly T[]): T[] {
  return Array.from(new Set(xs));
}

function tag(kind: string, value: string): string {
  return `${kind}:${slug(value)}`;
}

function slug(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/* --------------------------------------------------------- humanizers */

function humanizeMotive(v: string): string {
  return v.replace(/_/g, " ").toLowerCase().replace(/\bi\b/g, "I");
}

function userFacingMotivation(v: string): string {
  const normalized = humanizeMotive(v);
  if (normalized === "I feel anxious or overwhelmed") {
    return "You came here mainly because feeling anxious or overwhelmed has been present.";
  }
  return `You came here mainly around: ${normalized}.`;
}

function humanizePain(v: string): string {
  return v.replace(/_/g, " ").toLowerCase();
}

function humanizeFocus(v: string): string {
  return v.replace(/_/g, " ").replace(/\bmy\b/gi, "your").toLowerCase();
}

function humanizeSupport(v: string): string {
  return v.replace(/_/g, " ").toLowerCase();
}

function humanizeMode(v: string): string {
  return v.replace(/_/g, " ").toLowerCase();
}

function humanizeBoundary(v: string): string {
  return v.replace(/\s*\/\s*/g, " / ").replace(/_/g, " ").toLowerCase();
}

function humanizeBudget(v: OnboardingAnswers["daily_time_budget"]): string {
  switch (v) {
    case "lt_10_min":
      return "under 10 minutes";
    case "10_30_min":
      return "10–30 minutes";
    case "30_60_min":
      return "30–60 minutes";
    case "gt_60_min":
      return "over an hour";
    default:
      return "a comfortable amount of time";
  }
}

function humanizeTiming(
  v: OnboardingAnswers["support_timing_preference"],
): string {
  switch (v) {
    case "morning":
      return "in the morning";
    case "midday":
      return "around midday";
    case "evening":
      return "in the evening";
    case "late_night":
      return "late at night";
    case "when_overwhelming":
      return "when things get overwhelming";
    case "no_specific_time":
      return "with no specific time";
    default:
      return "at your usual pace";
  }
}
