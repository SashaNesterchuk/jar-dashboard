/**
 * Portal `AIAdapter` implementation — stub.
 *
 * Spec §3.3: concrete calls (Smart Summary / enrichment / safety
 * classifier) go through Next.js API routes so the API key never ships
 * to the browser. EPIC 5 is the scope where these routes are built and
 * this adapter starts making real network calls.
 *
 * This file exists today so the MemoryProvider DI has something to
 * inject. Every method throws a stable, well-named error; consumers
 * that attempt to call the AI before EPIC 5 see it immediately rather
 * than hitting a mysterious undefined.
 */

import type {
  AIAdapter,
  EnrichmentInput,
  SafetyInput,
  SafetyResult,
  SmartSummaryInput,
  SmartSummaryOutput,
} from "../ai";
import type { SessionSummaryV2Enriched } from "../../types";

export class NotImplementedUntilEpic5Error extends Error {
  constructor(method: string) {
    super(
      `[memory.ai] ${method}() is not wired yet — see EPIC 5 (sync pipeline + safety). Spec §3.3.`,
    );
    this.name = "NotImplementedUntilEpic5Error";
  }
}

export function createPortalOpenAIAdapter(): AIAdapter {
  return {
    async generateSmartSummary(
      _input: SmartSummaryInput,
    ): Promise<SmartSummaryOutput> {
      throw new NotImplementedUntilEpic5Error("generateSmartSummary");
    },
    async generateEnrichment(
      _input: EnrichmentInput,
    ): Promise<SessionSummaryV2Enriched> {
      throw new NotImplementedUntilEpic5Error("generateEnrichment");
    },
    async runSafetyClassifier(_input: SafetyInput): Promise<SafetyResult> {
      throw new NotImplementedUntilEpic5Error("runSafetyClassifier");
    },
  };
}

export const portalOpenAIAdapter: AIAdapter = createPortalOpenAIAdapter();
