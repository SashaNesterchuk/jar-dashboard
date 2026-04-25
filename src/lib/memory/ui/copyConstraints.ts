/**
 * Copy constraints — SSOT B.4.5.
 *
 * Forbidden user-facing phrases on memory-related surfaces (Memory
 * screen, Smart Summary, Weekly, Plan, Chat). Internal prompts / debug
 * panels are exempt (SSOT B.4.5 last paragraph).
 *
 * Keep this module pure (no React imports) so it can be reused in
 * tests, API validators, and future RN UIs.
 */

/** SSOT B.4.5 — exact forbidden literals, lowercase. */
export const FORBIDDEN_USER_FACING_PHRASES: readonly string[] = [
  "i know you",
  "i learn who you are",
  "i learned who you are",
  "what i know about you",
  "what i learned about you",
] as const;

export interface AllowedCopyVerdict {
  allowed: boolean;
  /** First forbidden phrase detected, if any. */
  offending_phrase: string | null;
  /**
   * Offset of the offending phrase in the original string. `null` when
   * `allowed` is true.
   */
  offset: number | null;
}

export function checkAllowedCopy(text: string): AllowedCopyVerdict {
  if (!text) {
    return { allowed: true, offending_phrase: null, offset: null };
  }
  const haystack = text.toLowerCase();
  for (const phrase of FORBIDDEN_USER_FACING_PHRASES) {
    const at = haystack.indexOf(phrase);
    if (at !== -1) {
      return {
        allowed: false,
        offending_phrase: phrase,
        offset: at,
      };
    }
  }
  return { allowed: true, offending_phrase: null, offset: null };
}

/**
 * Guard helper for test suites and runtime assertions. Throws a
 * descriptive error when forbidden copy is detected; a no-op otherwise.
 */
export function assertAllowedCopy(text: string, context?: string): void {
  const verdict = checkAllowedCopy(text);
  if (!verdict.allowed) {
    const where = context ? ` (${context})` : "";
    throw new Error(
      `Forbidden copy detected${where}: "${verdict.offending_phrase}" at offset ${verdict.offset}. SSOT B.4.5 bans this wording on user-facing memory surfaces.`,
    );
  }
}
