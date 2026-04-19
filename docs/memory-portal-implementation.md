# Memory Layer — Portal Implementation Spec

Технічний план реалізації memory-layer у **порталі** (`mindjar-dashboard/`, Next.js 16 + Supabase) як **smoke-test-середовища** для canonical memory-логіки з подальшим портом у **мобільну апку** (`jar/`, React Native, production).

**Джерело істини (SSOT):** `docs/2026/MindJar_consolidated_documentation_system_19_04_2026_03-16.md`.
Цей документ нічого не додає до SSOT; він лише мапить розділи SSOT на конкретні hooks / адаптери / таблиці / сторінки порталу. Кожна CANON-теза має посилання на розділ SSOT.

---

## 0. Жорсткі правила реалізації (project-level)

Ці правила мають пріоритет над будь-якими архітектурними смаками й не можуть бути порушені без явного рішення власника проєкту.

### 0.1. Dual-target architecture

- **Target A — portal** (`mindjar-dashboard/`): smoke-test, web, Supabase-backed.
- **Target B — mobile app** (`jar/`): React Native, production.
- Мета портальної реалізації — **перевірити canonical memory-логіку з SSOT без анімацій / складних transitions**, а потім **перенести** ядро у `jar/` з мінімальним переписуванням.

### 0.2. Міграції БД

- **Заборонено** створювати чи накатувати будь-які міграції в **обох** проєктах — і в `jar/`, і в `mindjar-dashboard/`.
- Агент **не створює** файлів у `mindjar-dashboard/supabase/migrations/` у межах memory-layer задачі.
- Усі SQL-схеми в цьому документі (§5) — **довідкові**. Вони описують canonical shape з SSOT (D.3, D.6, D.8, E.3, E.4, E.5). Власник проєкту сам вирішує, коли і як додати відповідні таблиці в Supabase руками.
- До моменту, поки таблиці не створено вручну, портал може працювати через **in-memory / `localStorage` StorageAdapter** (див. §3.1), щоб не блокувати smoke-тести логіки. При появі реальних таблиць — просто підмінюється реалізація `StorageAdapter`, жодних змін у core / hooks / API-контракті.

### 0.3. Типи

- `jar/types/index.ts` — **read-only source of truth для спільних типів**. Усі memory-hooks **повинні** переюзати звідти те, що вже існує, замість дублювання.
- Мапинг (деталі в розділі 2.1):

  | Концепт SSOT | Тип у `jar/types/index.ts` | Примітка |
  |---|---|---|
  | `user_id` | `User.id` | SSOT A-level |
  | `session_card.entry_mood / exit_mood` | `Mood` (`awful | bad | ok | good | great`) | SSOT E.3 → `Mood` |
  | `selected_emotions` | `Emotion[]` (label/tKey) | SSOT E.3 |
  | `selected_triggers` | `Tag[]` + `TagCategory` | SSOT E.3 |
  | `session_type` | mapping до `EventType` + service kinds `check_in`, `quick_check_in`, `self_discovery`, `personal_practice` | SSOT E.3.1 |
  | `CheckIn` як вхідна форма | `CheckIn` (`jar/types`) | вже є: `mood, emotion, actions, reflection` |
  | Source event references | `FinishedEvent.id`, `IEventType` | SSOT D.3 `sources[].source_event_id` |
  | `TimeSlot` | `TimeSlot` | SSOT context for retrieval |

- Нові memory-типи (D.3 / D.6 / D.8 / E.3 v1_sync / E.4 v2_enriched / E.5) — **нове**. Розміщуються у порталі в `mindjar-dashboard/src/lib/memory/types.ts`. Усі назви, enum-значення, mandatory-поля — **прямо зі SSOT**. При порті в `jar/` ці типи копіюються у `jar/types/memory.ts` (власник додає вручну) і, де потрібно, підключаються до існуючих типів.

### 0.4. Encapsulation rule — hooks-first

- Вся memory-логіка повинна бути інкапсульована у **React hooks + pure-TS core**.
- Ніякої залежності від Next.js / Web API / DOM / React Native APIs всередині core.
- Дозволені платформенні залежності — **тільки** через adapter-інтерфейси (див. розділ 3):
  - `StorageAdapter`
  - `SubscriptionAdapter`
  - `AIAdapter`
  - `TelemetryAdapter`
  - `ClockAdapter`
- Порт на RN = підміна адаптерів; hooks і core лишаються без змін.

### 0.5. Premium switcher у порталі

SSOT використовує premium differentiation у кількох місцях (напр. C.4 post-onboarding Smart Summary, H — monetization). У мобільній апці premium-статус постачається `jar/hooks/useSubscriptions.ts` через RevenueCat.

У порталі:
- Реалізуємо `usePortalSubscription()` — простий boolean-toggle (`isPremiumActive`) з persist у localStorage.
- API hook-а **сигнатурно ідентичний** `jar/hooks/useSubscriptions.ts`:
  ```
  { isPremiumActive: boolean,
    setTestSubscriptionOn: (v?: boolean) => void,
    testSubscriptionOn: boolean }
  ```
- UI у shell порталу — toggle `Premium ON/OFF`, показувати статус у header.
- Решта memory-hooks споживає саме цей hook (через `SubscriptionAdapter`), тому при порті на RN — без змін логіки, лише заміна джерела даних на `jar/hooks/useSubscriptions.ts`.

### 0.6. Поводитися тільки за SSOT

