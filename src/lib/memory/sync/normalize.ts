/**
 * Sync extractor — normalization step. SSOT E.3 + Spec §2.1.
 *
 * Takes a `CheckIn`-style input (or a lighter "raw submit" shape used by
 * the portal simulators) and returns a canonical `SessionCard`.
 *
 * Pure: no storage, no network, no clock side-effects. `now` is passed
 * explicitly so the output is deterministic under tests.
 */

import type { CheckIn, Emotion, EventType, Tag } from "../jarTypes";
import type {
  Mood,
  SessionCard,
  SessionFlagInitial,
  SessionType,
} from "../types";
import {
  createsSessionCard,
  EVENT_TYPE_TO_SESSION_TYPE,
} from "./eventTypeMap";

export interface NormalizeCheckInInput {
  session_id: string;
  user_id: string;
  started_at: Date;
  completed_at: Date;
  /** Source event type from the app (`mood`, `journaling`, etc.). */
  event_type: EventType;
  check_in: CheckIn;
  entry_mood?: Mood | null;
  selected_emotions?: Emotion[];
  selected_triggers?: Tag[];
  /**
   * User-facing text; overrides `check_in.reflection` when both are
   * provided. Use this for practices whose reflection does not live on
   * the CheckIn shape (e.g. post-practice feedback).
   */
  user_stated_text?: string | null;
  flags_initial?: SessionFlagInitial[];
  completion_state?: SessionCard["completion_state"];
  practice_specific?: SessionCard["practice_specific"];
  reaction_to_output?: Partial<SessionCard["reaction_to_output"]>;
  client_metadata: SessionCard["client_metadata"];
}

export class UnsupportedEventTypeError extends Error {
  constructor(public event_type: EventType) {
    super(
      `Event type "${event_type}" is not part of SSOT E.3.1 session_type enum — no session_card produced`,
    );
    this.name = "UnsupportedEventTypeError";
  }
}

export function normalizeToSessionCard(
  input: NormalizeCheckInInput,
): SessionCard {
  if (!createsSessionCard(input.event_type)) {
    throw new UnsupportedEventTypeError(input.event_type);
  }

  const session_type = resolveSessionType(input);

  const user_stated_text =
    input.user_stated_text ?? input.check_in.reflection ?? null;

  const entry_mood = input.entry_mood ?? input.check_in.mood ?? null;
  const exit_mood = resolveExitMood(input);

  const selected_emotions = input.selected_emotions
    ? dedupeEmotions(input.selected_emotions)
    : [];
  const selected_triggers = input.selected_triggers
    ? dedupeTags(input.selected_triggers)
    : [];

  const flags_initial: SessionFlagInitial[] =
    input.flags_initial && input.flags_initial.length > 0
      ? [...input.flags_initial]
      : ["none"];

  return {
    session_id: input.session_id,
    user_id: input.user_id,
    session_type,
    started_at: input.started_at.toISOString(),
    completed_at: input.completed_at.toISOString(),
    entry_mood,
    exit_mood,
    user_stated_text,
    selected_emotions,
    selected_triggers,
    completion_state: input.completion_state ?? "completed",
    reaction_to_output: {
      liked: input.reaction_to_output?.liked ?? false,
      disliked: input.reaction_to_output?.disliked ?? false,
      echo_saved: input.reaction_to_output?.echo_saved ?? false,
      regenerated: input.reaction_to_output?.regenerated ?? false,
    },
    practice_specific: input.practice_specific ?? {
      practice_id: null,
      effectiveness_self_report: null,
      duration_seconds: null,
    },
    flags_initial,
    client_metadata: { ...input.client_metadata },
  };
}

/**
 * Spec §2.1 nuance: `mood` event produces `quick_check_in` when the
 * user did NOT supply a reflection; otherwise it produces `check_in`.
 */
function resolveSessionType(input: NormalizeCheckInInput): SessionType {
  const mapped = EVENT_TYPE_TO_SESSION_TYPE[input.event_type];
  if (mapped === null) {
    throw new UnsupportedEventTypeError(input.event_type);
  }
  if (input.event_type === "mood") {
    const text = (input.user_stated_text ?? input.check_in.reflection ?? "")
      .trim();
    return text.length === 0 ? "quick_check_in" : "check_in";
  }
  return mapped;
}

/**
 * SessionCard has an `exit_mood` slot that is only meaningful for
 * sessions with an explicit post-session mood (typically practice
 * feedback). Check-ins re-use the entry mood as the baseline exit mood
 * — the SSOT E.3 spec permits `null` when not applicable.
 */
function resolveExitMood(input: NormalizeCheckInInput): Mood | null {
  if (input.event_type === "mood") return input.check_in.mood ?? null;
  return null;
}

function dedupeEmotions(xs: readonly Emotion[]): Emotion[] {
  const seen = new Map<string, Emotion>();
  for (const e of xs) {
    if (!seen.has(e.label)) seen.set(e.label, e);
  }
  return Array.from(seen.values());
}

function dedupeTags(xs: readonly Tag[]): Tag[] {
  const seen = new Map<string, Tag>();
  for (const t of xs) {
    if (!seen.has(t.label)) seen.set(t.label, t);
  }
  return Array.from(seen.values());
}
