/**
 * Avoided-topics enforcement. SSOT D.3.2 + F.2.2.
 *
 * Pure. Used at two points:
 *   1. Prompt construction — `buildSystemPrompt` already injects them.
 *   2. Post-generation check — detect any mention of avoided topic in
 *      output so the orchestrator can regenerate / fall back.
 *
 * Matching is substring + word-boundary, case-insensitive. Multi-word
 * topics are matched as-is.
 */

export interface AvoidedTopicMatch {
  topic: string;
  match: string;
}

export function detectAvoidedTopicMentions(
  text: string,
  avoidedTopics: readonly string[],
): AvoidedTopicMatch[] {
  if (avoidedTopics.length === 0) return [];
  const out: AvoidedTopicMatch[] = [];
  for (const topic of avoidedTopics) {
    const normalized = topic.trim();
    if (normalized.length === 0) continue;
    const pattern = new RegExp(
      `\\b${escapeRegex(normalized)}\\b`,
      "i",
    );
    const m = text.match(pattern);
    if (m) {
      out.push({ topic: normalized, match: m[0] });
    }
  }
  return out;
}

export function containsAvoidedTopic(
  text: string,
  avoidedTopics: readonly string[],
): boolean {
  return detectAvoidedTopicMentions(text, avoidedTopics).length > 0;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
