import { describe, expect, it } from "vitest";
import {
  applyRecalibration,
  clearsRecalibration,
  isPauseExceeded,
  RECALIBRATION_COPY,
  recalibrationFactor,
} from "../recalibration";

// SSOT D.7.

describe("recalibrationFactor / isPauseExceeded (SSOT D.7)", () => {
  it("threshold is 7 days", () => {
    expect(isPauseExceeded(6)).toBe(false);
    expect(isPauseExceeded(7)).toBe(true);
    expect(isPauseExceeded(14)).toBe(true);
  });

  it("observation and hypothesis get factor 0.6", () => {
    expect(recalibrationFactor("observation")).toBe(0.6);
    expect(recalibrationFactor("hypothesis")).toBe(0.6);
  });

  it("confirmed_insight gets factor 0.8", () => {
    expect(recalibrationFactor("confirmed_insight")).toBe(0.8);
  });

  it("facts and declared items are untouched (factor 1.0)", () => {
    expect(recalibrationFactor("immutable_fact")).toBe(1);
    expect(recalibrationFactor("declared_preference")).toBe(1);
    expect(recalibrationFactor("declared_boundary")).toBe(1);
    expect(recalibrationFactor("temporary_constraint")).toBe(1);
  });
});

describe("applyRecalibration", () => {
  it("is a no-op below the 7-day threshold", () => {
    expect(applyRecalibration(0.5, "hypothesis", 0)).toBe(0.5);
    expect(applyRecalibration(0.5, "hypothesis", 6)).toBe(0.5);
  });

  it("reduces hypothesis/observation active_confidence by 0.6 factor after pause", () => {
    expect(applyRecalibration(0.5, "hypothesis", 7)).toBeCloseTo(0.3, 10);
    expect(applyRecalibration(0.8, "observation", 10)).toBeCloseTo(0.48, 10);
  });

  it("reduces confirmed_insight by 0.8", () => {
    expect(applyRecalibration(0.9, "confirmed_insight", 8)).toBeCloseTo(0.72, 10);
  });

  it("does not alter facts/declared items even after long pause", () => {
    expect(applyRecalibration(0.5, "immutable_fact", 100)).toBe(0.5);
    expect(applyRecalibration(0.5, "declared_preference", 100)).toBe(0.5);
    expect(applyRecalibration(0.5, "declared_boundary", 100)).toBe(0.5);
  });

  it("clamps result into [0, 1]", () => {
    expect(applyRecalibration(1.5, "hypothesis", 10)).toBeLessThanOrEqual(1);
    expect(applyRecalibration(-0.5, "hypothesis", 10)).toBe(0);
  });
});

describe("clearsRecalibration (SSOT D.7 #4)", () => {
  it("completed_checkin_with_text clears", () => {
    expect(clearsRecalibration({ completed_checkin_with_text: true })).toBe(true);
  });

  it("text-bearing source types clear", () => {
    expect(clearsRecalibration({ source_type: "check_in_text" })).toBe(true);
    expect(clearsRecalibration({ source_type: "reflection" })).toBe(true);
    expect(clearsRecalibration({ source_type: "journal" })).toBe(true);
  });

  it("yes_that_fits (explicit confirmation) clears", () => {
    expect(clearsRecalibration({ signal_id: "yes_that_fits" })).toBe(true);
  });

  it("resonance signals do NOT clear", () => {
    expect(clearsRecalibration({ signal_id: "like" })).toBe(false);
    expect(clearsRecalibration({ signal_id: "echo_save" })).toBe(false);
    expect(clearsRecalibration({ signal_id: "dislike" })).toBe(false);
  });

  it("practice_better does NOT clear (not a text check-in, not an explicit confirmation)", () => {
    expect(clearsRecalibration({ signal_id: "practice_better" })).toBe(false);
  });
});

describe("RECALIBRATION_COPY (SSOT D.7 [COPY])", () => {
  it("return_prompt matches SSOT verbatim", () => {
    expect(RECALIBRATION_COPY.return_prompt).toBe(
      "It's been a bit. Want to check in briefly, or jump into something short?",
    );
  });

  it("memory_screen_banner matches SSOT verbatim", () => {
    expect(RECALIBRATION_COPY.memory_screen_banner).toBe(
      "Some of what I noticed may be outdated. Feel free to tell me what still fits.",
    );
  });
});
