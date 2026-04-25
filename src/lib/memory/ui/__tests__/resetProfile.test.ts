import { describe, expect, it } from "vitest";
import { blankStableProfile, prepareReset } from "../resetProfile";
import { makeItem, withType } from "../../__tests__/fixtures";
import type { MemoryItem } from "../../types";

const NOW = new Date("2026-04-19T12:00:00Z");

function mkItems(): MemoryItem[] {
  return [
    withType(makeItem({ id: "fact" }), "immutable_fact"),
    withType(makeItem({ id: "pref" }), "declared_preference"),
    withType(makeItem({ id: "boundary" }), "declared_boundary"),
    withType(makeItem({ id: "obs" }), "observation"),
    withType(makeItem({ id: "hypo" }), "hypothesis"),
    withType(makeItem({ id: "insight" }), "confirmed_insight"),
  ];
}

describe("prepareReset (SSOT C.3.2 block 4)", () => {
  it("interpretation reset removes observation/hypothesis/insight only", () => {
    const { items, audits } = prepareReset(mkItems(), "interpretation", NOW);
    expect(items.map((i) => i.id).sort()).toEqual(["hypo", "insight", "obs"]);
    for (const i of items) expect(i.status).toBe("removed_by_user");
    expect(audits.length).toBe(items.length);
    for (const a of audits) expect(a.action).toBe("correction");
  });

  it("full reset removes all non-already-removed items", () => {
    const { items } = prepareReset(mkItems(), "full", NOW);
    expect(items.map((i) => i.id).sort()).toEqual(
      ["boundary", "fact", "hypo", "insight", "obs", "pref"].sort(),
    );
  });

  it("is idempotent on already-removed items", () => {
    const input = [
      withType(
        makeItem({ id: "gone", status: "removed_by_user" }),
        "hypothesis",
      ),
    ];
    const { items } = prepareReset(input, "full", NOW);
    expect(items).toEqual([]);
  });
});

describe("blankStableProfile", () => {
  it("clears declared data but preserves sign_up_date", () => {
    const profile = blankStableProfile({
      userId: "user_1",
      existing: null,
      now: NOW,
    });
    expect(profile.confidence_level).toBe("A");
    expect(profile.declared.focus_areas).toEqual([]);
    expect(profile.basics.sign_up_date).toBe(NOW.toISOString());
  });
});
