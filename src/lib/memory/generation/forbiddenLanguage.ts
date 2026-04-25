/**
 * Forbidden-language detector. SSOT D.4.6.
 *
 * Pure. Used by the Smart Summary orchestrator (and any generation
 * pipeline) before showing output to the user. On violation the
 * orchestrator must regenerate or fall back to a safe template.
 */

export type ForbiddenCategory =
  | "diagnostic_label"
  | "categorical_assertion"
  | "i_know_you"
  | "psychological_generalization";

export interface ForbiddenMatch {
  category: ForbiddenCategory;
  phrase: string;
  /** The original substring that matched. */
  match: string;
}

/**
 * Each rule: case-insensitive regex on the output. These patterns are
 * deliberately narrow to keep false positives low (F.1.4).
 */
interface Rule {
  category: ForbiddenCategory;
  phrase: string;
  pattern: RegExp;
}

const RULES: readonly Rule[] = [
  // Diagnostic labels (SSOT D.4.6 #1)
  ...[
    "anxiety disorder",
    "depression",
    "burnout",
    "ptsd",
    "ocd",
    "adhd",
    "bipolar",
  ].map<Rule>((word) => ({
    category: "diagnostic_label",
    phrase: word,
    // word-boundary but tolerate leading "your " or "a "; the rule is
    // strict: even if qualified, clinical labels are off-limits.
    pattern: new RegExp(`\\b${escapeRegex(word)}\\b`, "i"),
  })),

  // Categorical assertions (SSOT D.4.6 #2)
  {
    category: "categorical_assertion",
    phrase: "you always",
    pattern: /\byou\s+always\b/i,
  },
  {
    category: "categorical_assertion",
    phrase: "you are definitely",
    pattern: /\byou\s+are\s+definitely\b/i,
  },
  {
    category: "categorical_assertion",
    phrase: "this proves",
    pattern: /\bthis\s+proves\b/i,
  },

  // "I know you ..." — only "I'm noticing" / "you mentioned" allowed (SSOT D.4.6 #3)
  {
    category: "i_know_you",
    phrase: "I know you",
    pattern: /\bi\s+know\s+you\b/i,
  },

  // Psychological generalizations (SSOT D.4.6 #4)
  {
    category: "psychological_generalization",
    phrase: "you're the kind of person who",
    pattern: /\byou'?re\s+the\s+kind\s+of\s+person\s+who\b/i,
  },
  {
    category: "psychological_generalization",
    phrase: "people like you",
    pattern: /\bpeople\s+like\s+you\b/i,
  },
];

export function detectForbiddenLanguage(text: string): ForbiddenMatch[] {
  const out: ForbiddenMatch[] = [];
  for (const rule of RULES) {
    const m = text.match(rule.pattern);
    if (m) {
      out.push({
        category: rule.category,
        phrase: rule.phrase,
        match: m[0],
      });
    }
  }
  return out;
}

export class ForbiddenLanguageError extends Error {
  constructor(public matches: ForbiddenMatch[]) {
    super(
      `Forbidden language detected: ${matches.map((m) => m.phrase).join(", ")}`,
    );
    this.name = "ForbiddenLanguageError";
  }
}

/**
 * No-op if OK; throws `ForbiddenLanguageError` if any rule fires.
 */
export function assertNoForbiddenLanguage(text: string): void {
  const matches = detectForbiddenLanguage(text);
  if (matches.length > 0) throw new ForbiddenLanguageError(matches);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
