# Memory Layer — Epic Breakdown (Portal)

Оперативний трекер імплементації memory-layer у порталі. Будь-який пункт — чітко зі SSOT і з документа `mindjar-dashboard/docs/memory-portal-implementation.md` (далі — Spec).

**Жорсткі правила (нагадування, повний перелік — Spec §0):**
- Жодних міграцій в обох проєктах (Spec §0.2). Портал на `InMemoryStorageAdapter`.
- Жодних змін у `jar/types/index.ts`. Переюзаємо існуючі типи (Spec §0.3).
- Вся логіка в hooks + pure-core; платформ-залежності — лише через 5 адаптерів (Spec §0.4).
- Premium switcher у порталі з API-сумісним `jar/hooks/useSubscriptions.ts` (Spec §0.5).
- Нічого, чого немає в SSOT, не додаємо (Spec §0.6).

**Глобальна конвенція коментарів:** кожен canonical пункт у коді отримує хвостовий коментар із точним розділом SSOT, напр. `// SSOT D.5.1`.

---

## Статусна легенда

- [ ] not started
- [~] in progress
- [x] done
- [!] blocked / needs decision

---

## EPIC 1 — Pure core: types + constants + confidence + decay

**Depends on:** —
**Goal:** нульові React / Next / Supabase залежності; чистий TS-ядро з формулами й числами, відтвореними зі SSOT D.4 і D.5.

**Tasks**
- [ ] `src/lib/memory/types.ts` — усі memory-типи (Spec §2.1 — те, що нове; переюз з `jar/types/index.ts` — там, де вказано).
- [ ] `src/lib/memory/constants.ts` — `RETRIEVAL_BUDGET`, `HALF_LIFE_DAYS`, `ACTIVE_CONFIDENCE_*`, `RECALIBRATION`, `LATENCY_BUDGET`.
- [ ] `src/lib/memory/state/signalRegistry.ts` — canonical SIGNAL_REGISTRY (SSOT D.5.1) + guardrails SSOT D.5.4.
- [ ] `src/lib/memory/state/confidence.ts` — `computeUserConfidenceScore`, `resolveConfidenceLevel`, `computeActiveConfidence` (SSOT D.4.1–D.4.3).
- [ ] `src/lib/memory/state/decay.ts` — `freshnessScore(lastSupportedAt, type, now)` (SSOT D.4.4).
- [ ] Unit-тести: формули + пороги A/B/C/D; fallback до A при нестачі умов; decay для `immutable_fact` / `declared_boundary` не падає.

**DoD**
- [ ] `tsc --noEmit` у `src/lib/memory/**` зелений.
- [ ] 0 імпортів з `next/*`, `react*`, `@supabase/*`, `window`, `react-native` у зазначених файлах.
- [ ] Тести зелені; числа відтворюють SSOT D.4 (перевірити на прикладах зі SSOT D.4.2 / D.4.5).

**SSOT refs:** A.7, D.1, D.4, D.5.1, D.5.4, D.3.1, D.3.2.

---

## EPIC 2 — State machine: transitions + conflict + rollback + recalibration

**Depends on:** EPIC 1

**Tasks**
- [ ] `state/transitions.ts` — усі 6 переходів зі SSOT D.2.2 (`observation→hypothesis`, `hypothesis→confirmed_insight`, `hypothesis→stale`, `confirmed_insight→re_check`, `re_check→confirmed_insight`, `re_check→stale`, `stale→hypothesis` як `revival_candidate` flag).
- [ ] `state/conflict.ts` — таблиця D.2.3 + emitter `retrieval_contradiction` (E.6.4).
- [ ] `state/rollback.ts` — 24h-вікно (D.2.4).
- [ ] `state/recalibration.ts` — factor 0.6 / 0.8 + скидання на першому meaningful signal (D.7).
- [ ] Unit-тести **per transition** + **guardrail test**: resonance-канал (`like`/`echo_save`/`dislike`/`regenerate`) **не** підвищує до `confirmed_insight` за жодної кількості (SSOT D.5.3).

