/**
 * Canonical onboarding answer shape — SSOT C.1.9 (Q1..Q7).
 *
 * The portal simulator collects these fields; the `build.ts` translator
 * converts them into memory items per SSOT D.1.2. Both free-text and
 * enum fields are mirrored exactly: the mobile app (on port) can feed
 * the same shape without changes.
 *
 * All fields are optional so partial / skipped anketas still produce a
 * deterministic item set. `user_name` is the only identity field and
 * maps to `immutable_fact`.
 */

export type OnboardingTimeBudget =
  | "lt_10_min"
  | "10_30_min"
  | "30_60_min"
  | "gt_60_min";

export type OnboardingTimingPreference =
  | "morning"
  | "midday"
  | "evening"
  | "late_night"
  | "when_overwhelming"
  | "no_specific_time";

export interface OnboardingAnswers {
  /** Q0 — user name (immutable_fact, D.1.2). */
  user_name?: string;
  /** Q1 — primary motivation(s) (declared_preference, D.1.2). */
  primary_motivation?: string[];
  /** Q2 — pain map (temporary_constraint, D.1.2). */
  pain_map?: string[];
  /** Q3 — focus areas (declared_preference). */
  focus_areas?: string[];
  /** Q4 — support style (declared_preference). */
  support_style?: string;
  /** Q5a — realistic action formats (declared_preference). */
  realistic_action_modes?: string[];
  /** Q5b — daily time budget (declared_preference). */
  daily_time_budget?: OnboardingTimeBudget;
  /** Q6 — when support is needed (declared_preference). */
  support_timing_preference?: OnboardingTimingPreference;
  /** Q7 — avoided topics (declared_boundary). */
  avoided_topics?: string[];
}
