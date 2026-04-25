# Port to `jar/` — Memory Layer Checklist

Purpose: a single page the mobile team can follow when moving the portal memory layer into `jar/` (React Native). The goal is **zero re-architecture** — every file under `src/lib/memory/**` that is not a portal-only adapter copies 1:1; only the adapters and the DI wiring are re-implemented for RN.

Authoritative source: `docs/2026/MindJar_consolidated_documentation_system_19_04_2026_03-16.md` (SSOT).

---

## 0. Rules before touching code

1. **No changes to `jar/types/index.ts`** (Spec §0.3). Copy new types into `jar/types/memory.ts`.
2. **No DB migrations** on either side (Spec §0.2). Mobile persists on-device (SSOT F.5.2).
3. **Memory core stays platform-agnostic.** Do not import `next/*`, `@supabase/*`, `window`, `localStorage`, or `react-native` from anything under `src/lib/memory/**`, except portal-only adapters. The portal ESLint config enforces this — the same restriction must be mirrored in the mobile eslint config (see §5).

---

## 1. Copy 1:1 (no edits)

Drag these folders/files straight over. After copying, run `tsc --noEmit` inside `jar/` — the only expected failures are missing type imports that live in §2.

```
src/lib/memory/types.ts
src/lib/memory/jarTypes.ts          → replace with re-exports of jar/types
src/lib/memory/constants.ts

src/lib/memory/state/confidence.ts
src/lib/memory/state/decay.ts
src/lib/memory/state/decaySweep.ts
src/lib/memory/state/recalibration.ts
src/lib/memory/state/rollback.ts
src/lib/memory/state/signalRegistry.ts
src/lib/memory/state/transitions.ts
src/lib/memory/state/conflict.ts

src/lib/memory/sync/normalize.ts
src/lib/memory/sync/summary.ts
src/lib/memory/sync/observations.ts

src/lib/memory/async/enrich.ts
src/lib/memory/async/id.ts
src/lib/memory/async/itemUpsert.ts
src/lib/memory/async/pattern.ts
src/lib/memory/async/profile.ts
src/lib/memory/async/snapshot.ts

src/lib/memory/retrieval/relevance.ts
src/lib/memory/retrieval/retrieve.ts
src/lib/memory/retrieval/sourceReliability.ts

src/lib/memory/generation/smartSummary.ts
src/lib/memory/generation/prompts.ts
src/lib/memory/generation/safeTemplates.ts
src/lib/memory/generation/selfCheck.ts
src/lib/memory/generation/forbiddenLanguage.ts

src/lib/memory/safety/classifier.ts
src/lib/memory/safety/avoidedTopics.ts

src/lib/memory/feedback/apply.ts
src/lib/memory/feedback/correction.ts

src/lib/memory/onboarding/build.ts
src/lib/memory/onboarding/types.ts

src/lib/memory/telemetry/events.ts
src/lib/memory/telemetry/metrics.ts

src/lib/memory/ui/copyConstraints.ts
src/lib/memory/ui/memoryView.ts
src/lib/memory/ui/resetProfile.ts

src/lib/memory/adapters/ai.ts
src/lib/memory/adapters/clock.ts
src/lib/memory/adapters/index.ts
src/lib/memory/adapters/storage.ts
src/lib/memory/adapters/subscription.ts
src/lib/memory/adapters/telemetry.ts

src/lib/memory/hooks/useMemoryContext.tsx
src/lib/memory/hooks/useAsyncEnrichment.ts
src/lib/memory/hooks/useDailySnapshot.ts
src/lib/memory/hooks/useMemoryCorrection.ts
src/lib/memory/hooks/useMemoryFeedback.ts
src/lib/memory/hooks/useMemoryItems.ts
src/lib/memory/hooks/useOnboardingSubmit.ts
src/lib/memory/hooks/usePracticeFeedback.ts
src/lib/memory/hooks/useRecalibrationBanner.ts
src/lib/memory/hooks/useReflectionSubmit.ts
src/lib/memory/hooks/useSafetyClassifier.ts
src/lib/memory/hooks/useSessionSubmit.ts
src/lib/memory/hooks/useSmartSummary.ts
src/lib/memory/hooks/useStableProfile.ts

src/lib/memory/__tests__/**
src/lib/memory/**/__tests__/**
```