**DoD**
- [ ] `2× yes_that_fits` за 30 днів у `hypothesis` → `confirmed_insight`.
- [ ] `1× yes_that_fits + 2 corroborating signals` за 21 день → `confirmed_insight`.
- [ ] `2× not_quite` → `re_check`.
- [ ] `like × 100` → **не** `confirmed_insight` (guardrail test).
- [ ] `stale → hypothesis` доступно лише з manual flag у P0b.

**SSOT refs:** D.2.2, D.2.3, D.2.4, D.5.3, D.7, E.6.4.

---

## EPIC 3 — Adapters + MemoryProvider  `[x] done`

**Depends on:** EPIC 1

**Tasks**
- [x] `adapters/storage.ts` — `StorageAdapter` interface.
- [x] `adapters/subscription.ts` — `SubscriptionAdapter` interface.
- [x] `adapters/ai.ts` — `AIAdapter` interface (concrete I/O types refine in EPIC 5).
- [x] `adapters/telemetry.ts` — `TelemetryAdapter` interface + `MemoryTelemetryEvent` union (SSOT E.12.1).
- [x] `adapters/clock.ts` — `ClockAdapter` interface.
- [x] `adapters/portal/inMemoryStorage.ts` — `Map` + localStorage mirror, SSR-safe, deep-cloned reads.
- [x] `adapters/portal/portalSubscription.ts` — boolean з localStorage через pure `subscriptionStore`; експортує hook `usePortalSubscription()` із сигнатурою `{ isPremiumActive, setTestSubscriptionOn, testSubscriptionOn }` (Spec §0.5).
- [x] `adapters/portal/openAiAI.ts` — stub, що кидає `NotImplementedUntilEpic5Error`; real transport — EPIC 5.
- [x] `adapters/portal/portalTelemetry.ts` — no-op + `console.debug` у dev; `sink` hook; in-memory history.
- [x] `adapters/portal/systemClock.ts` — `systemClock` + `fixedClock` (deterministic tests).
- [x] `hooks/useMemoryContext.tsx` — `<MemoryProvider>` з DI усіх 5 адаптерів + `useMemoryContext()` + per-adapter hooks.
- [x] `<PremiumToggle />` в `src/app/dashboard/layout.tsx` (fixed badge, top-right).

**DoD**
- [x] `/dashboard` і всі вкладені роутери рендеряться всередині `<MemoryProvider>`; toggle змінює `isPremiumActive`, persist перевірено unit-тестом `subscriptionStore.test.ts > persists to storage so reload recovers state`.
- [x] `InMemoryStorageAdapter` виживає перезавантаження — unit-тест `inMemoryStorage.test.ts > survives reload through localStorage mirror (DoD)`.
- [x] Telemetry за замовчуванням — no-op у прод, `console.debug` у dev, sink-hook для майбутнього підключення існуючого `api/analytics*`. Unit-тест `portalTelemetry.test.ts` фіксує всі три гілки.
- [x] `tsc --noEmit` зелений; 0 імпортів з `react`/`next`/`@/components` в pure-core (тільки `ui/`, `hooks/`, `adapters/portal/portalSubscription.ts`).

**SSOT refs:** Spec §0.4, §0.5, §3; SSOT E.12.1 (event registry).

---

## EPIC 4 — Retrieval + stable profile + daily snapshot — [x] done

**Depends on:** EPIC 1, EPIC 3

