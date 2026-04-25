/**
 * Canonical mapping: `jar/types/index.ts → EventType`  →  SSOT E.3.1
 * `session_type`.
 *
 * Source: mindjar-dashboard/docs/memory-portal-implementation.md §2.1.
 *
 * Notes:
 *   - `mood` (check-in) maps to `check_in` OR `quick_check_in` based on
 *     the presence of a reflection text — decided by the normalizer.
 *   - `streak | todo | affirmations | review | summary | letter` are
 *     NOT in SSOT E.3.1 and therefore DO NOT produce a session_card.
 */

import type { EventType } from "../jarTypes";
import type { SessionType } from "../types";

export type MappedSessionType = SessionType | "quick_check_in";

/**
 * Strongly-typed mapping. `null` means "this event type does not
 * produce a session_card in the memory scope" (SSOT E.3.1 gate).
 */
export const EVENT_TYPE_TO_SESSION_TYPE: Record<EventType, SessionType | null> =
  {
    journaling: "journal",
    meditation: "meditation",
    reflection: "reflection",
    breathing: "breathing",
    // `mood` is resolved in the normalizer (check_in vs quick_check_in).
    mood: "check_in",
    question: "self_discovery",
    streak: null,
    todo: null,
    affirmations: null,
    review: null,
    summary: null,
    letter: null,
  };

/**
 * Returns `true` if the event type should create a session_card.
 * Use this in the submit flow before calling `normalize`.
 */
export function createsSessionCard(event: EventType): boolean {
  return EVENT_TYPE_TO_SESSION_TYPE[event] !== null;
}

/**
 * Subset of `EventType` that maps cleanly to SSOT E.3.1. Consumers
 * that want exhaustiveness should switch on this type.
 */
export type MappedEventType = Exclude<
  EventType,
  "streak" | "todo" | "affirmations" | "review" | "summary" | "letter"
>;
