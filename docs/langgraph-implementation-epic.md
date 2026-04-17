# Epic: LangGraphJS Implementation (In-Backend)

План реализации агентной оркестрации на **LangGraphJS внутри текущего backend** без отдельного сервиса.

Связанные документы:
- [agentic-ai-orchestration-epics.md](./agentic-ai-orchestration-epics.md)
- [ai-chat-diff-cursor-like.md](./ai-chat-diff-cursor-like.md)

---

## Цель эпика

Перевести `POST /api/collab-docs/chat` с single-shot выполнения на graph-orchestration:

`intent -> context -> plan -> patch -> validate -> repair/complete`

При этом сохранить совместимость с текущим UI:
- вернуть `candidate` в прежнем формате;
- оставить flow `diff -> apply/reject`;
- включать новый runtime через feature flag.

---

## Scope (что входит)

1. Graph state и узлы LangGraphJS внутри backend.
2. Feature flag `AGENT_ENGINE=legacy|langgraph`.
3. Валидация patch-предложений и controlled fallback.
4. Интеграция со существующими таблицами (`messages`, `documents`, `ai_change_candidates`, `document_chunks`).
5. Smoke/regression прогоны для long-doc и multi-doc сценариев.

Не входит:
- отдельный agent-service,
- новый UI экран,
- полный переход на patch v2 anchors (можно частично через совместимость).

---

## Deliverables

- Новый модуль graph runtime (серверный).
- Обновленный `chat` route с переключением движка по флагу.
- Набор Zod-схем для node outputs.
- Structured logs по стадиям выполнения.
- Обновленные smoke-тесты и чеклист rollout.

---

## Epic Tasks

| ID | Задача | Детали реализации | Критерии готовности |
|----|--------|-------------------|---------------------|
| LG-1 | Ввести server graph state | Тип `AgentRunState` (chatId, docId, language, intent, budget, selectedSources, plan, patch, validation, retries, diagnostics). | Типы добавлены; состояние сериализуемо; нет `any` в state-контракте. |
| LG-2 | Реализовать `intent_node` | Определяет режим: `answer_only`, `edit_local`, `edit_with_context`, `multi_doc_summary`, `compare`. | На тестовых промптах intent стабилен; результат пишется в diagnostics. |
| LG-3 | Реализовать `context_node` (Tier A/B/C) | A: full-doc, B: section-based, C: chunk-based fallback; multi-doc coverage >= 2 источника на doc при возможности. | Для длинного документа не превышается budget; multi-doc coverage фиксируется в state. |
| LG-4 | Реализовать `plan_node` | Structured plan: цели, target sections, desired depth, output language. | Plan валидируется схемой; язык совпадает с user prompt. |
| LG-5 | Реализовать `patch_node` | Генерация patch proposal с совместимостью к текущему apply движку. | Возвращает patch без синтетических заголовков; парсинг стабилен. |
| LG-6 | Реализовать `validate_node` | Structural/language/safety/source checks + change-size guardrails. | Invalid patch не уходит в apply; причины отказа читаемы в diagnostics. |
| LG-7 | Реализовать `repair_or_complete_node` | Один repair retry; при fail downgrade в `answer_only` без 500. | Route не падает на форматных ошибках; всегда возвращает контролируемый ответ. |
| LG-8 | Интегрировать graph в `/api/collab-docs/chat` | Feature flag: `legacy` или `langgraph`; общий формат ответа без изменений для UI. | При `legacy` поведение неизменно; при `langgraph` candidate создается успешно. |
| LG-9 | Логирование и метрики | Стадии, latencies, retries, budget usage, validation fails, fallback reasons. | По одному run есть трассировка стадий; можно диагностировать точку деградации. |
| LG-10 | Smoke + regression | Расширить тесты long-doc, multi-doc, language lock, stale, fallback. | Набор smoke-сценариев проходит стабильно на `langgraph` ветке. |
| LG-11 | Rollout план | 10% -> 50% -> 100% через флаг; rollback = `legacy`. | Документирован и проверен безопасный откат. |