- Нічого не вигадувати зверх SSOT. Якщо SSOT мовчить — **не імплементуємо**, додаємо `// TODO: requires SSOT decision` і фіксуємо в окремій задачі.
- Кожен CANON-пункт у коді має коментар зі посиланням на розділ SSOT, напр. `// SSOT D.5.1`.

---

## 1. Scope

### 1.1. У scope для порталу (P0a → P0b в термінах SSOT)

- Memory state model повністю: SSOT D.1 – D.8 (типи, state machine, schema, confidence, decay, audit, recalibration, stable_profile).
- Runtime split sync / async: SSOT E.1 – E.2.
- Session card + session summary v1_sync / v2_enriched: SSOT E.3, E.4.
- Daily snapshot: SSOT E.5.
- Retrieval by intent: SSOT E.6 для Smart Summary, Chat, Memory screen, Plan-context.
- Smart Summary generation + safety pass (minimum): SSOT E.7 + F.1.
- Memory screen UI `Your Personalization`: SSOT C.3.
- Check-in / Reflection / Practice simulators → живлять сигнали за SSOT D.5.1.
- Memory feedback loop: SSOT D.5.2, C.3.4.
- Recalibration after pause: SSOT D.7.
- Premium switcher із тим самим API, що `useSubscriptions` (0.5).
- Telemetry memory-family: SSOT E.12.1.

### 1.2. Поза scope порталу

- Rings / Echoes / Weekly UX (потрібні лише data-hooks у місцях, що їх читає memory).
- Paywall / monetization (SSOT H) — лише stub.
- Crisis flow UX (SSOT F.3) — тільки safe crisis template.
- On-device storage (SSOT F.5.2) — портал тестує через Supabase. Це явне відхилення **тільки для портала**; при порті в `jar/` `StorageAdapter` імплементується on-device.
- P1/P2 roadmap (SSOT A.3): `Why am I seeing this?`, topic-level hide, automatic `support_style` revalidation, окрема memory-tab і т.д.

---

## 2. Модулі і типи

### 2.1. Мапинг типів SSOT → `jar/types/index.ts`

- `Mood` (`jar/types/index.ts`) — використовуємо як є для `entry_mood`, `exit_mood`, `last_mood`, `daily_snapshot.last_mood`.
- `Emotion[]` — використовуємо як є для `selected_emotions`. `statement_internal` у memory-item зберігається в canonical EN (SSOT A.7) — беремо `Emotion.label` (або tKey-derived EN-label), а не локалізацію.
- `Tag[]` + `TagCategory` — для `selected_triggers`. Те саме правило canonical EN.
- `CheckIn` — form-input з UI check-in simulator'а; мапиться у `session_card` (SSOT E.3) при submit.
- `FinishedEvent` + `IEventType` — існуюча абстракція practice/reflection/journaling у мобільному. Портальний check-in / practice simulator видає той самий shape (для сумісності з портом). `FinishedEvent.id` → використовуємо як `source_event_id` у `memory_item.sources[]`.
- `EventType` → `session_type`: мапинг (чистий, односторонній, SSOT E.3.1):
  - `journaling` → `journal`
  - `meditation` → `meditation`
  - `reflection` → `reflection`
  - `breathing` → `breathing`
  - `mood` (check-in) → `check_in` або `quick_check_in` (залежно від наявності text)
  - `question` (self-discovery) → `self_discovery`
  - custom practice → `personal_practice`
  - `streak / todo / affirmations / review / summary / letter` → **не** породжують session_card у memory-scope (вони не в переліку SSOT E.3.1).
- `TimeSlot` — використовуємо для "Current time, day of week, activity context" у Smart Summary input (SSOT E.7.1).

Нові типи (не існують у `jar/types/index.ts`, створюємо в `mindjar-dashboard/src/lib/memory/types.ts`, 1-в-1 за SSOT):

