import { describe, expect, it } from "vitest";
import {
  assertNoForbiddenLanguage,
  detectForbiddenLanguage,
  ForbiddenLanguageError,
  type ForbiddenCategory,
} from "../forbiddenLanguage";

function categories(text: string): ForbiddenCategory[] {
  return Array.from(
    new Set(detectForbiddenLanguage(text).map((m) => m.category)),
  ).sort();
}

describe("detectForbiddenLanguage — SSOT D.4.6", () => {
  it("flags diagnostic labels", () => {
    expect(categories("You might have anxiety disorder.")).toEqual([
      "diagnostic_label",
    ]);
    expect(categories("This is clearly depression.")).toEqual([
      "diagnostic_label",
    ]);
  });

  it("flags categorical assertions", () => {
    expect(categories("You always freeze when it matters.")).toEqual([
      "categorical_assertion",
    ]);
    expect(categories("This proves you are capable.")).toEqual([
      "categorical_assertion",
    ]);
  });

  it("flags 'I know you ...' while allowing 'I'm noticing'", () => {
    expect(categories("I know you want to rest.")).toEqual(["i_know_you"]);
    expect(detectForbiddenLanguage("I'm noticing you want to rest."))
      .toHaveLength(0);
  });

  it("flags psychological generalizations", () => {
    expect(categories("You're the kind of person who overthinks."))
      .toEqual(["psychological_generalization"]);
    expect(categories("People like you need more structure.")).toEqual([
      "psychological_generalization",
    ]);
  });

  it("assertNoForbiddenLanguage throws on violation", () => {
    expect(() =>
      assertNoForbiddenLanguage("You always freeze under pressure."),
    ).toThrowError(ForbiddenLanguageError);
  });

  it("assertNoForbiddenLanguage is a no-op on clean text", () => {
    expect(() =>
      assertNoForbiddenLanguage("I'm noticing that evenings feel heavy."),
    ).not.toThrow();
  });
});
