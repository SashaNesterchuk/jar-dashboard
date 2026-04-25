/**
 * Unit tests for the onboarding translator (SSOT C.1.9 + D.1.2).
 *
 * Verifies that each anketa field maps to the canonical `MemoryItem`
 * type, that confidences come from the signal registry, and that a
 * paired audit row is produced for every item (SSOT D.6 pre-condition).
 */

import { describe, expect, it } from "vitest";
import { buildOnboardingItems } from "../build";
import type { OnboardingAnswers } from "../types";

const USER_ID = "u_onb";
const NOW = new Date("2026-04-19T09:00:00Z");

describe("buildOnboardingItems (SSOT D.1.2)", () => {
  it("maps the full anketa to the canonical set of types", () => {
    const answers: OnboardingAnswers = {
      user_name: "Alex",
      primary_motivation: ["I feel anxious or overwhelmed"],
      pain_map: ["Stress", "Sleep"],
      focus_areas: ["Managing stress and anxiety"],
      support_style: "Gentle and calming",
      realistic_action_modes: ["Quick check-ins", "Journaling"],
      daily_time_budget: "lt_10_min",
      support_timing_preference: "evening",
      avoided_topics: ["Death and loss"],
    };

    const { items, audits, stable_profile } = buildOnboardingItems(answers, {
      user_id: USER_ID,
      now: NOW,
    });

    const typeCounts = items.reduce<Record<string, number>>((acc, it) => {
      acc[it.type] = (acc[it.type] ?? 0) + 1;
      return acc;
    }, {});

    expect(typeCounts.immutable_fact).toBe(1); // user_name
    expect(typeCounts.declared_preference).toBe(
      1 /* primary_motivation */ +
        1 /* focus_area */ +
        1 /* support_style */ +
        2 /* realistic_action_modes */ +
        1 /* daily_time_budget */ +
        1 /* support_timing_preference */,
    );
    expect(typeCounts.temporary_constraint).toBe(2); // pain_map
    expect(typeCounts.declared_boundary).toBe(1); // avoided_topic

    // All items use the onboarding base confidence (SSOT D.5.1 row 1).
    for (const item of items) {
      expect(item.confidence).toBeCloseTo(0.85);
      expect(item.user_id).toBe(USER_ID);
      expect(item.status).toBe("active");
      expect(item.sources).toHaveLength(1);
      expect(item.sources[0].source_type).toBe("onboarding");
      expect(item.sources[0].signal_kind).toBe("declaration");
    }

    expect(audits).toHaveLength(items.length);
    for (const audit of audits) {
      expect(audit.action).toBe("confirm");
      expect(audit.user_id).toBe(USER_ID);
      expect(audit.new_state.confidence).toBeCloseTo(0.85);
    }

    expect(stable_profile.basics.name).toBe("Alex");
    expect(stable_profile.declared.focus_areas).toEqual([
      "Managing stress and anxiety",
    ]);
    expect(stable_profile.current_constraints.avoided_topics).toEqual([
      "Death and loss",
    ]);
    expect(
      items.find((item) => item.statement_internal.startsWith("primary_motivation"))
        ?.statement_user_facing,
    ).toBe(
      "You came here mainly because feeling anxious or overwhelmed has been present.",
    );
    expect(
      items.find((item) => item.statement_internal.startsWith("focus_area"))
        ?.statement_user_facing,
    ).toBe("You want to focus on managing stress and anxiety.");
  });

  it("is tolerant of partial answers (skipped anketa)", () => {
    const { items, audits, stable_profile } = buildOnboardingItems(
      {
        user_name: "Sam",
      },
      { user_id: USER_ID, now: NOW },
    );
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("immutable_fact");
    expect(audits).toHaveLength(1);
    expect(stable_profile.declared.focus_areas).toBeUndefined();
  });

  it("does not create items for blank inputs or skip markers", () => {
    const { items } = buildOnboardingItems(
      {
        user_name: "   ",
        pain_map: ["prefer_not_to_say"],
      },
      { user_id: USER_ID, now: NOW },
    );
    expect(items).toHaveLength(0);
  });

  it("declared boundaries land on memory_screen visibility (C.3.2)", () => {
    const { items } = buildOnboardingItems(
      { avoided_topics: ["Grief"] },
      { user_id: USER_ID, now: NOW },
    );
    expect(items[0].type).toBe("declared_boundary");
    expect(items[0].visibility_scope).toBe("memory_screen");
    expect(items[0].statement_user_facing).toBe("Approach grief carefully.");
    expect(items[0].sensitivity_level).toBe("sensitive");
  });
});
