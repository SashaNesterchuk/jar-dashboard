import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_USER_FACING_PHRASES,
  assertAllowedCopy,
  checkAllowedCopy,
} from "../copyConstraints";

describe("copyConstraints (SSOT B.4.5)", () => {
  it("allows neutral copy", () => {
    const verdict = checkAllowedCopy(
      "Your Personalization — here's what this portal is tracking.",
    );
    expect(verdict.allowed).toBe(true);
    expect(verdict.offending_phrase).toBeNull();
  });

  it.each(FORBIDDEN_USER_FACING_PHRASES)(
    "rejects forbidden phrase %q",
    (phrase) => {
      const verdict = checkAllowedCopy(`${phrase} today`);
      expect(verdict.allowed).toBe(false);
      expect(verdict.offending_phrase).toBe(phrase);
    },
  );

  it("assertAllowedCopy throws with context", () => {
    expect(() =>
      assertAllowedCopy(
        "What I know about you so far",
        "smart summary header",
      ),
    ).toThrow(/smart summary header/);
  });

  it("case-insensitive detection", () => {
    const verdict = checkAllowedCopy("I KNOW YOU want support.");
    expect(verdict.allowed).toBe(false);
    expect(verdict.offending_phrase).toBe("i know you");
  });
});
