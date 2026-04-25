import { describe, expect, it } from "vitest";
import type { SmartSummaryOutput } from "../../adapters/ai";
import type { SessionCard, StableProfile } from "../../types";
import { couldBeAnyone, hasSpecificSignalReference, runSelfChecks } from "../selfCheck";

function card(): SessionCard {
  return {
    session_id: "s1",
    user_id: "u1",
    session_type: "check_in",
    started_at: "2026-04-19T09:00:00Z",
    completed_at: "2026-04-19T09:05:00Z",
    entry_mood: "ok",
    exit_mood: null,
    user_stated_text: "Meetings today made me tense.",
    selected_emotions: [{ tKey: "e.tired", label: "tired" }],
    selected_triggers: [
      { tKey: "t.meetings", label: "meetings", categoryId: "c" },
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
}

function output(overrides: Partial<SmartSummaryOutput> = {}): SmartSummaryOutput {
  return {
    advice: "Try a short walk between meetings.",
    insight: "I'm noticing tired comes up around meetings.",
    affirmation: "Acknowledging this already counts.",
    references_used: ["meetings"],
    word_count: 20,
    safety_flag: "none",
    ...overrides,
  };
}

describe("hasSpecificSignalReference", () => {
  it("returns true when output mentions an emotion", () => {
    expect(
      hasSpecificSignalReference(
        "You feel tired today.",
        { session_card: card(), stable_profile: null },
      ),
    ).toBe(true);
  });

  it("returns true when output mentions a trigger", () => {
    expect(
      hasSpecificSignalReference(
        "Let's look at meetings.",
        { session_card: card(), stable_profile: null },
      ),
    ).toBe(true);
  });

  it("returns false when output has no specific reference", () => {
    expect(
      hasSpecificSignalReference(
        "Take a gentle moment for yourself.",
        { session_card: card(), stable_profile: null },
      ),
    ).toBe(false);
  });

  it("returns true when output mentions a focus_area from stable_profile", () => {
    const profile = {
      declared: { focus_areas: ["sleep"] },
    } as unknown as StableProfile;
    expect(
      hasSpecificSignalReference(
        "Your sleep seems to set the tone.",
        { session_card: card(), stable_profile: profile },
      ),
    ).toBe(true);
  });
});

describe("couldBeAnyone", () => {
  it("true when no signal and no proper noun", () => {
    expect(
      couldBeAnyone(
        "take a gentle moment for yourself.",
        { session_card: card(), stable_profile: null },
      ),
    ).toBe(true);
  });

  it("false when a signal is referenced", () => {
    expect(
      couldBeAnyone(
        "Your meetings feel heavy today.",
        { session_card: card(), stable_profile: null },
      ),
    ).toBe(false);
  });
});

describe("runSelfChecks", () => {
  it("passes a specific, non-generic output", () => {
    const r = runSelfChecks(output(), {
      session_card: card(),
      stable_profile: null,
    });
    expect(r.ok).toBe(true);
  });

  it("fails when blocks are empty", () => {
    const r = runSelfChecks(
      output({ advice: "", insight: " ", affirmation: "" }),
      { session_card: card(), stable_profile: null },
    );
    expect(r.ok).toBe(false);
    expect(r.failures).toContain("zero_length_block");
  });

  it("fails when no signal is referenced and text is generic", () => {
    const r = runSelfChecks(
      output({
        advice: "Take a small pause.",
        insight: "It might help to rest.",
        affirmation: "Showing up is enough.",
      }),
      { session_card: card(), stable_profile: null },
    );
    expect(r.ok).toBe(false);
    expect(r.failures).toContain("missing_specific_signal");
  });
});
