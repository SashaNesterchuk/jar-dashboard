/**
 * Tone prompts per confidence level. SSOT D.4.5.
 *
 * Pure — only string templates and a builder function. No adapters.
 */

import type {
  ConfidenceLevel,
  MemoryItem,
  SessionCard,
  SessionSummaryV1Sync,
  StableProfile,
} from "../types";

/**
 * SSOT D.4.5 — canonical voicing templates. Kept verbatim so safety
 * tests can assert they pass forbidden-language checks.
 */
export const LEVEL_TEMPLATES: Record<ConfidenceLevel, readonly string[]> = {
  // Level A — Exploring
  A: [
    "You may be carrying a lot right now.",
    "Could this be one of those moments when everything feels heavier than usual?",
    "It's still early days — I'm curious about what feels most present for you.",
  ],
  // Level B — Learning
  B: [
    "A pattern may be emerging: {theme} seem to bring more {signal} for you.",
    "You often seem to respond better to short, practical support when the day feels heavy.",
    "I'm noticing that {observation}.",
  ],
  // Level C — Understanding
  C: [
    "Short grounding practices tend to help you reset faster when stress builds up.",
    "You usually benefit from simple, direct support rather than long reflection when you feel overwhelmed.",
  ],
  // Level D — Deepening
  D: [
    "Evenings are a consistent soft spot — brief grounding tends to help.",
    "When work stress peaks, shorter check-ins tend to work better for you.",
  ],
} as const;

/**
 * Short instructional preamble for each confidence level. Used as a
 * system-prompt fragment when calling the generative adapter.
 */
export const LEVEL_INSTRUCTION: Record<ConfidenceLevel, string> = {
  A: "Use exploratory voice. Avoid assertions; prefer gentle questions. No claims about the user.",
  B: "Use learning voice. You may name patterns with softeners like 'may be' / 'I'm noticing'.",
  C: "Use understanding voice. Concrete observations about what helps are allowed when grounded in signals.",
  D: "Use deepening voice. Direct, warm assertions are allowed when backed by `confirmed_insight`.",
};

export interface BuildSystemPromptInput {
  confidence_level: ConfidenceLevel;
  avoided_topics: readonly string[];
  stable_profile: StableProfile | null;
  is_premium: boolean;
  /**
   * When true, the orchestrator is asking for a regenerate. The model
   * MUST try a different angle or tone (SSOT E.7.4).
   */
  regenerate_hint?: boolean;
}

/**
 * Builds the system-level instruction. Pure string assembly so it can
 * be snapshotted in tests.
 */
export function buildSystemPrompt(input: BuildSystemPromptInput): string {
  const parts: string[] = [
    // Surface identity (SSOT C.4).
    "You are MindJar Smart Summary. Output three blocks: Advice, Insight, Affirmation. Optionally a short Summary.",
    "Length budget: 80–150 words total; 50 words for quick_check_in.", // SSOT E.7.2
    "Every generation MUST reference `user_stated`, `selected_emotions`, or `focus_areas` explicitly.", // SSOT E.7.3 #1
    "Never generic: reject any line that could be shown to a random user.", // SSOT E.7.3 #2
    "IMPORTANT: All affirmations MUST be written in FIRST PERSON ('I' form), never second person ('you' form).",
    "Affirmations should be statements the user can say to themselves (e.g., 'I am worthy', 'I can handle this', 'I deserve compassion').",
    "Forbidden: diagnostic labels, 'you always' / 'you are definitely' / 'this proves', 'I know you', psychological generalizations.", // SSOT D.4.6
    LEVEL_INSTRUCTION[input.confidence_level],
  ];

  if (input.avoided_topics.length > 0) {
    parts.push(
      `Avoided topics — NEVER touch these: ${input.avoided_topics.join(", ")}.`,
    ); // SSOT F.2.2
  }

  if (input.stable_profile) {
    const d = input.stable_profile.declared;
    if (d.focus_areas.length > 0) {
      parts.push(`User focus areas: ${d.focus_areas.join(", ")}.`);
    }
    if (d.support_style) {
      parts.push(`Preferred support style: ${d.support_style}.`);
    }
  }

  if (input.is_premium) {
    parts.push(
      "Premium user: you may produce a richer, deeper synthesis across blocks.",
    ); // SSOT C.4.2
  } else {
    parts.push(
      "Free user: produce the baseline short Smart Summary (not zero-value, not blurred preview).",
    ); // SSOT C.4.2
  }

  if (input.regenerate_hint) {
    parts.push(
      "Regenerate hint: the previous attempt was rejected by the user or policy. Try a different angle or tone.",
    ); // SSOT E.7.4
  }

  return parts.join("\n");
}

export interface BuildUserPromptInput {
  session_card: SessionCard;
  recent_summaries: readonly SessionSummaryV1Sync[];
  memory_items: readonly MemoryItem[];
}

/**
 * Builds the user-turn prompt. Encodes the session context as a
 * structured JSON-ish block so adapters can either pass it verbatim to
 * the model or parse it for deterministic mocks.
 */
export function buildUserPrompt(input: BuildUserPromptInput): string {
  const { session_card, recent_summaries, memory_items } = input;

  const userStated =
    (session_card.user_stated_text ?? "").trim() || "(no text)";
  const emotions = session_card.selected_emotions.map((e) => e.label).join(
    ", ",
  ) || "(none)";
  const triggers = session_card.selected_triggers.map((t) => t.label).join(
    ", ",
  ) || "(none)";

  const recent = recent_summaries
    .slice(0, 3)
    .map((s) => `• [${s.session_type}] ${s.user_stated.join(" / ")}`)
    .join("\n") || "(none)";

  const memory = memory_items
    .slice(0, 3)
    .map(
      (m) =>
        `• (${m.type} ac=${m.active_confidence.toFixed(2)}) ${
          m.statement_user_facing ?? m.statement_internal
        }`,
    )
    .join("\n") || "(none)";

  return [
    "Current session:",
    `- mood: ${session_card.entry_mood ?? "unknown"}`,
    `- emotions: ${emotions}`,
    `- triggers: ${triggers}`,
    `- user_stated: ${userStated}`,
    "",
    "Recent sessions:",
    recent,
    "",
    "Relevant memory items:",
    memory,
  ].join("\n");
}
