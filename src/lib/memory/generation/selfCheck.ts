/**
 * Smart Summary self-checks. SSOT E.7.3 (generation rules #1, #2).
 *
 * Pure. The orchestrator runs these after receiving an AI output and
 * triggers a regenerate if any check fails.
 */

import type { SmartSummaryOutput } from "../adapters/ai";
import type { SessionCard, StableProfile } from "../types";

export type SelfCheckFailure =
  | "missing_specific_signal"
  | "could_be_anyone"
  | "zero_length_block";

export interface SelfCheckContext {
  session_card: SessionCard;
  stable_profile: StableProfile | null;
}

export interface SelfCheckResult {
  ok: boolean;
  failures: SelfCheckFailure[];
}

export function runSelfChecks(
  output: SmartSummaryOutput,
  ctx: SelfCheckContext,
): SelfCheckResult {
  const failures: SelfCheckFailure[] = [];

  if (
    output.advice.trim().length === 0 ||
    output.insight.trim().length === 0 ||
    output.affirmation.trim().length === 0
  ) {
    failures.push("zero_length_block");
  }

  const combined =
    `${output.advice}\n${output.insight}\n${output.affirmation}\n${
      output.summary ?? ""
    }`;

  if (!hasSpecificSignalReference(combined, ctx)) {
    failures.push("missing_specific_signal");
  }

  if (couldBeAnyone(combined, ctx)) {
    failures.push("could_be_anyone");
  }

  return { ok: failures.length === 0, failures };
}

/**
 * SSOT E.7.3 #1 — must include at least one explicit reference to
 * `user_stated`, `selected_emotions`, or `focus_areas`.
 *
 * Reference detection: substring match (case-insensitive) against any
 * emotion label, trigger label, focus area, or a content word (>=4 chars)
 * from `user_stated_text`.
 */
export function hasSpecificSignalReference(
  text: string,
  ctx: SelfCheckContext,
): boolean {
  const haystack = text.toLowerCase();
  const { session_card, stable_profile } = ctx;

  const needles: string[] = [];
  for (const e of session_card.selected_emotions) {
    needles.push(e.label.toLowerCase());
  }
  for (const t of session_card.selected_triggers) {
    needles.push(t.label.toLowerCase());
  }
  for (const fa of stable_profile?.declared.focus_areas ?? []) {
    needles.push(fa.toLowerCase());
  }
  const stated = (session_card.user_stated_text ?? "").toLowerCase();
  for (const word of extractContentWords(stated)) {
    needles.push(word);
  }

  // If no signals are present, the check passes vacuously — the
  // fallback to safe template is the safety net (SSOT E.10.6).
  if (needles.length === 0) return true;

  return needles.some((n) => n.length > 0 && haystack.includes(n));
}

/**
 * SSOT E.7.3 #2 — "Could this be shown to a random user?" heuristic.
 *
 * Approach: treat output as "generic" when NONE of the user's specific
 * signals appear AND the text is composed of highly common phrases.
 * In practice this is a superset of the "missing_specific_signal"
 * check; keeping it separate lets us tune thresholds independently.
 */
export function couldBeAnyone(
  text: string,
  ctx: SelfCheckContext,
): boolean {
  if (hasSpecificSignalReference(text, ctx)) return false;
  // No signal AND no proper noun / concrete noun reference → generic.
  return !/\b[A-Z][a-z]{3,}\b/.test(text);
}

function extractContentWords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z\s']/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOP_WORDS.has(w)),
    ),
  );
}

const STOP_WORDS = new Set<string>([
  "this",
  "that",
  "with",
  "from",
  "have",
  "been",
  "they",
  "their",
  "them",
  "there",
  "then",
  "than",
  "here",
  "what",
  "when",
  "where",
  "which",
  "while",
  "about",
  "because",
  "really",
  "just",
  "some",
  "into",
  "more",
  "like",
  "make",
  "much",
  "feel",
  "feeling",
  "felt",
  "been",
  "were",
  "your",
  "mine",
]);
