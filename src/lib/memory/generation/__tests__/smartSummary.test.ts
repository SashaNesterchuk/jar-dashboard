import { describe, expect, it } from "vitest";
import type {
  AIAdapter,
  SafetyResult,
  SmartSummaryInput,
  SmartSummaryOutput,
} from "../../adapters/ai";
import { fixedClock } from "../../adapters/portal/systemClock";
import type {
  SessionCard,
  SessionSummaryV1Sync,
  StableProfile,
} from "../../types";
import {
  generateSmartSummary,
  MAX_REGENERATIONS,
} from "../smartSummary";

const NOW = new Date("2026-04-19T12:00:00Z");

function card(overrides: Partial<SessionCard> = {}): SessionCard {
  const base: SessionCard = {
    session_id: "s1",
    user_id: "u1",
    session_type: "check_in",
    started_at: NOW.toISOString(),
    completed_at: NOW.toISOString(),
    entry_mood: "ok",
    exit_mood: null,
    user_stated_text: "Work felt heavy today.",
    selected_emotions: [{ tKey: "e.tired", label: "tired" }],
    selected_triggers: [
      { tKey: "t.work", label: "work", categoryId: "c" },
    ],
    completion_state: "completed",
    reaction_to_output: {
      liked: false,
      disliked: false,
      echo_saved: false,
      regenerated: false,
    },
    practice_specific: {
      practice_id: null,
      effectiveness_self_report: null,
      duration_seconds: null,
    },
    flags_initial: ["none"],
    client_metadata: {
      app_version: "x",
      locale: "en",
      timezone_offset: "+00:00",
    },
  };
  return { ...base, ...overrides };
}

function profile(): StableProfile {
  return {
    user_id: "u1",
    basics: {
      mood_pattern_recent: [],
      last_mood: null,
      last_focus_emotions_top3: [],
      declared_identity: null,
    } as unknown as StableProfile["basics"],
    declared: {
      primary_motivation: [],
      top_value: null,
      focus_areas: ["work"],
      support_style: null,
      realistic_action_modes: [],
      daily_time_budget: null,
      support_timing_preference: null,
    },
    current_constraints: {
      pain_map: [],
      avoided_topics: [],
      current_life_context: [],
    },
    what_tends_to_help: [],
    active_hypotheses: [],
    confirmed_insights: [],
    confidence_level: "B",
    user_confidence_score: 0.5,
    last_refreshed_at: NOW.toISOString(),
    activity_snapshot: {
      total_sessions: 5,
      days_active_in_last_14: 5,
      text_sessions_ratio: 0.5,
      streak_status: "active",
    },
  };
}

interface StubConfig {
  summaries: SmartSummaryOutput[];
  safety: SafetyResult[];
}

function stubAI(cfg: StubConfig): AIAdapter {
  let sIdx = 0;
  let cIdx = 0;
  return {
    async generateSmartSummary(input: SmartSummaryInput) {
      void input;
      const out = cfg.summaries[Math.min(sIdx, cfg.summaries.length - 1)];
      sIdx++;
      return out;
    },
    async generateEnrichment() {
      throw new Error("unused");
    },
    async runSafetyClassifier(): Promise<SafetyResult> {
      const r = cfg.safety[Math.min(cIdx, cfg.safety.length - 1)];
      cIdx++;
      return r;
    },
  };
}

function goodOutput(): SmartSummaryOutput {
  return {
    advice: "Between work calls, take one slow breath.",
    insight: "I'm noticing work has felt heavy lately.",
    affirmation: "Choosing to check in with work on your plate is real care.",
    references_used: ["work"],
    word_count: 20,
    safety_flag: "none",
  };
}

function genericOutput(): SmartSummaryOutput {
  return {
    advice: "Take a small pause.",
    insight: "It might help to rest.",
    affirmation: "Showing up is enough.",
    references_used: [],
    word_count: 15,
    safety_flag: "none",
  };
}

function forbiddenOutput(): SmartSummaryOutput {
  return {
    advice: "You always freeze around work.",
    insight: "I know you struggle with this.",
    affirmation: "You're the kind of person who overthinks work.",
    references_used: ["work"],
    word_count: 20,
    safety_flag: "none",
  };
}

