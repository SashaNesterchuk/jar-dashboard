# Agentic AI Orchestration — Epics

Эпики для перехода от текущего single-shot AI route к полноценной агентной оркестрации для длинных документов и multi-doc контекста.

Цель: устойчивый поток **plan -> retrieve -> propose -> validate -> diff/apply**, где большие тексты обрабатываются по шагам, а не одним огромным prompt.

Выбранный стек: **LangGraphJS внутри текущего backend** (без отдельного сервиса на старте).

---

## Execution Model (принятое решение)

- LangGraphJS запускается внутри текущего `POST /api/collab-docs/chat` как orchestration graph.
- UI и контракт candidate остаются совместимыми с текущим flow (`diff -> apply/reject`).
- Отдельный worker/service не требуется на фазе MVP Agent v2.
- Деплой остается на текущем хостинге приложения (минимум операционных изменений).

### Базовый граф (MVP)

1. `intent_node` -> определяет режим (`answer_only`, `edit_local`, `edit_with_context`, `multi_doc_summary`)
2. `context_node` -> выбирает Tier A/B/C стратегию контекста
3. `plan_node` -> формирует structured plan
4. `patch_node` -> генерирует patch v2
5. `validate_node` -> schema/language/safety/source checks
6. `repair_or_complete_node` -> repair retry или завершение candidate

---

## Hosting & Ops (без отдельного сервиса)

### Что это дает

- Нет отдельного DevOps-контура (Docker/Fly/Railway не обязательны).
- Нет межсервисной сети между API и agent runtime.
- Быстрый rollout через feature flag на одном backend.

### Что обязательно учесть

- Таймауты по стадиям (чтобы не упираться в serverless limit).
- Ограничение числа graph-итераций на запрос.
- Structured logs по node transitions.
- Fallback режим: при fail graph route должен вернуть корректный `answer_only`, а не 500.

### Env (без изменений по инфраструктуре)

- `OPENAI_API_KEY` и/или `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_DOCS_SUPABASE_URL`
- `DOCS_SUPABASE_SERVICE_ROLE_KEY`
- `AGENT_ENGINE=legacy|langgraph`

---

## Rollout Plan (LangGraphJS in-place)

1. Внедрить graph под флагом `AGENT_ENGINE=langgraph`, default оставить `legacy`.
2. Прогонять существующие smoke-сценарии на обеих ветках.
3. Включить `langgraph` для dev/staging.
4. Затем gradual rollout в production (например 10% -> 50% -> 100% запросов).
5. При росте latency/error быстро откатываться флагом на `legacy`.

Operational guardrails:
- rollback trigger: `5xx >= 2%` за 15 минут или `p95 >= 25s` за 15 минут;
- fallback-rate trigger: `>= 45%` за 30 минут;
- rollback action: `AGENT_ENGINE=legacy` + redeploy.

Детальный playbook: [langgraph-implementation-epic.md](./langgraph-implementation-epic.md).

---

## Epic J — Agent Runtime (Orchestrator)

| ID | Задача | Критерии готовности / заметки |
|----|--------|-------------------------------|
| J1 | Ввести явные стадии run-а | Стадии: `intent`, `context_plan`, `draft_plan`, `propose_patch`, `validate`, `complete`; стадия пишется в лог/метаданные для диагностики. |
| J2 | Добавить run state для одного запроса | Хранится runtime-state (цель, язык, budget, выбранные источники, ошибки валидации). Можно начать с in-memory + structured logs, позже вынести в БД. |
| J3 | Внедрить retry policy по стадиям | Отдельные retry для parse/format ошибок; без бесконечных циклов; max attempts на стадию. |
| J4 | Явный деградационный путь | Если patch невалиден после retry: downgrade в `answer_only` + объяснение в `chat_reply` (без падения 500). |

---

## Epic K — Intent + Planning Layer

| ID | Задача | Критерии готовности / заметки |
|----|--------|-------------------------------|
| K1 | Intent-классификатор запроса | Категории: `answer_only`, `edit_local`, `edit_with_context`, `multi_doc_summary`, `compare`; результат сохраняется в runtime-state. |
| K2 | План действий перед правками | Модель сначала возвращает план: что менять, где менять, ожидаемый формат результата, уровень детализации. |
| K3 | Правило языка ответа | Язык результата всегда совпадает с языком последнего user-message (и для chat reply, и для патчей). |
| K4 | Политика глубины ответа | В плане фиксируется `brief/normal/deep`; для deep обязательно минимум N пунктов и explicit структура разделов. |

---

## Epic L — Context Strategy for Long Documents