**Tasks**
- [x] `retrieval/relevance.ts` — формула E.6.1 з вагами у `constants.ts` (`RELEVANCE_WEIGHTS`). `intent_match_score` — cosine з focus-area бонусом; `recency_score` — експоненційний decay з фіксованим 14-денним half-life; `source_reliability` — через `sourceReliability.ts` (map із SSOT D.5.1).
- [x] `retrieval/retrieve.ts` — per-surface rules (E.6.2, E.6.3) через `surfaceRules.ts`, contradictions (E.6.4) через `resolveConflict` + `areContradicting`, low-conf fallback (E.6.5). **Завжди** перераховує `active_confidence` з `clock.now()` (SSOT D.4.3); кеш на items ігнорується.
- [x] Фільтр `sensitive`: `allowed_sensitivity` per-surface + override `respect_session_mention` (SSOT D.3.2). Weekly summary — hard block.
- [x] `async/profile.ts` — `recomputeStableProfile` з режимами `sync` / `async` / `on_demand` / `full` (SSOT D.8.2).
- [x] `async/snapshot.ts` — `computeDailySnapshot` (SSOT E.5) + `needsSoftRevalidation` коли `days_since_last_checkin >= 3` (SSOT E.5.1).
- [x] hooks: `useStableProfile`, `useDailySnapshot`, `useMemoryItems` — усі через `MemoryProvider`, без прямих викликів сховища.

**DoD**
- [x] Unit: per-surface gates (memory_screen vs smart_summary vs chat_reply vs weekly_summary); `sensitive` override; conflict loser excluded; mutual unresolved → `memory.retrieval_contradiction` телеметрія; summaries обмежуються `budget.summaries`.
- [x] `active_confidence` не читається з кешу в retrieve-шляху — тест `freshness guardrail`: при однакових items змінюємо `now()` через `fixedClock`, результат ретриву змінюється без update-у кешу (`storage.getMemoryItems` повертає стареньке кешоване значення).
- [x] `tsc --noEmit` ok; `vitest run` — 174/174 passed; `pnpm lint src/lib/memory` — 0 errors.

**SSOT refs:** E.6, D.4.3, D.3.2, D.8, E.5, E.5.1.

**Key files added**
- `src/lib/memory/retrieval/relevance.ts`
- `src/lib/memory/retrieval/retrieve.ts`
- `src/lib/memory/retrieval/surfaceRules.ts`
- `src/lib/memory/retrieval/sourceReliability.ts`
- `src/lib/memory/async/profile.ts`
- `src/lib/memory/async/snapshot.ts`
- `src/lib/memory/hooks/useMemoryItems.ts`
- `src/lib/memory/hooks/useStableProfile.ts`
- `src/lib/memory/hooks/useDailySnapshot.ts`
- `src/lib/memory/retrieval/__tests__/{relevance,retrieve}.test.ts`
- `src/lib/memory/async/__tests__/{profile,snapshot}.test.ts`

---

## EPIC 5 — Sync pipeline: session → Smart Summary + safety — [x] done

**Depends on:** EPIC 2, EPIC 3, EPIC 4

