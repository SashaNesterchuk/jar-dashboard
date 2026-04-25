import { describe, expect, it } from "vitest";
import {
  createPortalOpenAIAdapter,
  NotImplementedUntilEpic5Error,
} from "../openAiAI";

describe("PortalOpenAIAdapter stub (Spec §3.3, EPIC 5 pending)", () => {
  const adapter = createPortalOpenAIAdapter();

  it("generateSmartSummary throws NotImplementedUntilEpic5Error", async () => {
    await expect(
      adapter.generateSmartSummary({} as never),
    ).rejects.toBeInstanceOf(NotImplementedUntilEpic5Error);
  });

  it("generateEnrichment throws NotImplementedUntilEpic5Error", async () => {
    await expect(
      adapter.generateEnrichment({} as never),
    ).rejects.toBeInstanceOf(NotImplementedUntilEpic5Error);
  });

  it("runSafetyClassifier throws NotImplementedUntilEpic5Error", async () => {
    await expect(
      adapter.runSafetyClassifier({} as never),
    ).rejects.toBeInstanceOf(NotImplementedUntilEpic5Error);
  });

  it("error message references EPIC 5 for clarity", async () => {
    await expect(
      adapter.generateSmartSummary({} as never),
    ).rejects.toThrow(/EPIC 5/);
  });
});
