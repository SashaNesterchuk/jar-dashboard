# Memory Debug Fix Plan

Source analyzed: `mindjar-memory-debug-2026-04-25T13-17-19-548Z.txt`

SSOT reference: `../docs/2026/MindJar_consolidated_documentation_system_19_04_2026_03-16.md`

## Current Status

The current memory export is much closer to the SSOT than the previous run:

- Local-first storage is working: memory items, session cards, summaries, stable profile, and debug state are stored locally.
- Clean reset removed duplicated onboarding-derived memory items.
- Onboarding answer translation mostly matches SSOT D.1.2.
- No unsupported `hypothesis` or `confirmed_insight` items are created from sparse data.
- Low-confidence observations are stored for debug/retrieval, but should not be shown in the user-facing memory projection.

The remaining issues are mostly correctness, copy, and state hygiene issues.

## Fixes Needed

### 1. Update `stable_profile.activity_snapshot` After Sessions

Status: implemented.

Problem:

- Export has 4 recent `quick_check_in` summaries.
- `stable_profile.activity_snapshot.total_sessions` is still `0`.
- `days_active_in_last_14` is still `0`.
- `text_sessions_ratio` is still `0`.

Why this matters:

- SSOT D.8 defines `stable_profile` as a derived runtime view over memory/session state.
- The current profile is true for onboarding data, but stale for session activity.

Fix:

- After `useSessionSubmit` stores a session card and v1 summary, recompute and upsert the profile activity snapshot.
- Count sessions for the current user from local storage.
- Compute active days over last 14 days.
- Compute text session ratio from session cards / summaries.

Acceptance:

- After 1 check-in, `total_sessions >= 1`.
- After multiple same-day check-ins, `days_active_in_last_14 === 1`.
- After check-ins with no free text, `text_sessions_ratio === 0`.

### 2. Correct Observation Source Type

Status: implemented with canonical `trigger_tags` source type.

Problem:

- Observations from selected tags/triggers use `source_type: "check_in_text"`.
- In the export, `user_stated` is empty, so this is inaccurate.

Why this matters:

- SSOT D.3/D.5 require evidence and audit trails to reflect the real source.
- Debug/audit should not claim a text signal when the source was a selected trigger.

Fix:

- Add or use a source kind for selected check-in tags/triggers, for example:
  - `selected_trigger`
  - `check_in_selection`
- Use `check_in_text` only when the user actually typed free text.

Acceptance:

- Observations created from selected triggers no longer use `check_in_text`.
- Observations created from free-text reflection/check-in text still use a text source.

### 3. Fix User-Facing Copy For Onboarding Items

Status: implemented for primary motivation, focus-area pronouns, and boundary framing.

Problem examples from export:

- `You came here mainly to i feel anxious or overwhelmed.`
- `You want to focus on understanding my patterns.`
- `I'll be careful with Body / appearance.`

Why this matters:

- SSOT C.3 and B.4.5 require privacy-comfortable, clear user-facing language.
- Copy should not sound like broken grammar or like the AI is making an invasive claim.

Fix:

- Normalize onboarding-derived copy at item creation.
- Suggested replacements:
  - `You came here mainly because feeling anxious or overwhelmed has been present.`
  - `You want to focus on understanding your patterns.`
  - `Approach body / appearance carefully.`

Acceptance:

- No lowercase `i` appears inside generated user-facing onboarding copy unless it is literal user input that should be preserved.
- Focus area copy uses `your patterns`, not `my patterns`.
- Boundary copy does not overuse AI-first `I'll...` framing.

### 4. Align `declared_boundary.visibility_scope` With Memory Screen

Status: implemented by setting onboarding boundaries to `memory_screen`.

Problem:

- `declared_boundary` for `Body / appearance` has `visibility_scope: "plan_context"`.
- SSOT C.3.2 says declared boundaries are part of Memory screen Block 1.

Why this matters:

- Boundaries are user-controlled memory and should be visible/correctable in `Your Personalization`.

Fix:

- Either support multiple scopes explicitly, or set declared boundaries to a scope that includes Memory screen.
- For current implementation, prefer `visibility_scope: "memory_screen"` unless a broader enum is introduced.

Acceptance:

- Declared boundaries appear in the `Your Personalization` projection.
- Boundaries are still available to Smart Summary / Plan retrieval as safety constraints.

### 5. Rename Or Split Safety Telemetry Event

Status: implemented with `safety_classifier_completed` for all runs and `safety_flag_raised` only for non-`none` flags.

Problem:

- Telemetry logs `safety_flag_raised` even when classifier returns `flag: "none"`.

Why this matters:

- A `none` classification is not a raised safety flag.
- Debug output becomes misleading.

Fix options:

- Preferred: add `safety_classifier_completed` for all classifier runs.
- Keep `safety_flag_raised` only for `soft`, `hard`, and `critical`.

Acceptance:

- `flag: "none"` no longer appears under `safety_flag_raised`.
- Debug still shows classifier completion data for normal safe outputs.

### 6. Keep Low-Confidence Observations Out Of User-Facing Memory

Current state:

Status: verified in existing projection/retrieval rules.

- Observations like `Partner`, `Home`, `Rest`, `Sunny` have `confidence: 0.25`.
- This is acceptable in raw debug storage.

Risk:

- They should not appear in `Your Personalization` because SSOT C.3.3 forbids raw low-confidence hypotheses/observations below `0.4`.

Fix:

- Keep `projectMemoryScreen` filtering confidence `< 0.4`.
- Ensure Smart Summary retrieval also excludes or heavily downranks these items unless the surface explicitly needs raw debug signals.

Acceptance:

- `Your Personalization` does not show `0.25` observations.
- Smart Summary prompt context does not include noisy low-confidence observations as user claims.

## Priority Order

1. Fix source type for selected trigger observations.
2. Fix user-facing copy.
3. Update `stable_profile.activity_snapshot`.
4. Align boundary visibility scope.
5. Split safety telemetry event naming.
6. Verify retrieval does not leak low-confidence debug observations into user-facing claims.

## Regression Checklist

- Run onboarding once, submit memory, export debug.
- Verify exactly one active item per onboarding claim.
- Run several check-ins with selected triggers and no text.
- Verify observations use selected-trigger source, not text source.
- Open `Your Personalization`.
- Verify only declared items and confidence-safe observations are visible.
- Download debug `.txt`.
- Verify `activity_snapshot` matches session count.
- Verify telemetry does not log `safety_flag_raised` for `flag: none`.