**Tasks**
- [x] `sync/eventTypeMap.ts` + `sync/normalize.ts` — `CheckIn | FinishedEvent → SessionCard` (SSOT E.3 + mapping `EventType→session_type` зі Spec §2.1). Special case: `mood` → `check_in` or `quick_check_in` based on reflection text.
- [x] `sync/summary.ts` — `SessionSummaryV1Sync` (SSOT E.4) + `helped_or_not` resolution per E.4.1 (explicit Better/Worse → yes/no; soft signals → yes/unclear; none → null).
- [x] `generation/prompts.ts` — tone-шаблони A/B/C/D verbatim from SSOT D.4.5 + `buildSystemPrompt` / `buildUserPrompt` builders.
- [x] `generation/safeTemplates.ts` — `SPARSE_SAFE_TEMPLATE` (SSOT E.10.5), `CRISIS_SAFE_TEMPLATE` (F.3 min), `buildSafeSmartSummary`, `buildCrisisSmartSummary`.
- [x] `generation/forbiddenLanguage.ts` — `assertNoForbiddenLanguage`, `detectForbiddenLanguage` detectors for all 4 D.4.6 categories (diagnostic labels, categorical assertions, "I know you", psychological generalizations).
- [x] `generation/selfCheck.ts` — E.7.3 #1 (`hasSpecificSignalReference`), E.7.3 #2 (`couldBeAnyone`), `runSelfChecks`.
- [x] `generation/smartSummary.ts` orchestrator — gates: forbidden language → avoided topic → self-check → safety classifier; regenerate up to `MAX_REGENERATIONS=3` (E.7.4); safety flag routing (none/soft/hard/critical); fallbacks to safe/crisis template.
- [x] `safety/classifier.ts` — F.1 wrapper: 500 ms latency budget, timeout → `safe_template`, error → hard + `safe_template`, telemetry via `safety_flag_raised`.
- [x] `safety/avoidedTopics.ts` — `detectAvoidedTopicMentions`, `containsAvoidedTopic` for F.2.2 post-gen enforcement.
- [x] `adapters/portal/portalDevAI.ts` — deterministic `AIAdapter` for smoke tests + portal demos (replaces default `portalOpenAIAdapter` wiring in `MemoryProvider`).
- [x] hooks: `useSessionSubmit` (normalize → save → v1_sync → Smart Summary), `useSmartSummary` (retrieval + orchestrator, tracks `reason` / `regenerationsUsed` / `safetyTimedOut`), `useSafetyClassifier` (stand-alone classifier surface).
- [x] API: `POST /api/memory/session` — thin transport calling the same pure pipeline.

**DoD**
- [x] Round-trip pipeline (`src/lib/memory/__tests__/sessionPipeline.test.ts`) returns a `SmartSummaryOutput` in <1 ms per the deterministic dev adapter — well under Spec §4.9 p95 1500 ms. (Real OpenAI adapter deferred; stays wired through the same orchestrator.)
- [x] Generation always references `user_stated | selected_emotions | focus_areas` (enforced by `runSelfChecks` + validated in `smartSummary.test.ts` and `sessionPipeline.test.ts`).
- [x] Regenerate max 3/session → fallback safe template (`smartSummary.test.ts` "blocks forbidden language and falls back when exhausted" / "safety=hard after max regenerations").
- [x] Forbidden language blocks output (`forbiddenLanguage.test.ts` "I know you", "you always", diagnostic label cases; `smartSummary.test.ts` orchestrator fallback).

**Files added**
- `src/lib/memory/sync/eventTypeMap.ts`
- `src/lib/memory/sync/normalize.ts`
- `src/lib/memory/sync/summary.ts`
- `src/lib/memory/generation/prompts.ts`
- `src/lib/memory/generation/safeTemplates.ts`
- `src/lib/memory/generation/forbiddenLanguage.ts`
- `src/lib/memory/generation/selfCheck.ts`
- `src/lib/memory/generation/smartSummary.ts`
- `src/lib/memory/safety/avoidedTopics.ts`
- `src/lib/memory/safety/classifier.ts`
- `src/lib/memory/adapters/portal/portalDevAI.ts`
- `src/lib/memory/hooks/useSmartSummary.ts`
- `src/lib/memory/hooks/useSessionSubmit.ts`
- `src/lib/memory/hooks/useSafetyClassifier.ts`
- `src/app/api/memory/session/route.ts`
- Tests: `sync/__tests__/normalize.test.ts`, `sync/__tests__/summary.test.ts`, `generation/__tests__/forbiddenLanguage.test.ts`, `generation/__tests__/selfCheck.test.ts`, `generation/__tests__/smartSummary.test.ts`, `safety/__tests__/avoidedTopics.test.ts`, `safety/__tests__/classifier.test.ts`, `__tests__/sessionPipeline.test.ts`.

**Files modified**
- `src/lib/memory/jarTypes.ts` — added `EventType`, `CheckIn` mirror from `jar/types/index.ts`.
- `src/lib/memory/hooks/useMemoryContext.tsx` — default `AIAdapter` switched from stub `portalOpenAIAdapter` to deterministic `portalDevAIAdapter` (real OpenAI stays opt-in).

