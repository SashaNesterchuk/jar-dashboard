import { describe, expect, it } from "vitest";
import type { SessionCard } from "../../types";
import {
  buildSessionSummaryV1Sync,
  resolveHelpedOrNot,
  resolveValence,
  splitUserStated,
} from "../summary";

function card(overrides: Partial<SessionCard> = {}): SessionCard {
  const base: SessionCard = {
    session_id: "s1",
    user_id: "u1",
    session_type: "check_in",
    started_at: new Date("2026-04-19T09:00:00Z").toISOString(),
    completed_at: new Date("2026-04-19T09:05:00Z").toISOString(),
    entry_mood: "ok",
    exit_mood: null,
    user_stated_text: null,
    selected_emotions: [],
    selected_triggers: [],
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

describe("splitUserStated", () => {
  it("splits by sentence terminators and newlines", () => {
    expect(splitUserStated("Hello. How are you?\nFine!")).toEqual([
      "Hello.",
      "How are you?",
      "Fine!",
    ]);
  });

  it("returns [] for null / empty", () => {
    expect(splitUserStated(null)).toEqual([]);
    expect(splitUserStated("   ")).toEqual([]);
  });
});

describe("resolveValence", () => {
  it("combines mood + emotions into a single valence", () => {
    expect(
      resolveValence(
        card({
          entry_mood: "good",
          selected_emotions: [{ tKey: "e", label: "calm" }],
        }),
      ),
    ).toBe("positive");
  });

  it("returns 'mixed' when mood and emotions disagree", () => {
    expect(
      resolveValence(
        card({
          entry_mood: "good",
          selected_emotions: [{ tKey: "e", label: "anxious" }],
        }),
      ),
    ).toBe("mixed");
  });

  it("returns 'neutral' when both inputs are neutral", () => {
    expect(resolveValence(card({ entry_mood: "ok" }))).toBe("neutral");
  });
});

describe("resolveHelpedOrNot — SSOT E.4.1", () => {
  const base = card({
    practice_specific: {
      practice_id: "p1",
      effectiveness_self_report: null,
      duration_seconds: 120,
    },
  });

  it("#1 explicit Better → yes", () => {
    const c = card({
      practice_specific: {
        practice_id: "p1",
        effectiveness_self_report: "better",
        duration_seconds: 120,
      },
    });
    expect(resolveHelpedOrNot(c)).toBe("yes");
  });

  it("#2 explicit Worse → no (overrides soft)", () => {
    const c = card({
      practice_specific: {
        practice_id: "p1",
        effectiveness_self_report: "worse",
        duration_seconds: 120,
      },
    });
    expect(
      resolveHelpedOrNot(c, {
        mood_improved: true,
        supportive_completion: true,
      }),
    ).toBe("no");
  });

  it("#3 aligned soft signals → yes", () => {
    expect(
      resolveHelpedOrNot(base, {
        mood_improved: true,
        supportive_completion: true,
      }),
    ).toBe("yes");
  });

  it("#4 contradicting soft signals → unclear", () => {
    expect(
      resolveHelpedOrNot(base, {
        mood_improved: true,
        supportive_completion: true,
        mood_worsened: true,
      }),
    ).toBe("unclear");
  });

  it("#5 no signals → null", () => {
    expect(resolveHelpedOrNot(base)).toBeNull();
  });

  it("explicit Same → unclear", () => {
    const c = card({
      practice_specific: {
        practice_id: "p1",
        effectiveness_self_report: "same",
        duration_seconds: 120,
      },
    });
    expect(resolveHelpedOrNot(c)).toBe("unclear");
  });
});

describe("buildSessionSummaryV1Sync", () => {
  it("assembles a canonical v1_sync summary", () => {
    const c = card({
      user_stated_text: "I felt tense. A short walk helped.",
      selected_emotions: [
        { tKey: "e.tired", label: "tired" },
        { tKey: "e.calm", label: "calm" },
      ],
      selected_triggers: [
        { tKey: "t.work", label: "work", categoryId: "ctx" },
      ],
      flags_initial: ["sensitive_topic_mentioned"],
    });
    const s = buildSessionSummaryV1Sync({ card: c });
    expect(s.summary_version).toBe("v1_sync");
    expect(s.user_stated).toHaveLength(2);
    expect(s.emotional_tone.emotions).toEqual(["tired", "calm"]);
    expect(s.emotional_tone.valence).toBe("mixed");
    expect(s.themes_obvious).toEqual(["work"]);
    expect(s.flags_runtime).toContain("sensitive");
    expect(s.requires_async_enrichment).toBe(true);
  });

  it("sets requires_async_enrichment=false for empty breathing session", () => {
    const c = card({
      session_type: "breathing",
      user_stated_text: null,
    });
    const s = buildSessionSummaryV1Sync({ card: c });
    expect(s.requires_async_enrichment).toBe(false);
  });
});
