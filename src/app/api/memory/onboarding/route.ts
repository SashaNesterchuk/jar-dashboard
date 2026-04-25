/**
 * Thin transport for the onboarding simulator — SSOT C.1.9 + D.1.2.
 *
 * POST /api/memory/onboarding
 *
 * Body (JSON):
 *   {
 *     user_id: string,
 *     answers: OnboardingAnswers
 *   }
 *
 * Response:
 *   { items: MemoryItem[], audits: MemoryAuditEvent[], stable_profile }
 *
 * Uses the same pure translator as the React hook but writes to the
 * shared server-side adapter bundle so items persist across requests
 * within the serverless process. Spec §3.3.
 */

import { NextResponse } from "next/server";
import { buildOnboardingItems } from "@/lib/memory/onboarding/build";
import type { OnboardingAnswers } from "@/lib/memory/onboarding/types";
import type { StableProfile } from "@/lib/memory/types";
import {
  sharedClock as clock,
  sharedStorage as storage,
  sharedTelemetry as telemetry,
} from "../_shared/adapters";
import { guardServerSmokeRoute } from "../_shared/localFirst";

interface ApiPayload {
  user_id: string;
  answers: OnboardingAnswers;
}

export async function POST(request: Request) {
  try {
    const guard = guardServerSmokeRoute();
    if (guard) return guard;

    const body = (await request.json()) as ApiPayload;
    if (!body?.user_id) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 },
      );
    }

    const now = clock.now();
    const build = buildOnboardingItems(body.answers ?? {}, {
      user_id: body.user_id,
      now,
    });

    for (let i = 0; i < build.items.length; i++) {
      await storage.upsertMemoryItem(build.items[i], build.audits[i]);
    }

    const existing = await storage.getStableProfile(body.user_id);
    const merged: StableProfile = {
      user_id: body.user_id,
      basics: {
        name:
          build.stable_profile.basics.name ??
          existing?.basics.name ??
          null,
        locale: existing?.basics.locale ?? null,
        sign_up_date:
          existing?.basics.sign_up_date ?? now.toISOString(),
      },
      declared: {
        primary_motivation:
          build.stable_profile.declared.primary_motivation ??
          existing?.declared.primary_motivation ?? [],
        top_value:
          build.stable_profile.declared.top_value ??
          existing?.declared.top_value ??
          null,
        focus_areas:
          build.stable_profile.declared.focus_areas ??
          existing?.declared.focus_areas ?? [],
        support_style:
          build.stable_profile.declared.support_style ??
          existing?.declared.support_style ??
          null,
        realistic_action_modes:
          build.stable_profile.declared.realistic_action_modes ??
          existing?.declared.realistic_action_modes ?? [],
        daily_time_budget:
          build.stable_profile.declared.daily_time_budget ??
          existing?.declared.daily_time_budget ??
          null,
        support_timing_preference:
          build.stable_profile.declared.support_timing_preference ??
          existing?.declared.support_timing_preference ??
          null,
      },
      current_constraints: {
        pain_map:
          build.stable_profile.current_constraints.pain_map ??
          existing?.current_constraints.pain_map ?? [],
        avoided_topics:
          build.stable_profile.current_constraints.avoided_topics ??
          existing?.current_constraints.avoided_topics ?? [],
        current_life_context:
          existing?.current_constraints.current_life_context ?? [],
      },
      what_tends_to_help: existing?.what_tends_to_help ?? [],
      active_hypotheses: existing?.active_hypotheses ?? [],
      confirmed_insights: existing?.confirmed_insights ?? [],
      confidence_level: existing?.confidence_level ?? "A",
      user_confidence_score: existing?.user_confidence_score ?? 0,
      last_refreshed_at: now.toISOString(),
      activity_snapshot:
        existing?.activity_snapshot ?? {
          total_sessions: 0,
          days_active_in_last_14: 0,
          text_sessions_ratio: 0,
          streak_status: "none",
        },
    };

    await storage.upsertStableProfile(merged);

    telemetry.capture("memory.onboarding_completed", {
      user_id: body.user_id,
      item_count: build.items.length,
      has_boundaries:
        (body.answers?.avoided_topics?.length ?? 0) > 0 ? "yes" : "no",
    });

    return NextResponse.json({
      items: build.items,
      audits: build.audits,
      stable_profile: merged,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: msg, stack: e instanceof Error ? e.stack : undefined },
      { status: 500 },
    );
  }
}