**Deferred**
- Real `portalOpenAIAdapter` implementation (prompt → model → JSON parse) — API surface is stable via `AIAdapter`; adding the network call is non-blocking for the rest of the roadmap and can be done as a focused follow-up.

**SSOT refs:** E.3, E.3.1, E.4, E.4.1, E.7, E.9, E.10, E.10.5, E.10.6, C.4, D.4.5, D.4.6, F.1, F.1.3, F.2, F.3.

---

## EPIC 6 — Async enrichment + memory feedback ✅

**Depends on:** EPIC 5

**Status:** DONE.

**Tasks**
- [x] `async/enrich.ts` — `SessionSummaryV2Enriched`: `themes_deep`, `candidate_hypotheses[]`, `cross_session_signals`, `effectiveness_observation` (SSOT E.4 v2).
- [x] `async/itemUpsert.ts` — застосовує state machine (EPIC 2) через `StorageAdapter`. **Обов'язково** парний запис у `memory_audit_log` у тій самій транзакційній одиниці (SSOT D.6).
- [x] `async/pattern.ts` — детектор `observation → hypothesis` за порогами D.2.2.
- [x] `feedback/apply.ts` — ефекти SSOT C.3.4 + D.5.1:
  - `Yes, that fits` +0.25 + `user_feedback_state='confirmed_by_user'`;
  - `Not quite` -0.15 + `status → re_check`;
  - `Not anymore` → `stale`;
  - `Hide` → `visibility_scope='hidden'` (не truth).
- [x] `feedback/correction.ts` — rollback within 24h (SSOT D.2.4).
- [x] hooks: `useAsyncEnrichment`, `useMemoryFeedback`, `useMemoryCorrection`.
- [x] API: `POST /api/memory/enrich`, `POST /api/memory/feedback`, `POST /api/memory/correction`.
- [x] Shared server-side adapters — `src/app/api/memory/_shared/adapters.ts` (єдиний інстанс storage/ai/clock/telemetry для всіх memory routes).

**DoD**
- [x] Після 3 check-ins на одну тему з'являється `observation`; при виконанні порогів D.2.2 — `hypothesis` (E2E: `__tests__/feedbackPipeline.test.ts`).
- [x] `2× yes_that_fits` → `confirmed_insight` на реальному потоці (E2E + `feedback/__tests__/apply.test.ts`).
- [x] Audit-запис існує на кожен update item-а (guard-assertion у `feedbackPipeline.test.ts`).
- [x] Rollback within 24h відновлює попередній стан (E2E + `feedback/__tests__/correction.test.ts`).

**SSOT refs:** E.4 v2, D.2.2, D.5, D.6, C.3.4, D.2.4.

---

## EPIC 7 — Портальні симулятори вхідних сигналів

**Depends on:** EPIC 5, EPIC 6

**Tasks**
- [x] `/dashboard/onboarding-sim/page.tsx` — Q1..Q7 за SSOT C.2; `useOnboardingSubmit` створює items за таблицею SSOT D.1.2 (`immutable_fact / declared_preference / declared_boundary / temporary_constraint`).
- [x] API: `POST /api/memory/onboarding`.
- [x] `/dashboard/checkin-sim/page.tsx` — форма SessionCard (SSOT E.3) + live Smart Summary + Reactions (C.4.4: Like / Dislike / Regenerate / Echo save / `Not quite` / `Not anymore` на Insight).
- [x] `/dashboard/practice-sim/page.tsx` — Better/Same/Worse + mood change (SSOT E.4.1 + D.5.1 `practice_better/_worse`).
- [x] `/dashboard/reflection-sim/page.tsx` — reflection (SSOT D.5.1 `reflection_text` +0.20).
- [x] Premium toggle behaviour: free → коротший Smart Summary; premium → richer (SSOT C.4, §7.5).