Drop `"use client"` directives: RN has no RSC split. A single `sed -i '' '/^"use client";$/d'` pass handles this.

---

## 2. Replace — type re-exports

`src/lib/memory/jarTypes.ts` in the portal mirrors the subset of `jar/types/index.ts` the memory layer uses. On port, replace its body with direct re-exports from the real file:

```ts
export type {
  CheckIn,
  Emotion,
  EventType,
  FinishedEvent,
  IEventType,
  Mood,
  Tag,
  TagCategory,
  TimeSlot,
  User,
} from "@/types";
```

No other changes required.

---

## 3. Re-implement — adapters

The mobile app provides its own adapters; the portal ones stay in the portal tree.

| Interface              | Portal impl                                           | Mobile impl (this task)                               |
|------------------------|-------------------------------------------------------|-------------------------------------------------------|
| `StorageAdapter`       | `adapters/portal/inMemoryStorage.ts` (+ localStorage) | On-device SQLite / MMKV (SSOT F.5.2). Append-only audit log. |
| `SubscriptionAdapter`  | `adapters/portal/portalSubscription.ts`               | Wrap `jar/hooks/useSubscriptions.ts` (RevenueCat).    |
| `AIAdapter`            | `adapters/portal/portalDevAI.ts`, `openAiAI.ts`       | Server-call to backend (no direct OpenAI SDK on device). |
| `TelemetryAdapter`     | `adapters/portal/portalTelemetry.ts`                  | Wrap existing `useAnalytics`.                         |
| `ClockAdapter`         | `adapters/portal/systemClock.ts`                      | `() => new Date()` — copy as-is.                      |

Assemble them in `jar/hooks/memory/MemoryProvider.tsx` — structurally identical to `src/lib/memory/hooks/useMemoryContext.tsx`.

---

## 4. Re-implement — UI shells

Portal-specific UI (`/dashboard/memory/page.tsx`, simulators under `_sim/`, `ui/PremiumToggle.tsx`) is not ported. Mobile uses its own screens. However:

- Keep `ui/copyConstraints.ts`, `ui/memoryView.ts`, and `ui/resetProfile.ts` — they are pure utilities that the mobile Memory screen should reuse.
- `ui/PremiumToggle.tsx` is portal-only (Spec §0.5). Mobile relies on RevenueCat.

---

## 5. ESLint

Mirror the portal rule (see `eslint.config.mjs`):

```
no-restricted-imports rule on src/lib/memory/**:
  patterns: next, next/*, @supabase/*, react-native, react-native/*
  paths:    window, localStorage
exclude: adapters/portal/**
```

In mobile the `react-native` block flips — instead restrict the core from importing `next/*` and keep the adapters as the only place that imports `react-native`. Implementation detail lives in the mobile eslint config (symmetric).

---

## 6. Tests

`vitest` tests under `src/lib/memory/__tests__` and `src/lib/memory/**/__tests__` use only pure adapters (`InMemoryStorageAdapter`) and the `portalDevAI` adapter. They run identically in jest / vitest on the mobile project once copied. Smoke test:

```
cd jar && pnpm vitest run src/lib/memory
```

Expected counts (portal, 2026-04-19): **33 files, 259 tests passing**.

---

## 7. DoD for the port

1. All files in §1 copy without modification (apart from `use client` removal).
2. `jar/` compiles with `tsc --noEmit`.
3. Mobile test suite passes with the new adapters plugged in.
4. The mobile Memory screen renders the four SSOT C.3.2 blocks using `projectMemoryScreen()`.
5. `no-restricted-imports` rule active in the mobile eslint config.
6. No direct `react-native` / `AsyncStorage` / `@react-native-*` imports anywhere inside `src/lib/memory/**`.

Once all six checkpoints are green the portal and mobile share a single memory brain.