| ID | Задача | Критерии готовности / заметки |
|----|--------|-------------------------------|
| L1 | Tiered context mode | Tier A: full-doc (если влазит); Tier B: section-based; Tier C: chunk-based. Выбор режима автоматический по токен-бюджету. |
| L2 | Section slicer для Markdown | Разбиение по `# / ## / ###` с сохранением section path; для длинных секций — под-блоки с overlap. |
| L3 | Multi-doc coverage guarantee | Если выбраны 2+ контекстных docs, в prompt попадает минимум по 2 релевантные секции из каждого (если доступны). |
| L4 | Iterative retrieval | Оркестратор умеет добирать доп. контекст, если confidence низкий или обнаружены пробелы по источникам. |
| L5 | Prompt budget governance | Явные лимиты на историю, текущий doc, контекст docs; фиксируется что и сколько было усечено. |

---

## Epic M — Patch Contract v2 (Anchor-based)

| ID | Задача | Критерии готовности / заметки |
|----|--------|-------------------------------|
| M1 | Новый контракт операций | `replace_block`, `insert_after`, `append_section`; таргет через `section_path`/`anchor_text`/`occurrence`, а не только index. |
| M2 | Resolver таргета в документе | Детерминированный поиск target по section/anchor; fallback-стратегии при отсутствии точного совпадения. |
| M3 | Safe apply engine | Применяет несколько операций атомарно к in-memory версии документа и возвращает итоговый markdown + diagnostics. |
| M4 | Legacy compatibility | Поддержка текущих index-based patches как fallback до полного перехода на v2. |

---

## Epic N — Validation & Quality Gates

| ID | Задача | Критерии готовности / заметки |
|----|--------|-------------------------------|
| N1 | Structural validation | Проверка JSON schema + допустимых операций + лимитов размера/кол-ва правок. |
| N2 | Language validation | Проверка совпадения языка ответа с языком user prompt (heuristic/LLM-check). |
| N3 | Safety validation | Блокировка synthetic headers, служебных маркеров, слишком широкого rewrite без явного запроса пользователя. |
| N4 | Source coverage validation | Для multi-doc запросов проверка, что ответ/изменения опираются на заявленные источники (citations/coverage map). |
| N5 | Auto-repair stage | Если validation fail, запускается repair prompt с конкретными нарушениями и повторной валидацией. |

---

## Epic O — UX: Agent Transparency + Diff Experience

| ID | Задача | Критерии готовности / заметки |
|----|--------|-------------------------------|
| O1 | Показывать краткий plan в UI | Перед diff отображается “что агент собирается изменить” (1-3 пункта). |
| O2 | Diff с группировкой по операциям | Визуализация по блокам/секциям: что вставлено, что заменено, что добавлено в конец. |
| O3 | Пояснение по источникам | В candidate отображать какие docs/sections использованы для вывода. |
| O4 | Conflict UX (stale/rebase) | При stale не просто reject, а понятный путь: regenerate/rebase proposal. |
| O5 | Optional strict mode | Режим “ответ без правок” и режим “только правки документа” с явным переключателем в чате. |

---

## Epic P — Observability, Testing, Reliability

| ID | Задача | Критерии готовности / заметки |
|----|--------|-------------------------------|
| P1 | Structured run logs | Логи по стадиям: latency, selected sources, token usage, validation failures, retries. |
| P2 | Smoke suite расширить до agent flow | Сценарии: длинный doc, 2+ docs контекст, language lock, stale apply, fallback to answer_only. |
| P3 | Regression fixtures | Набор фиксированных документов и expected-invariants (не exact text, а свойства результата). |
| P4 | SLO/SLA метрики | p95 latency, error rate, invalid patch rate, stale-candidate rate, apply success rate. |
| P5 | Failure playbook | Документация “что делать при росте invalid patch / timeout / source coverage failures”. |

---

## Рекомендуемый порядок внедрения

1. **K1-K3 + L1 + N1** (быстрый рост стабильности без тяжелого рефакторинга)  
2. **M1-M3 + N3-N5** (уход от хрупких index-патчей)  
3. **J1-J4 + L2-L5** (полноценная оркестрация длинных контекстов)  
4. **O1-O4** (прозрачность и UX)  
5. **P1-P5** (операционная зрелость)

---

## Definition of Done (для Agent v2)

- Нет критических 500 из-за patch target mismatch в стандартных сценариях.
- Для длинных документов контекст собирается многошагово (iterative), без single-shot prompt перегруза.
- Язык результата стабильно совпадает с языком запроса.
- Для multi-doc задач подтверждается coverage источников.
- Пользователь всегда видит diff и применяет изменения явно через apply/reject.