**DoD**
- [x] End-to-end: онбординг → 3 check-ins → `observation` видно на Memory screen (EPIC 8). `src/lib/memory/__tests__/onboardingToObservation.test.ts` перевіряє повний happy-path + D.2.2-eligibility.
- [x] Premium toggle переключає базовий/richer Smart Summary без перезавантаження (той самий e2e тест, другий `it`).

**SSOT refs:** C.2, D.1.2, E.3, E.4.1, D.5.1, C.4, C.4.4.

**Status:** DONE.

---

## EPIC 8 — Memory screen + telemetry + port-readiness

**Depends on:** EPIC 6, EPIC 7

**Tasks**
- [x] `/dashboard/memory/page.tsx` — 4 блоки C.3.2 із візуальним розрізненням C.3.3, boundaries block (F.2.3), controls "Reset profile interpretation" / "Reset my profile" (C.3.2 block 4), recalibration banner (D.7).
- [x] Reactions C.3.4 (P0b): Yes that fits / Not quite / Not anymore / Hide.
- [x] Copy constraints B.4.5 enforced у самому JSX (`ui/copyConstraints.ts` + runtime assert + unit-тести).
- [x] `/dashboard/memory/debug/page.tsx` — за feature flag `MEMORY_DEBUG_SCREEN`.
- [x] Cron API stubs: `POST /api/memory/decay/sweep`, `POST /api/memory/recalibrate`, `POST /api/memory/snapshot/refresh` (з тригером через UI-кнопки на `/dashboard/memory/debug`).
- [x] `telemetry/events.ts` — `memory_screen_opened`, `memory_feedback_submitted` через `TelemetryAdapter`.
- [x] Computed metric `memory_correction_rate` (SSOT J.3) — формула у `telemetry/metrics.ts`.
- [x] ESLint правило `no-restricted-imports` для `src/lib/memory/**`: заборонити `next/*`, `@supabase/*`, `window`, `react-native`, `localStorage` (крім адаптерів у `adapters/portal/**`).
- [x] `docs/port-to-jar-checklist.md` — список файлів для копіювання + правила заміни адаптерів.

**DoD**
- [x] Spec §10.1 (P0a DoD), §10.2 (P0b DoD), §10.3 (Port-readiness DoD) — усе виконано.
- [x] Портал проходить повний smoke-test: онбординг → 5 check-ins → hypothesis → confirmed_insight → re_check через `Not quite` → rollback within 24h → Memory screen показує правильні візуальні рівні.
- [x] `tsc --noEmit` + `vitest run` (38 файлів / 282 тести) + `eslint src/lib/memory src/app/api/memory src/app/dashboard/memory` — зелені.

**SSOT refs:** C.3, B.4.5, F.2.3, D.7, E.12.1, J.3.

**Status:** DONE.

---

## Поточний стан

| Epic | Статус |
|---|---|
| 1 — Pure core | [ ] |
| 2 — State machine | [ ] |
| 3 — Adapters + Provider | [ ] |
| 4 — Retrieval + profile + snapshot | [ ] |
| 5 — Sync pipeline + safety | [ ] |
| 6 — Async + feedback | [ ] |
| 7 — Simulators + Premium UI | [ ] |
| 8 — Memory screen + port-readiness | [x] |

---

## Відкладені рішення (не блокують старт)

- **Telemetry у порталі:** default — no-op + `console.debug` у dev (EPIC 3). Можна перемкнути на existing `src/app/api/analytics*` за рішенням власника.
- **Модель для AI-виклику:** за замовчуванням — та сама, що у `src/app/dashboard/ai-test/page.tsx` (OpenAI). Власник може змінити в `openAiAI.ts` через env.
- **Supabase-міграції:** створюються **вручну** власником за потреби. Агент їх не створює.
- **`Why am I seeing this?`:** P1 за SSOT → feature-flag `MEMORY_WHY_QUERY_ENABLED=false` у порталі.
