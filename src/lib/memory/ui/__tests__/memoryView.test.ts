import { describe, expect, it } from "vitest";
import { projectMemoryScreen } from "../memoryView";
import { makeItem, withType } from "../../__tests__/fixtures";

const NOW = new Date("2026-04-19T12:00:00Z");

describe("projectMemoryScreen (SSOT C.3.2 + C.3.3)", () => {
  it("buckets items by type and hides low-confidence observations", () => {
    const items = [
      withType(makeItem({ id: "fact" }), "immutable_fact"),
      withType(makeItem({ id: "pref" }), "declared_preference"),
      withType(makeItem({ id: "boundary" }), "declared_boundary"),
      withType(
        makeItem({ id: "insight", confidence: 0.8 }),
        "confirmed_insight",
      ),
      withType(
        makeItem({ id: "hypo", confidence: 0.5 }),
        "hypothesis",
      ),
      withType(
        makeItem({ id: "obs_weak", confidence: 0.2 }),
        "observation",
      ),
      withType(
        makeItem({ id: "obs_strong", confidence: 0.55 }),
        "observation",
      ),
    ];
    const view = projectMemoryScreen({ items, now: NOW });

    expect(view.basics.facts.map((p) => p.item.id)).toEqual(["fact"]);
    expect(view.basics.declared_preferences.map((p) => p.item.id)).toEqual([
      "pref",
    ]);
    expect(view.boundaries.map((p) => p.item.id)).toEqual(["boundary"]);
    expect(view.helps.map((p) => p.item.id).sort()).toEqual(
      ["hypo", "insight"].sort(),
    );
    expect(view.patterns.map((p) => p.item.id)).toEqual(["obs_strong"]);
    expect(view.hidden_count).toBe(1);
  });

  it("assigns correct softener + tier labels (SSOT C.3.3)", () => {
    const items = [
      withType(
        makeItem({ id: "insight", confidence: 0.9 }),
        "confirmed_insight",
      ),
      withType(
        makeItem({ id: "hypo", confidence: 0.5 }),
        "hypothesis",
      ),
      withType(
        makeItem({ id: "obs", confidence: 0.5 }),
        "observation",
      ),
    ];
    const view = projectMemoryScreen({ items, now: NOW });

    const insight = view.helps.find((p) => p.item.id === "insight")!;
    const hypo = view.helps.find((p) => p.item.id === "hypo")!;
    const obs = view.patterns[0];

    expect(insight.tier).toBe("confirmed");
    expect(insight.softener).toBeNull();
    expect(insight.opacity).toBe(1);

    expect(hypo.tier).toBe("hypothesis");
    expect(hypo.softener).toBe("It seems");
    expect(hypo.opacity).toBeLessThan(1);

    expect(obs.tier).toBe("observation");
    expect(obs.softener).toBe("I'm noticing");
    expect(obs.tier_label).toBe("Recent pattern");
  });

  it("hides items flagged hidden or removed_by_user", () => {
    const items = [
      withType(
        makeItem({
          id: "hidden",
          confidence: 0.8,
          visibility_scope: "hidden",
        }),
        "confirmed_insight",
      ),
      withType(
        makeItem({
          id: "removed",
          status: "removed_by_user",
          confidence: 0.8,
        }),
        "hypothesis",
      ),
      withType(
        makeItem({ id: "re_check", status: "re_check", confidence: 0.6 }),
        "hypothesis",
      ),
    ];
    const view = projectMemoryScreen({ items, now: NOW });
    expect(view.helps.length).toBe(0);
    expect(view.hidden_count).toBe(3);
  });

  it("sorts items by active_confidence desc within each block", () => {
    const items = [
      withType(
        makeItem({ id: "h_low", confidence: 0.45 }),
        "hypothesis",
      ),
      withType(
        makeItem({ id: "h_high", confidence: 0.75 }),
        "hypothesis",
      ),
    ];
    const view = projectMemoryScreen({ items, now: NOW });
    expect(view.helps.map((p) => p.item.id)).toEqual(["h_high", "h_low"]);
  });
});