const noneSafety: SafetyResult = {
  flag: "none",
  reason: "ok",
  suggested_action: "regenerate",
  classifier_latency_ms: 10,
};

const hardSafety: SafetyResult = {
  flag: "hard",
  reason: "policy_violation",
  suggested_action: "safe_template",
  classifier_latency_ms: 10,
};

const criticalSafety: SafetyResult = {
  flag: "critical",
  reason: "crisis_indicator",
  suggested_action: "crisis_flow",
  classifier_latency_ms: 10,
};

describe("generateSmartSummary — SSOT E.7 + E.9", () => {
  it("returns the AI output on a clean happy path", async () => {
    const ai = stubAI({ summaries: [goodOutput()], safety: [noneSafety] });
    const run = await generateSmartSummary(
      { ai, clock: fixedClock(NOW) },
      {
        session_card: card(),
        memory_items: [],
        recent_summaries: [],
        stable_profile: profile(),
        avoided_topics: [],
        is_premium: false,
      },
    );
    expect(run.reason).toBe("ok");
    expect(run.output.advice).toMatch(/work/);
    expect(run.regenerations_used).toBe(0);
  });

  it("regenerates on generic output until one passes self-check", async () => {
    const ai = stubAI({
      summaries: [genericOutput(), goodOutput()],
      safety: [noneSafety, noneSafety],
    });
    const run = await generateSmartSummary(
      { ai, clock: fixedClock(NOW) },
      {
        session_card: card(),
        memory_items: [],
        recent_summaries: [],
        stable_profile: profile(),
        avoided_topics: [],
        is_premium: false,
      },
    );
    expect(run.reason).toBe("ok");
    expect(run.regenerations_used).toBe(1);
  });

  it("blocks forbidden language and falls back when exhausted", async () => {
    const ai = stubAI({
      summaries: Array.from({ length: MAX_REGENERATIONS + 1 }, () =>
        forbiddenOutput(),
      ),
      safety: [noneSafety],
    });
    const run = await generateSmartSummary(
      { ai, clock: fixedClock(NOW) },
      {
        session_card: card(),
        memory_items: [],
        recent_summaries: [],
        stable_profile: profile(),
        avoided_topics: [],
        is_premium: false,
      },
    );
    expect(run.reason).toBe("forbidden_language");
    expect(run.regenerations_used).toBe(MAX_REGENERATIONS);
  });

  it("falls back to crisis template when safety=critical", async () => {
    const ai = stubAI({
      summaries: [goodOutput()],
      safety: [criticalSafety],
    });
    const run = await generateSmartSummary(
      { ai, clock: fixedClock(NOW) },
      {
        session_card: card(),
        memory_items: [],
        recent_summaries: [],
        stable_profile: profile(),
        avoided_topics: [],
        is_premium: false,
      },
    );
    expect(run.reason).toBe("safety_critical");
    expect(run.output.safety_flag).toBe("critical");
  });

  it("falls back to safe template when safety=hard after max regenerations", async () => {
    const ai = stubAI({
      summaries: Array.from({ length: MAX_REGENERATIONS + 1 }, () =>
        goodOutput(),
      ),
      safety: Array.from({ length: MAX_REGENERATIONS + 1 }, () =>
        hardSafety,
      ),
    });
    const run = await generateSmartSummary(
      { ai, clock: fixedClock(NOW) },
      {
        session_card: card(),
        memory_items: [],
        recent_summaries: [],
        stable_profile: profile(),
        avoided_topics: [],
        is_premium: false,
      },
    );
    expect(run.reason).toBe("safety_hard");
  });

  it("regenerates when avoided topic mention is detected", async () => {
    const withAvoided: SmartSummaryOutput = {
      ...goodOutput(),
      insight: "Work feels heavy — maybe talk to your therapist.",
    };
    const ai = stubAI({
      summaries: [withAvoided, goodOutput()],
      safety: [noneSafety, noneSafety],
    });
    const run = await generateSmartSummary(
      { ai, clock: fixedClock(NOW) },
      {
        session_card: card(),
        memory_items: [],
        recent_summaries: [] as SessionSummaryV1Sync[],
        stable_profile: profile(),
        avoided_topics: ["therapist"],
        is_premium: false,
      },
    );
    expect(run.reason).toBe("ok");
    expect(run.regenerations_used).toBe(1);
  });
});
