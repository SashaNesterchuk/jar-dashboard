"use client";

/**
 * `useOnboardingSubmit(userId)` — persists the Q1..Q7 anketa.
 *
 * Pipeline (SSOT C.1.9 + D.1.2):
 *   1. `buildOnboardingItems()` (pure) → items + paired audits.
 *   2. `StorageAdapter.upsertMemoryItem(item, audit)` per item — the
 *      adapter guarantees atomic item+audit persistence (SSOT D.6).
 *   3. Merge declared / basics / current_constraints into
 *      `StableProfile` (SSOT D.8).
 *   4. Emit `onboarding_completed` telemetry so downstream analytics
 *      can hook in without re-reading storage.
 */

import * as React from "react";
import {
  buildOnboardingItems,
  type BuildOnboardingResult,
} from "../onboarding/build";
import type { OnboardingAnswers } from "../onboarding/types";
import type {
  MemoryItem,
  StableProfile,
  StableProfileActivitySnapshot,
} from "../types";
import {
  useMemoryClock,
  useMemoryStorage,
  useMemoryTelemetry,
} from "./useMemoryContext";

export interface UseOnboardingSubmitResult {
  submit: (answers: OnboardingAnswers) => Promise<OnboardingSubmitResult>;
  isSubmitting: boolean;
  error: Error | null;
}

export interface OnboardingSubmitResult {
  items: MemoryItem[];
  stable_profile: StableProfile;
  build: BuildOnboardingResult;
}

export function useOnboardingSubmit(
  userId: string | null | undefined,
): UseOnboardingSubmitResult {
  const storage = useMemoryStorage();
  const clock = useMemoryClock();
  const telemetry = useMemoryTelemetry();

  const [isSubmitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const submit = React.useCallback(
    async (answers: OnboardingAnswers): Promise<OnboardingSubmitResult> => {
      if (!userId) throw new Error("useOnboardingSubmit: missing userId");
      setSubmitting(true);
      setError(null);
      try {
        const now = clock.now();
        const build = buildOnboardingItems(answers, { user_id: userId, now });

        // SSOT D.6 — item + audit persisted atomically by the adapter.
        for (let i = 0; i < build.items.length; i++) {
          await storage.upsertMemoryItem(build.items[i], build.audits[i]);
        }

        const profile = await mergeStableProfile(
          storage,
          userId,
          build,
          now,
        );

        telemetry.capture("memory.onboarding_completed", {
          user_id: userId,
          item_count: build.items.length,
          has_boundaries:
            (answers.avoided_topics?.length ?? 0) > 0 ? "yes" : "no",
        });

        return {
          items: build.items,
          stable_profile: profile,
          build,
        };
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [userId, storage, clock, telemetry],
  );

  return { submit, isSubmitting, error };
}

/* ------------------------------------------------------------ helpers */

async function mergeStableProfile(
  storage: ReturnType<typeof useMemoryStorage>,
  userId: string,
  build: BuildOnboardingResult,
  now: Date,
): Promise<StableProfile> {
  const existing = await storage.getStableProfile(userId);
  const activity: StableProfileActivitySnapshot =
    existing?.activity_snapshot ?? {
      total_sessions: 0,
      days_active_in_last_14: 0,
      text_sessions_ratio: 0,
      streak_status: "none",
    };

  const merged: StableProfile = {
    user_id: userId,
    basics: {
      name: build.stable_profile.basics.name ?? existing?.basics.name ?? null,
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
    activity_snapshot: activity,
  };

  await storage.upsertStableProfile(merged);
  return merged;
}