---

## Suggested File Layout

- `src/lib/agent-graph/state.ts`
- `src/lib/agent-graph/nodes/intent-node.ts`
- `src/lib/agent-graph/nodes/context-node.ts`
- `src/lib/agent-graph/nodes/plan-node.ts`
- `src/lib/agent-graph/nodes/patch-node.ts`
- `src/lib/agent-graph/nodes/validate-node.ts`
- `src/lib/agent-graph/nodes/repair-node.ts`
- `src/lib/agent-graph/run-agent-graph.ts`
- `src/app/api/collab-docs/chat/route.ts` (switch engine)

---

## Acceptance Criteria

1. `AGENT_ENGINE=langgraph` работает без отдельного сервиса.
2. Для long-doc запросов агент не делает single-shot oversized prompt.
3. Для multi-doc запросов подтверждается coverage источников.
4. Route не падает 500 из-за patch target mismatch/format errors.
5. UI получает тот же `candidate` контракт и продолжает работать без изменений.
6. Есть быстрый rollback на `legacy`.

---

## Risks and Mitigations

- **Риск:** рост latency из-за многостадийности.  
  **Митигировать:** лимит итераций graph, короткие repair/retry, budget-aware контекст.

- **Риск:** несовместимость нового patch с текущим apply.  
  **Митигировать:** слой адаптации patch + legacy fallback.

- **Риск:** сложнее дебажить без трассировки.  
  **Митигировать:** structured stage logs + run diagnostics в candidate metadata.

---

## Rollout Checklist

- [x] Добавлен флаг `AGENT_ENGINE`.
- [x] Smoke тесты проходят в `langgraph` (усиленные проверки и инварианты).
- [ ] Smoke тесты проходят в `legacy` (обязательная проверка перед прод rollout).
- [ ] Staging прогон с длинными документами.
- [ ] Настроен мониторинг 5xx и p95 latency.
- [x] Подготовлен rollback playbook (переключение `AGENT_ENGINE=legacy`).

---

## LG-11 Rollout Playbook (операционный)

### 0) Preconditions

- `pnpm exec tsc --noEmit` проходит.
- `node test/collab-chat-smoke.mjs` проходит в `AGENT_ENGINE=langgraph`.
- Ключевые маршруты работают без 5xx в dev.

### 1) Staging rollout

1. Установить в staging: `AGENT_ENGINE=langgraph`.
2. Прогнать smoke минимум 3 раза подряд.
3. Прогнать ручные сценарии:
   - simple edit (replace word),
   - add short note,
   - multi-doc summary,
   - apply/reject candidate.
4. Проверить `runDiagnostics` в API ответе:
   - `engine=langgraph`,
   - `stage=complete`,
   - `diagnostics_tail` без критических ошибок.

### 2) Production canary

1. Выкатить с `AGENT_ENGINE=langgraph` на canary-window.
2. Первые 30-60 минут мониторить:
   - error rate `/api/collab-docs/chat`,
   - p95 latency,
   - долю fallback (`validation.fallback` и `patch.fallback.answer_only` в diagnostics/code).

### 3) Go / No-Go thresholds

- **GO** если одновременно:
  - 5xx error rate < 2%
  - p95 latency < 20s
  - fallback rate < 30%
- **NO-GO / rollback** если:
  - 5xx >= 2% в течение 15 минут,
  - или p95 >= 25s в течение 15 минут,
  - или fallback rate >= 45% в течение 30 минут.

### 4) Rollback (1-step)

1. Поменять env: `AGENT_ENGINE=legacy`
2. Redeploy.
3. Проверить:
   - `engine=legacy` в diagnostics,
   - smoke (минимум 1 прогон),
   - снижение 5xx / latency.

### 5) Post-rollout review

- Зафиксировать:
  - p50/p95 latency,
  - fallback reasons top-5,
  - сценарии с instruction-mismatch,
  - список улучшений для следующего цикла (LG-10/LG-11 follow-up).