- `MemoryItemType` (SSOT D.1): `immutable_fact | declared_preference | declared_boundary | temporary_constraint | observation | hypothesis | confirmed_insight`.
- `MemoryItemStatus` (SSOT D.1.3): `active | re_check | stale | hidden | removed_by_user`.
- `MemoryItem` (SSOT D.3 — полный schema, усі обов'язкові поля з D.3.1).
- `MemoryAuditEvent` (SSOT D.6).
- `SessionCard` (SSOT E.3).
- `SessionSummaryV1Sync`, `SessionSummaryV2Enriched` (SSOT E.4).
- `DailySnapshot` (SSOT E.5).
- `StableProfile` (SSOT D.8.1).
- `ConfidenceLevel` (`A | B | C | D`).
- `SensitivityLevel`, `VisibilityScope`, `SignalKind`, `SourceType` (D.3).
- `SafetyFlag` (`none | soft | hard | critical`) (F.1).
- `RiskState` (`normal | sensitive_adjacent | elevated | critical`) (E.10.2).
- `Surface` (`smart_summary | chat_reply | weekly_summary | plan | memory_screen`) (E.10.3).

### 2.2. Структура `src/lib/memory/` (platform-agnostic core)

```
mindjar-dashboard/src/lib/memory/
  types.ts                 # всі memory-типи (SSOT D.1, D.3, D.6, E.3, E.4, E.5, D.8, F.1)
  constants.ts             # ваги, пороги, half-life — рівно зі SSOT

  state/
    signalRegistry.ts      # SSOT D.5.1 — ЄДИНА canonical таблиця ваг
    confidence.ts          # SSOT D.4 (user_confidence_score, active_confidence)
    decay.ts               # SSOT D.4.4 (freshness_score)
    transitions.ts         # SSOT D.2 (state machine)
    conflict.ts            # SSOT D.2.3 + E.6.4
    rollback.ts            # SSOT D.2.4
    recalibration.ts       # SSOT D.7

  sync/
    normalize.ts           # CheckIn|FinishedEvent → SessionCard (SSOT E.3)
    summary.ts             # SessionSummaryV1Sync (SSOT E.4)

  async/
    enrich.ts              # SessionSummaryV2Enriched (SSOT E.4 v2, D.2.2)
    itemUpsert.ts          # застосування D.2 до DB/storage через adapter
    profile.ts             # stable_profile recompute (SSOT D.8.2)
    snapshot.ts            # DailySnapshot (SSOT E.5)

  retrieval/
    relevance.ts           # SSOT E.6.1
    retrieve.ts            # per-surface budgets + rules (E.6.2, E.6.3)

  generation/
    prompts.ts             # tone templates per confidence level (SSOT D.4.5)
    safeTemplates.ts       # SSOT E.10.5
    smartSummary.ts        # SSOT E.7
    assertNoForbiddenLanguage.ts  # SSOT D.4.6

  safety/
    classifier.ts          # SSOT F.1 minimum
    avoidedTopics.ts       # SSOT F.2

  feedback/
    apply.ts               # SSOT C.3.4, D.5, D.6

  telemetry/
    events.ts              # SSOT E.12.1 memory family
```

Жоден файл усередині `src/lib/memory/` не повинен імпортувати `next/*`, `react`, `react-native` чи `@supabase/*` напряму. Залежності — **тільки** через адаптери (розділ 3).

### 2.3. Структура hooks (`src/lib/memory/hooks/`, platform-agnostic)

```
mindjar-dashboard/src/lib/memory/hooks/
  useMemoryContext.tsx     # Provider, в який інжектяться 5 адаптерів (§3)
  useSessionSubmit.ts      # POST session → Smart Summary (sync path, SSOT E.1.1)
  useAsyncEnrichment.ts    # trigger enrichment after submit (SSOT E.1.2)
  useMemoryItems.ts        # read+filter memory_items по userId (для Memory screen, C.3)
  useStableProfile.ts      # read stable_profile snapshot (SSOT D.8)
  useDailySnapshot.ts      # read/refresh (SSOT E.5)
  useMemoryFeedback.ts     # apply Yes/Not quite/Not anymore/Hide (SSOT C.3.4, D.5, D.6)
  useConfidenceLevel.ts    # обчислення A/B/C/D (SSOT D.4.2)
  useRecalibration.ts      # SSOT D.7 checker + banner flag
  useSmartSummary.ts       # синхронне отримання останнього Smart Summary
  useSafetyClassifier.ts   # прив'язка до SafetyAdapter (SSOT F.1)
  useOnboardingSubmit.ts   # Q1..Q7 → memory items (SSOT C.2, D.1.2)
```

**Rule:** усі hooks чисті від Web-only API. React / `use*` — дозволено (RN теж React). LocalStorage / fetch / supabase-js — **тільки** через адаптери.

При порті на RN → hooks копіюються as-is у `jar/hooks/memory/`; адаптери пишуться заново під AsyncStorage/SQLite/RevenueCat/OpenAI-client мобільного.

---

## 3. Адаптери (platform boundary)

Усі адаптери — TypeScript-інтерфейси в `src/lib/memory/adapters/`, що реалізуються окремо для порталу і мобільного.

### 3.1. `StorageAdapter` — SSOT D.3, D.6, D.8, E.3–E.5

Платформенні реалізації для порталу (міграції заборонені §0.2, тому додаємо дві реалізації одного інтерфейсу):

- **`InMemoryStorageAdapter`** (default для smoke-тестів) — весь стан у Map-ах + persist у `localStorage` через окремий plain wrapper. Не потребує БД. Придатний для перевірки всієї canonical логіки memory state machine / confidence / decay / retrieval без Supabase.
- **`SupabaseStorageAdapter`** — активується, коли власник вручну створив таблиці (§5) у Supabase. Core / hooks / API-контракт не змінюються.

Вибір реалізації — через env-флаг (наприклад `NEXT_PUBLIC_MEMORY_STORAGE=memory|supabase`). За замовчуванням — `memory`.

```ts
interface StorageAdapter {
  // memory_items (SSOT D.3)
  getMemoryItems(userId: string, filter?: MemoryItemFilter): Promise<MemoryItem[]>;
  upsertMemoryItem(item: MemoryItem, audit: MemoryAuditEvent): Promise<MemoryItem>;
  appendAudit(audit: MemoryAuditEvent): Promise<void>;

  // sessions (SSOT E.3)
  saveSessionCard(card: SessionCard): Promise<void>;

  // session_summaries (SSOT E.4)
  saveSessionSummary(summary: SessionSummaryV1Sync | SessionSummaryV2Enriched): Promise<void>;
  getRecentSessionSummaries(userId: string, limit: number): Promise<SessionSummaryV1Sync[]>;

  // stable_profile (SSOT D.8)
  getStableProfile(userId: string): Promise<StableProfile | null>;
  upsertStableProfile(profile: StableProfile): Promise<void>;

  // daily_snapshot (SSOT E.5)
  getDailySnapshot(userId: string, date: string): Promise<DailySnapshot | null>;
  upsertDailySnapshot(snapshot: DailySnapshot): Promise<void>;

  // safety
  appendSafetyEvent(evt: SafetyEvent): Promise<void>;
}
```

- Портальна реалізація `memory`: `src/lib/memory/adapters/portal/inMemoryStorage.ts`.
- Портальна реалізація `supabase`: `src/lib/memory/adapters/portal/supabaseStorage.ts` (вмикається лише якщо таблиці §5 створені вручну).
- Мобільна реалізація (майбутня): on-device SQLite / MMKV, згідно SSOT F.5.2.

### 3.2. `SubscriptionAdapter` — SSOT-узгоджено з §0.5

```ts
interface SubscriptionAdapter {
  isPremiumActive: boolean;
  setTestSubscriptionOn?: (v?: boolean) => void;
  testSubscriptionOn?: boolean;
}
```

- Портал: `usePortalSubscription()` → localStorage boolean + UI toggle.
- Мобільний: `jar/hooks/useSubscriptions.ts` (існуючий).
- Усі memory-логіки, які мають premium-розгалуження (напр. post-onboarding Smart Summary richer layer, SSOT C.4), читають тільки `isPremiumActive`.

### 3.3. `AIAdapter`

```ts
interface AIAdapter {
  generateSmartSummary(input: SmartSummaryInput): Promise<SmartSummaryOutput>;
  generateEnrichment(input: EnrichmentInput): Promise<SessionSummaryV2Enriched>;
  runSafetyClassifier(input: SafetyInput): Promise<SafetyResult>;
}
```

- Портал: обгортка над існуючим `src/lib/openai.ts` / Anthropic SDK, викликається з Next.js API routes (щоб API-ключ не зтік).
- Мобільний: той самий інтерфейс, інший transport (probably server-call до бекенду, не direct SDK).

### 3.4. `TelemetryAdapter` — SSOT E.12.1

```ts
interface TelemetryAdapter {
  capture(event: MemoryTelemetryEvent, payload: Record<string, unknown>): void;
}
```

- Портал: обгортка над існуючим analytics pipeline (`src/app/api/analytics*`).
- Мобільний: обгортка над `useAnalytics` (існуючий).

### 3.5. `ClockAdapter`

```ts
interface ClockAdapter { now(): Date; }
```

Потрібен для детермінованого тестування decay/recalibration. Портал — `() => new Date()`; тести — mock.

### 3.6. Provider

`useMemoryContext.tsx` експортує `<MemoryProvider>` який приймає усі 5 адаптерів. Усі hooks з §2.3 читають їх через `useContext`. При порті на RN — той самий Provider, інші adapter-реалізації.

---

## 4. Canonical constants і формули (SSOT D.4, D.5)

Усе в `src/lib/memory/constants.ts`, immutable, точно зі SSOT.

### 4.1. Signal registry (SSOT D.5.1 — ЄДИНА canonical таблиця ваг)

```ts
export const SIGNAL_REGISTRY = {
  onboarding_direct_answer: { base_confidence: 0.85, signal_kind: "declaration",
    can_upgrade: ["immutable_fact", "declared_preference", "declared_boundary"] },
  check_in_text:             { evidence_delta: +0.15, signal_kind: "corroboration" },
  reflection_text:           { evidence_delta: +0.20 },
  journal_entry:             { evidence_delta: +0.10 },
  trigger_tags:              { evidence_delta: +0.10 },
  self_discovery_completion: { truth_delta: 0.00, engagement_delta: +0.60 },
  self_discovery_interp:     { base_confidence: 0.25 },
  practice_better:           { corroboration_delta: +0.20 },
  practice_worse:            { contradiction_delta: -0.20 },
  yes_that_fits:             { delta: +0.25, signal_kind: "truth_confirmation" },
  not_quite:                 { delta: -0.15, transition: "status->re_check" },
  not_anymore:               { transition: "status->stale" },
  hide:                      { effect: "visibility_only" },
  like:                      { resonance_delta: +0.05 },
  dislike:                   { resonance_delta: -0.05 },
  regenerate:                { resonance_delta: -0.05 },
  echo_save:                 { resonance_delta: +0.05 },
} as const;
```

Обмеження слабких сигналів (SSOT D.5.4):
- один `Like` ніколи не створює memory_item;
- 3 `Echo save` на подібні теми → можуть створити лише `observation` про style resonance (не truth);
- `Read/skip summary` — не сигнал.

### 4.2. Confidence levels (SSOT D.4.1 – D.4.2)

- Ваги score-формули, пороги рівнів A/B/C/D, fallback до A — точно зі SSOT.

### 4.3. Active confidence thresholds (SSOT D.4.3)

```ts
export const ACTIVE_CONFIDENCE_RETRIEVAL_MIN = 0.3;
export const ACTIVE_CONFIDENCE_INSIGHT_MIN   = 0.5;
export const ACTIVE_CONFIDENCE_NO_SOFTENER   = 0.7;
```

**active_confidence перераховується при КОЖНОМУ retrieval** (SSOT D.4.3), кеш у DB — допоміжний.

### 4.4. Decay half-life map (SSOT D.4.4)

```ts
export const HALF_LIFE_DAYS: Record<MemoryItemType, number | null> = {
  immutable_fact:       null,     // no decay
  declared_preference:  120,
  declared_boundary:    null,     // no automatic decay (SSOT D.1)
  temporary_constraint: 30,
  observation:          14,
  hypothesis:           10,
  confirmed_insight:    60,
};
```

### 4.5. State-machine thresholds (SSOT D.2.2)

- `observation → hypothesis`: 3 consistent observations у 14-денному вікні, average `signal_strength ≥ 0.4`.
- `hypothesis → confirmed_insight`: 2 explicit `Yes, that fits` за 30 днів АБО 1 explicit + 2 stronger corroborating signals за 21 день, у відповідному вікні — без contradictions.
- `hypothesis → stale`: жоден supporting signal > 30 днів АБО 2× `Not quite` АБО confidence < 0.25.
- `confirmed_insight → re_check`: `Not quite` АБО 3 contradicting stronger signals за 14 днів АБО post-pause sustained contradiction.
- `re_check → confirmed_insight`: 2× confirm за 14 днів.
- `re_check → stale`: 14 днів без resolution АБО `Not anymore`.
- `stale → hypothesis` (revival): **P0b manual flag `revival_candidate`** (не автомат); automatic — тільки P1.

**Заборонено:** підвищення `hypothesis → confirmed_insight` через resonance-канал (SSOT D.5.3). Like / Echo save — **не** truth confirmation.

### 4.6. Recalibration factors (SSOT D.7)

```ts
// if days_since_last_checkin >= 7
export const RECALIBRATION = {
  observation: 0.6,
  hypothesis: 0.6,
  confirmed_insight: 0.8,
  immutable_fact: 1.0,
  declared_preference: 1.0,
  declared_boundary: 1.0,
  temporary_constraint: 1.0,
};
```

Factor діє до **першого** completed check-in з текстом АБО explicit confirmation у Memory screen.

### 4.7. Retrieval budgets per surface (SSOT E.6.2, позначено як `[TUNE AFTER P0A]`)

```ts
export const RETRIEVAL_BUDGET = {
  smart_summary_post_checkin: { tokens: 2000, items: 8,  summaries: 3 },
  chat_reply:                 { tokens: 4000, items: 12, summaries: 5 },
  weekly_summary:             { tokens: 6000, items: 15, summaries: 7 },
  self_discovery_go_deeper:   { tokens: 2500, items: 5,  summaries: 1 },
  plan_context:               { tokens: 1000, items: 5,  summaries: 0 },
  memory_screen:              { tokens: 1500, items: 20, summaries: 0 }, // paginated
};
```

### 4.8. Universal relevance (SSOT E.6.1)

```ts
// relevance_score(item, intent) =
//   0.35 * active_confidence(item)
// + 0.25 * intent_match_score(item, intent)
// + 0.20 * recency_score(item)
// + 0.15 * source_reliability(item.source_type)
// + 0.05 * diversity_bonus(item, already_selected)
```

### 4.9. Latency budgets (SSOT E.11)

| Operation | Target p95 | Hard ceiling |
|---|---|---|
| Session card normalization | 100 ms | 300 ms |
| Sync session summary | 800 ms | 1500 ms |
| Smart Summary (incl. classifier) | 1500 ms | 3000 ms |
| Daily snapshot refresh (cached) | 50 ms | 200 ms |
| Memory screen load | 500 ms | 1500 ms |
| Plan generation | 300 ms | 1000 ms |
| Async enrichment (full) | 60 s | 5 min |
| Safety classifier | 500 ms p95 | timeout → safe template (F.1.3) |

---

## 5. Довідкова схема БД (НЕ накатується автоматично)

**Правило §0.2:** агент не створює міграцій ані в `jar/`, ані в `mindjar-dashboard/`. Цей розділ — **читацька довідка**: він фіксує canonical shape з SSOT (D.3, D.6, D.8, E.3, E.4, E.5), щоб власник проєкту міг згодом додати таблиці руками без зіставлення зі SSOT напряму.

До того моменту портал працює через `InMemoryStorageAdapter` (§3.1). Усе, що нижче, — **не файл міграції** і не буде створено агентом.

Поля та constraint-и — без відхилень від SSOT.

### 5.1. `memory_items` (SSOT D.3)

- `id uuid pk`
- `user_id uuid not null`
- `type text not null check (type in ('immutable_fact','declared_preference','declared_boundary','temporary_constraint','observation','hypothesis','confirmed_insight'))`
- `status text not null default 'active' check (status in ('active','re_check','stale','hidden','removed_by_user'))`
- `statement_user_facing text`
- `statement_internal text not null` — canonical EN (SSOT A.7)
- `content jsonb not null` — `{claim, domain, polarity, intensity}`
- `internal_evidence_summary text`
- `confidence numeric(4,3) not null`
- `freshness_score numeric(4,3) not null default 1.0`
- `active_confidence numeric(4,3) not null`
- `last_confidence_computed_at timestamptz not null default now()`
- `first_seen_at timestamptz not null`
- `last_supported_at timestamptz not null`
- `user_feedback_state text not null default 'none' check (... 'none','confirmed_by_user','rejected_by_user','marked_stale_by_user')`
- `sources jsonb not null default '[]'::jsonb` — `[{source_type, source_event_id, session_id, timestamp, weight, signal_kind}]`
- `source_event_ids text[] generated stored` (derived)
- `sensitivity_level text not null default 'personal' check (... 'public','personal','sensitive','avoided_adjacent')`
- `visibility_scope text not null default 'summary' check (... 'summary','memory_screen','plan_context','hidden')`
- `theme_tags text[] not null default '{}'`
- `related_focus_areas text[] not null default '{}'`
- `state_history jsonb not null default '[]'::jsonb`
- `supersedes_id uuid null references memory_items(id)`
- `version int not null default 1`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Mandatory-поля з SSOT D.3.1 — `NOT NULL` і у схемі, і у TS-типі.

Індекси: `(user_id, status, type)`, `(user_id, active_confidence desc)`, `(user_id) where status = 'active'`, GIN на `theme_tags`, `related_focus_areas`.

RLS: кожен user бачить тільки свої рядки; service_role — повний доступ.

### 5.2. `memory_audit_log` (SSOT D.6)

Колонки точно зі SSOT D.6. `action in ('confirm','soft_reject','mark_stale','hide','why_query','correction')`. `context_surface in ('memory_screen','smart_summary','reflection','chat_reply','plan','weekly_summary')`.

Правило: **жоден** update `memory_items` без пари запису в `memory_audit_log` у тій самій транзакції — enforced у `state/itemUpsert.ts` + trigger (опц.).

### 5.3. `sessions` (SSOT E.3)

Колонки відповідають `SessionCard` 1-в-1. `session_type` enum — повний перелік SSOT E.3.1:
`check_in | quick_check_in | journal | reflection | breathing | meditation | self_discovery | personal_practice`.

`entry_mood / exit_mood` — `Mood` з `jar/types/index.ts`.

### 5.4. `session_summaries` (SSOT E.4)

- `session_id uuid pk references sessions(id)`
- `summary_version text check (in 'v1_sync','v2_enriched')`
- `completed_at`, `enriched_at timestamptz null`
- `user_stated text[]`, `emotional_tone jsonb`, `themes_obvious text[]`, `themes_deep text[] null`
- `candidate_hypotheses jsonb not null default '[]'::jsonb`
- `cross_session_signals text[] null`
- `effectiveness_observation jsonb null`
- `helped_or_not text check (... 'yes','no','unclear') null` — SSOT E.4.1
- `flags_runtime text[]`
- `requires_async_enrichment bool not null default true`

### 5.5. `stable_profile_snapshots` (SSOT D.8)

- `user_id uuid pk`, `basics jsonb`, `declared jsonb`, `current_constraints jsonb`
- `what_tends_to_help jsonb`, `active_hypotheses jsonb`, `confirmed_insights jsonb`
- `confidence_level text check (in 'A','B','C','D')`, `user_confidence_score numeric(4,3)`
- `activity_snapshot jsonb`, `last_refreshed_at timestamptz not null default now()`

### 5.6. `daily_snapshots` (SSOT E.5)

Pk `(user_id, date)`. Решта — точно SSOT E.5.

### 5.7. `safety_events` (F.1)

- `id uuid pk`, `user_id uuid`, `session_id uuid null`, `surface text`
- `flag text check (... 'none','soft','hard','critical')`
- `reason text`, `suggested_action text`, `classifier_latency_ms int`
- `timestamp timestamptz default now()`, `output_hash text`

### 5.8. `avoided_topics` — немає окремої таблиці

Зберігаються як `memory_items` з `type='declared_boundary'` (SSOT F.2.1).

---

## 6. API порталу

Tonkий transport-шар. Вся логіка — у core/hooks (§2). API-роути просто читають body, викликають core з інжектованими порталиними адаптерами, повертають JSON.

### 6.1. Sync

| Method | Route | Використовує hook | SSOT |
|---|---|---|---|
| POST | `/api/memory/onboarding` | `useOnboardingSubmit` | C.2, D.1.2, D.5.1 |
| POST | `/api/memory/session` | `useSessionSubmit` (sync path) | E.1.1, E.2, E.7 |
| POST | `/api/memory/feedback` | `useMemoryFeedback` | C.3.4, D.5, D.6 |
| POST | `/api/memory/correction` | — (reset interpretation / profile) | D.2.3, C.3.2 block 4 |
| GET  | `/api/memory/screen?userId=` | `useMemoryItems` | C.3, E.6.3 |
| GET  | `/api/memory/stable-profile?userId=` | `useStableProfile` | D.8 |
| GET  | `/api/memory/daily-snapshot?userId=` | `useDailySnapshot` | E.5 |

### 6.2. Async / cron

| Method | Route | SSOT |
|---|---|---|
| POST | `/api/memory/enrich` | E.1.2 |
| POST | `/api/memory/snapshot/refresh` | E.5 |
| POST | `/api/memory/recalibrate` | D.7 |
| POST | `/api/memory/decay/sweep` | D.4 |

Recommended schedules (SSOT-aligned):
- snapshot refresh — щоденно; inline при першому session_open дня, якщо snapshot > 2 год (SSOT E.5).
- decay sweep — nightly.
- recalibrate — щогодини.

---

## 7. UI порталу

### 7.1. Shell + Premium switcher (§0.5)

Компонент у header'і dashboard: `<PremiumToggle />`
- читає/пише через `usePortalSubscription()`;
- lucide-іконка + лейбл `Premium ON` / `Premium OFF`;
- toast (sonner) на зміну стану;
- telemetry event `test_subscription_toggled` (paralel з мобільним).

### 7.2. Сторінки

```
mindjar-dashboard/src/app/dashboard/
  memory/
    page.tsx                   # Memory screen = "Your Personalization" (SSOT C.3)
    debug/page.tsx             # internal: raw items + state_history (hidden by feature flag)
  checkin-sim/
    page.tsx                   # check-in simulator (SSOT E.3 form)
  onboarding-sim/
    page.tsx                   # Q1..Q7 → memory items (SSOT C.2, D.1.2)
  practice-sim/
    page.tsx                   # practice completion + Better/Same/Worse + mood change
  reflection-sim/
    page.tsx                   # reflection session (optional, same SessionCard shape)
```

### 7.3. Memory screen (SSOT C.3)

User-facing label — **`Your Personalization`** (SSOT C.3.1). `memory_screen` — internal id в коді / `context_surface`.

Структура (SSOT C.3.2):
- Block 1 — **Basics**: `name`, `primary_motivation`, `focus_areas`, `support_style`, `Your boundaries` (avoided_topics).
- Block 2 — **What tends to help**: confirmed_insight + hypothesis з візуальним розрізненням.
- Block 3 — **Patterns I'm noticing**: short-term observation/hypothesis.
- Block 4 — **Controls**: `Reset profile interpretation`, `Reset my profile`.

Візуалізація (SSOT C.3.3):
- `confirmed_insight` — повна вага, без softener.
- `hypothesis` — 0.8 opacity + softener (`Possibly` / `It seems` / `I'm noticing`).
- `observation` — лейбл `Recent pattern` / `From this week`.

**Заборонено показувати:**
- items з `confidence < 0.4`;
- raw score / debug info (є лише на `/memory/debug` під feature-flag);
- діагностичні ярлики;
- повний event log.

Reaction controls (SSOT C.3.4, P0b): `Yes, that fits`, `Not quite`, `Not anymore`, `Hide`.
`Why am I seeing this?` — **P1**, за feature flag `MEMORY_WHY_QUERY_ENABLED`.

Copy-приклади — Block 2/3 (SSOT C.3.5), Boundaries — SSOT F.2.3.

### 7.4. Copy constraints (SSOT B.4.5)

Заборонено у user-facing UI:
- `I know you...`, `I learn who you are`, `What I know about you`.

Internal / debug / prompts — дозволено.

### 7.5. Premium behaviour у memory-UI

- Post-onboarding Smart Summary: free — короткий базовий summary; premium — richer layer (SSOT C.4 General). `isPremiumActive` читається з `SubscriptionAdapter`.
- Memory screen: **без** premium-обмежень (SSOT C.3 не вводить premium-tier).
- Weekly summary / Plan — поза scope порталу (лише data-hooks).

---

## 8. Telemetry (SSOT E.12.1)

Події memory-family:
- `memory_screen_opened`
- `memory_feedback_submitted` (payload: `memory_item_id`, `action`, `context_surface`)

Події summary-family (пов'язані):
- `smart_summary_viewed`, `smart_summary_reaction`, `echo_saved`.

Обчислюваний метрик:
- `memory_correction_rate` = `memory_audit_log.action in ('soft_reject','mark_stale','correction')` ÷ `items_viewed_on_memory_screen`.

Source of truth — `TelemetryAdapter`. У hook-ах — через Provider.

---

## 9. Safety / Privacy у порталі

- `sensitive` items **не надсилаються** AI як active context (SSOT D.3.2). Виняток — user сам згадав відповідну тему у поточній сесії → prompt-builder звіряє `current_session.themes ∩ item.theme_tags ≠ ∅`.
- `avoided_adjacent` — AI активно обходить, prompt містить явну інструкцію (SSOT F.2.2).
- Crisis indicator (SSOT F.3.1): AI-text не показується, safe supportive template + resources, session `crisis_session=true`; у цій і наступній сесії paywall/teaser заборонено (SSOT F.3.4); hypothesis generation вимкнено у цій сесії.
- Manual review queue (SSOT F.4): `safety_events.flag in ('hard','critical')` → admin view (service_role only).
- Review visibility (SSOT F.4.2.1): classifier reason + runtime diagnostics + реальний prompt/output trace, який був у runtime-шляху. Жодного повного локального стану.

---

## 10. Acceptance criteria (DoD для порталу)

Похідні від SSOT A.4.

### 10.1. DoD P0a (foundation)

1. У жодному з проєктів немає нових міграцій. Портал проходить усі сценарії з §10.1 через `InMemoryStorageAdapter` (§3.1). Якщо власник вручну додав таблиці §5 — `NEXT_PUBLIC_MEMORY_STORAGE=supabase` перемикає на `SupabaseStorageAdapter`, і всі сценарії проходять ідентично.
2. Premium switcher у shell порталу працює; hook-и memory отримують `isPremiumActive` через `SubscriptionAdapter`.
3. Онбординг simulator пише `immutable_fact / declared_preference / declared_boundary / temporary_constraint` точно за таблицею SSOT D.1.2.
4. Check-in simulator → `SessionCard` + `SessionSummaryV1Sync` у sync-path у межах latency budget (§4.9).
5. Smart Summary генерується з:
   - reference to specific signal (SSOT E.7.3 rule #1),
   - tone згідно resolved confidence level (SSOT D.4.5),
   - проходить safety classifier (SSOT F.1),
   - не порушує SSOT D.4.6 forbidden language.
6. Перші 20–30 sessions — усі Smart Summary потрапляють у manual review flag (SSOT I.6 / F.4.1), незалежно від classifier output.
7. Вся memory-логіка у `src/lib/memory/**` без імпортів `next/*`, `@supabase/*`, `react-native` (перевірка lint-rule у tsconfig + eslint-custom).

### 10.2. DoD P0b (user-facing)

1. Memory screen (`/dashboard/memory`) рендерить 4 блоки C.3.2 з візуальним розрізненням C.3.3.
2. Reaction controls `Yes, that fits / Not quite / Not anymore / Hide` фіксують audit-log (SSOT D.6) і змінюють state згідно SSOT D.5.1.
3. `memory_correction_rate` обчислюваний (DoD P0b SSOT A.4 #1).
4. Check-in completion rate вимірюваний (DoD P0b SSOT A.4 #4).
5. Rollback within 24h (SSOT D.2.4) через `POST /api/memory/correction { undo: true }`.
6. Recalibration after 7-day pause (SSOT D.7): factor 0.6 / 0.8 застосовано, banner у Memory screen показаний.
7. Заборона `hypothesis → confirmed_insight` через resonance path — перевірена unit-тестом (SSOT D.5.3).

### 10.3. Port-readiness DoD (обов'язкова для старту порту в `jar/`)

1. Жоден файл у `src/lib/memory/**` не містить прямих залежностей від порталу. Перевірка: lint-правило `no-restricted-imports` для `next/*`, `@supabase/*`, `window`, `localStorage`.
2. Усі hooks з §2.3 функціонують з mock-адаптерами у unit-тестах (jest/vitest).
3. У `mindjar-dashboard/docs/` є список "what to copy to `jar/`": `src/lib/memory/types.ts`, `src/lib/memory/constants.ts`, `src/lib/memory/state/*`, `src/lib/memory/retrieval/*`, `src/lib/memory/generation/*` (крім prompts template strings, якщо RN має локалізацію окремо), `src/lib/memory/hooks/*`.

---

## 11. Трасування SSOT → артефакт

| SSOT | Артефакт у порталі |
|---|---|
| A.7 canonical EN | `types.ts`, `localizations/tags.json` |
| A.8.1 memory ≠ chat history | `generation/prompts.ts` filter |
| B.2 принципи | JSDoc над core-функціями + guardrail tests |
| C.2 онбординг → memory | `useOnboardingSubmit` + `sync/normalize.ts` |
| C.3 Memory screen | `src/app/dashboard/memory/page.tsx` + `useMemoryItems` |
| C.4 Smart Summary UX | `src/app/dashboard/checkin-sim/page.tsx` + `useSmartSummary` + `generation/smartSummary.ts` |
| D.1 типи | `types.ts` `MemoryItemType` |
| D.2 state machine | `state/transitions.ts` + unit-тести |
| D.3 schema | міграція §5.1 + TS-тип |
| D.4 confidence / decay | `state/confidence.ts`, `state/decay.ts` |
| D.5 signal registry | `state/signalRegistry.ts`, `constants.ts` |
| D.6 audit trail | `memory_audit_log` + `feedback/apply.ts` |
| D.7 recalibration | `state/recalibration.ts` + `useRecalibration` |
| D.8 stable_profile | `async/profile.ts` + `useStableProfile` |
| E.1 sync/async | API split + `useAsyncEnrichment` |
| E.3 session_card | `types.ts`, `sync/normalize.ts`, таблиця §5.3 |
| E.4 session_summary | §5.4 + `sync/summary.ts` + `async/enrich.ts` |
| E.5 daily_snapshot | §5.6 + `async/snapshot.ts` + `useDailySnapshot` |
| E.6 retrieval | `retrieval/*` |
| E.7 Smart Summary gen | `generation/smartSummary.ts` |
| E.10 data × risk matrix | switch у `smartSummary.ts` + `retrieve.ts` |
| E.11 latency | metrics middleware в API routes |
| E.12 events | `telemetry/events.ts` + `TelemetryAdapter` |
| F.1 safety classifier | `safety/classifier.ts` + `useSafetyClassifier` |
| F.2 avoided topics | `safety/avoidedTopics.ts`; `declared_boundary` items |
| F.3 crisis | safe crisis template у `generation/safeTemplates.ts` |
| F.4 manual review | `safety_events` + admin view |
| §0.5 premium switcher | `hooks/usePortalSubscription.ts` + `<PremiumToggle />` |

---

## 12. Non-goals (explicit)

Усе нижче — **не** імплементується в цій ітерації, навіть якщо є у SSOT:
- Повний Rings / Echoes / Weekly UX (лише data-hooks за потребою).
- Paywall (SSOT H) — stub.
- On-device authoritative storage у порталі (SSOT F.5.2 — це контракт мобільного; портал — Supabase).
- P1/P2 SSOT roadmap (A.3): topic-level hide, automatic `support_style` revalidation, `Why am I seeing this?`, Progress-as-memory-first, окрема memory-tab.
- Будь-що, що додає фрикцію в `check-in → Smart Summary → повернення завтра` (SSOT A.8.4, B.2.6).
- Будь-які зміни у `jar/types/index.ts` або міграції для `jar/` (правила §0.2, §0.3).

---

## 13. Порядок імплементації (пропозиція, не план)

1. `src/lib/memory/types.ts`, `constants.ts`, `signalRegistry.ts`, `confidence.ts`, `decay.ts`.
2. Adapter-інтерфейси §3 + портальні реалізації: `InMemoryStorageAdapter` (default), `portalSubscription`, `AIAdapter` (обгортка над існуючим OpenAI/Anthropic через Next.js API route), `TelemetryAdapter`, `ClockAdapter`.
3. `state/transitions.ts`, `conflict.ts`, `rollback.ts`, `recalibration.ts` + unit-тести (з mock-адаптерами).
4. `sync/*`, `async/*`, `retrieval/*`, `generation/*`, `safety/*`, `feedback/*`.
5. Hooks §2.3.
6. API routes §6 (thin transport over hooks/core; працюють через `InMemoryStorageAdapter`, доки власник не створить таблиці руками).
7. Сторінки §7 + Premium switcher.
8. Port-readiness DoD §10.3.
9. (Опційно, поза скоупом агента) Власник додає таблиці §5 у Supabase → `SupabaseStorageAdapter` вмикається через env-флаг без змін у core/hooks.
