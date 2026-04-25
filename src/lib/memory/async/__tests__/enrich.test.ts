import { describe, expect, it } from "vitest";
import { enrichSession } from "../enrich";
import { createPortalDevAIAdapter } from "../../adapters/portal/portalDevAI";
import type { SessionCard, SessionSummaryV1Sync } from "../../types";

const NOW = new Date("2026-04-19T12:00:00Z");
const clock = { now: () => NOW };

function baseCard(): SessionCard {
  return {
    session_id: "sess_1",
    user_id: "user_enrich",
    session_type: "check_in",
    started_at: NOW.toISOString(),
    completed_at: NOW.toISOString(),
    entry_mood: "ok",
    exit_mood: null,
    user_stated_text: "Work has been stressful this week.",
    selected_emotions: [{ tKey: "e.tense", label: "tense" }],
    selected_triggers: [{ tKey: "t.work", label: "work", categoryId: "c" }],
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
      app_version: "0.0.0",
      locale: "en-US",
      timezone_offset: "+00:00",
    },
  };
}

function baseSync(): SessionSummaryV1Sync {
  return {
    session_id: "sess_1",
    session_type: "check_in",
    summary_version: "v1_sync",
    completed_at: NOW.toISOString(),
    user_stated: ["work has been stressful"],
    emotional_tone: {
      mood: "ok",
      emotions: ["tense"],
      valence: "negative",
    },
    themes_obvious: ["work"],
    helped_or_not: null,
    flags_runtime: ["none"],
    requires_async_enrichment: true,
  };
}

describe("enrich.enrichSession", () => {
  it("returns v2_enriched summary from AI adapter (ok path)", async () => {
    const ai = createPortalDevAIAdapter();
    const res = await enrichSession(
      { ai, clock },
      {
        session_card: baseCard(),
        sync_summary: baseSync(),
        recent_context: [],
      },
    );
    expect(res.reason).toBe("ok");
    expect(res.summary.summary_version).toBe("v2_enriched");
    expect(res.summary.session_id).toBe("sess_1");
  });

  it("falls back to empty v2 on AI error", async () => {
    const ai = createPortalDevAIAdapter({
      generateEnrichment: async () => {
        throw new Error("boom");
      },
    });
    const res = await enrichSession(
      { ai, clock },
      {
        session_card: baseCard(),
        sync_summary: baseSync(),
        recent_context: [],
      },
    );
    expect(res.reason).toBe("model_call_failed");
    expect(res.summary.candidate_hypotheses).toEqual([]);
  });

  it("rejects output containing forbidden language (D.4.6)", async () => {
    const ai = createPortalDevAIAdapter({
      generateEnrichment: async () => ({
        session_id: "sess_1",
        summary_version: "v2_enriched",
        enriched_at: NOW.toISOString(),
        themes_deep: ["work"],
        candidate_hypotheses: [
          {
            statement: "You have depression and anxiety.",
            strength: 0.8,
            theme: "mental_health",
          },
        ],
        cross_session_signals: [],
        effectiveness_observation: null,
      }),
    });
    const res = await enrichSession(
      { ai, clock },
      {
        session_card: baseCard(),
        sync_summary: baseSync(),
        recent_context: [],
      },
    );
    expect(res.reason).toBe("forbidden_language");
    expect(res.summary.candidate_hypotheses).toEqual([]);
  });

  it("clamps candidate hypothesis strength into [0,1]", async () => {
    const ai = createPortalDevAIAdapter({
      generateEnrichment: async () => ({
        session_id: "sess_1",
        summary_version: "v2_enriched",
        enriched_at: NOW.toISOString(),
        themes_deep: ["work"],
        candidate_hypotheses: [
          { statement: "Short walks help after work.", strength: 2.5, theme: "recovery" },
          { statement: "Journal prompts support focus.", strength: -0.3, theme: "focus" },
        ],
        cross_session_signals: [],
        effectiveness_observation: null,
      }),
    });
    const res = await enrichSession(
      { ai, clock },
      {
        session_card: baseCard(),
        sync_summary: baseSync(),
        recent_context: [],
      },
    );
    expect(res.reason).toBe("ok");
    expect(res.summary.candidate_hypotheses[0].strength).toBe(1);
    expect(res.summary.candidate_hypotheses[1].strength).toBe(0);
  });
});
