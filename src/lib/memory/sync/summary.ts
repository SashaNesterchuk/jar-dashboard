/**
 * Sync extractor — minimal session summary builder. SSOT E.4 + E.4.1.
 *
 * Pure. Takes a `SessionCard` (+ optional soft signal context) and
 * returns a `SessionSummaryV1Sync`. Heavy NLP is async enricher
 * territory (v2_enriched); here we only do:
 *   1. Sentence-split of `user_stated_text` → `user_stated[]`.
 *   2. Mood/emotion valence calculation.
 *   3. Obvious themes from `selected_triggers[].label`.
 *   4. `helped_or_not` resolution per E.4.1 priority rules.
 *   5. Runtime flags mirrored from `flags_initial`.
 */

import type {
  EmotionalValence,
  HelpedOrNot,
  Mood,
  SessionCard,
  SessionRuntimeFlag,
  SessionSummaryV1Sync,
} from "../types";

export interface SoftSignalHints {
  /**
   * True when the previous mood (e.g. pre-practice) improved. Used
   * when there's no explicit practice feedback. SSOT E.4.1 #3.
   */
  mood_improved?: boolean;
  /** True when post-practice mood got worse. SSOT E.4.1 #3 (negative). */
  mood_worsened?: boolean;
  /**
   * True if the session completed in a supportive context (e.g.
   * breathing practice finished in full). Used with `mood_improved`.
   */
  supportive_completion?: boolean;
}

export interface BuildSessionSummaryInput {
  card: SessionCard;
  soft_signals?: SoftSignalHints;
}

export function buildSessionSummaryV1Sync(
  input: BuildSessionSummaryInput,
): SessionSummaryV1Sync {
  const { card, soft_signals } = input;

  return {
    session_id: card.session_id,
    session_type: card.session_type,
    summary_version: "v1_sync",
    completed_at: card.completed_at,
    user_stated: splitUserStated(card.user_stated_text),
    emotional_tone: {
      mood: card.exit_mood ?? card.entry_mood ?? "unknown",
      emotions: card.selected_emotions.map((e) => e.label),
      valence: resolveValence(card),
    },
    themes_obvious: card.selected_triggers.map((t) => t.label),
    helped_or_not: resolveHelpedOrNot(card, soft_signals),
    flags_runtime: mapRuntimeFlags(card),
    requires_async_enrichment: requiresAsyncEnrichment(card),
  };
}

/**
 * Very light sentence splitter: enough for the smoke-test pipeline.
 * Proper tokenisation is an async enrichment concern.
 */
export function splitUserStated(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function resolveValence(card: SessionCard): EmotionalValence {
  const moodValence = moodToValence(card.exit_mood ?? card.entry_mood);
  if (card.selected_emotions.length === 0) return moodValence;

  const emotionValence = averageEmotionValence(
    card.selected_emotions.map((e) => e.label),
  );
  if (moodValence === "neutral") return emotionValence;
  if (emotionValence === "neutral") return moodValence;
  if (moodValence !== emotionValence) return "mixed";
  return moodValence;
}

function moodToValence(mood: Mood | null): EmotionalValence {
  switch (mood) {
    case "great":
    case "good":
      return "positive";
    case "bad":
    case "awful":
      return "negative";
    case "ok":
      return "neutral";
    default:
      return "neutral";
  }
}

const POSITIVE_EMOTION_LABELS = new Set<string>([
  "calm",
  "grateful",
  "hopeful",
  "joyful",
  "proud",
  "confident",
  "content",
  "loved",
  "relaxed",
  "peaceful",
  "energized",
]);

const NEGATIVE_EMOTION_LABELS = new Set<string>([
  "anxious",
  "angry",
  "sad",
  "tired",
  "overwhelmed",
  "lonely",
  "guilty",
  "ashamed",
  "afraid",
  "frustrated",
  "worried",
  "stressed",
]);

function averageEmotionValence(labels: readonly string[]): EmotionalValence {
  let pos = 0;
  let neg = 0;
  for (const raw of labels) {
    const label = raw.toLowerCase();
    if (POSITIVE_EMOTION_LABELS.has(label)) pos += 1;
    else if (NEGATIVE_EMOTION_LABELS.has(label)) neg += 1;
  }
  if (pos > 0 && neg > 0) return "mixed";
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

/**
 * SSOT E.4.1 — source-of-truth rules for `helped_or_not`.
 */
export function resolveHelpedOrNot(
  card: SessionCard,
  soft?: SoftSignalHints,
): HelpedOrNot {
  const explicit = card.practice_specific.effectiveness_self_report;
  if (explicit === "better") return "yes"; // SSOT E.4.1 #1
  if (explicit === "worse") return "no"; // SSOT E.4.1 #2
  if (explicit === "same") return "unclear";

  if (!soft) return null;
  const posSoft = Boolean(soft.mood_improved && soft.supportive_completion);
  const negSoft = Boolean(soft.mood_worsened);

  if (posSoft && negSoft) return "unclear"; // SSOT E.4.1 #4
  if (posSoft) return "yes"; // SSOT E.4.1 #3
  if (negSoft) return "no"; // converse of #3

  return null; // SSOT E.4.1 #5
}

function mapRuntimeFlags(card: SessionCard): SessionRuntimeFlag[] {
  const out: SessionRuntimeFlag[] = [];
  const flags = new Set(card.flags_initial);
  if (flags.has("safety_check_required")) out.push("safety");
  if (
    flags.has("sensitive_topic_mentioned") ||
    flags.has("avoided_topic_adjacent")
  ) {
    out.push("sensitive");
  }
  if (out.length === 0) out.push("none");
  return out;
}

/**
 * `quick_check_in | breathing | meditation` without user text provide
 * no new material to enrich — skip async (SSOT E.1.1 vs E.1.2 split).
 */
function requiresAsyncEnrichment(card: SessionCard): boolean {
  const hasText = Boolean(card.user_stated_text?.trim());
  if (hasText) return true;
  switch (card.session_type) {
    case "check_in":
    case "journal":
    case "reflection":
    case "self_discovery":
      return true;
    case "quick_check_in":
    case "breathing":
    case "meditation":
    case "personal_practice":
      return false;
    default:
      return false;
  }
}
