# Epic: AI Quality via Self-Critique (без жестких quality-minimums)

Цель: повысить глубину и связность ответа AI (особенно для `multi_doc_summary`), не навязывая жёстких шаблонов типа "минимум 6 секций / 12 bullets". Качество растёт за счёт механики, где модель сама оценивает и улучшает свой черновик.

Связанные документы:
- [agentic-ai-orchestration-epics.md](./agentic-ai-orchestration-epics.md)
- [langgraph-implementation-epic.md](./langgraph-implementation-epic.md)
- [ai-chat-diff-cursor-like.md](./ai-chat-diff-cursor-like.md)

---

## Принципы

- Не навязываем форму ответа (структура, длина, количество пунктов).
- Не хардкодим язык/ключевые слова пользователя.
- Качество растёт за счёт самонаблюдения модели и ограниченного числа итераций.
- Research и writing — разные шаги в графе.
- Validator остаётся про безопасность и формат, не про качество.

---

## Scope (что входит)

1. Разделение research и writing для сложных задач (summary/compare).
2. Узлы `critique_node` и `refine_node` в graph-runtime.
3. Авто-активация quality-loop только там, где это имеет смысл (не для мелких правок).
4. Интеграция со существующим apply-флоу (diff → apply/reject).
5. Расширение observability: critique score, weaknesses, итерации.

Не входит:
- смена UI контракта `ai_change_candidates`;
- multi-model сравнение;
- fine-tuning моделей.

---

## Deliverables

- Новые узлы `research_node`, `critique_node`, `refine_node`.
- Writing-стадия, отделённая от patch-контракта.
- Zod-схемы для critique и research outputs.
- Обновлённый `runDiagnostics` со стадиями quality-loop.
- Smoke-сценарии на multi-doc и deep summary.

---

## Эпики

### Epic Q — Research / Writing separation

| ID | Задача | Критерии готовности |
|----|--------|---------------------|
| Q1 | `research_node` | Для `multi_doc_summary`/`compare` отдельный LLM-вызов, возвращает `researchState`: key_facts, numbers, quotes, contradictions, source_refs. |
| Q2 | `writing_node` | Новый узел, который пишет финальный markdown из `researchState`, а не из сырых чанков. |
| Q3 | Отвязать writing от patch-контракта | Writing возвращает итоговый markdown; patch формируется после, не ограничивая модель на этапе написания. |
| Q4 | Авто-активация | Для `edit_local`/простых правок research и writing пропускаются; для `multi_doc_summary`/`compare` — включаются. |

---

### Epic R — Self-critique loop

| ID | Задача | Критерии готовности |
|----|--------|---------------------|
| R1 | `critique_node` | LLM-узел оценивает draft и возвращает `{quality_score: number, weaknesses: string[]}`. |
| R2 | Критерии без хардкода | Критерии даны текстом в system prompt критика (покрытие запроса, использование обоих источников, выводы/инсайты, наличие фактов/чисел, отсутствие шаблонных фраз, связность, соответствие языку). Никаких regex/счётчиков в коде. |
| R3 | Language-awareness | Критик сам определяет, что ответ на языке пользователя, без таблиц соответствий. |
| R4 | Diagnostics | `runDiagnostics` хранит последнюю критику (score + weaknesses). |

---

### Epic S — Refinement loop

| ID | Задача | Критерии готовности |
|----|--------|---------------------|
| S1 | `refine_node` | Один LLM-вызов, инструкция: "устрани именно эти weaknesses, сохрани намерение, язык и факты". |
| S2 | Ограничение итераций | Максимум 1–2 прохода `critique` + `refine`. |
| S3 | Early stop | При `quality_score >= threshold` (стартово 0.75) refine не запускается. |
| S4 | Guard against loops | Если после refine качество не выросло — завершаем с лучшим черновиком, без 5xx. |

---

### Epic T — Patch-safe integration

| ID | Задача | Критерии готовности |
|----|--------|---------------------|
| T1 | Writing → patch adapter | Итоговый markdown корректно превращается в patch-контракт для существующего apply flow. |
| T2 | Без синтетических меток | В финальном тексте нет `chunk_index:` и служебных заголовков. |
| T3 | Stale-check сохраняется | Apply остаётся через diff-first UX, stale-check не ломается. |
| T4 | Back-compat | В сценариях, где quality-loop выключен, поведение прежнее. |

---

### Epic U — Observability for quality loop

| ID | Задача | Критерии готовности |
|----|--------|---------------------|
| U1 | Diagnostics стадии | В `runDiagnostics` появляются `research`, `critique`, `refine`. |
| U2 | Score history | Видна прогрессия качества до/после refine. |
| U3 | Failure reasons | Если refine не помог — понятная причина в diagnostics (например `refine.no_improvement`). |
| U4 | Smoke обновление | `test/collab-chat-smoke.mjs` печатает quality_score и количество итераций refine. |

---

## Рекомендуемый порядок внедрения

1. **Q1–Q4 + T1**: ввести research/writing, подружить с текущим patch flow.
2. **R1–R4**: добавить critique.
3. **S1–S4**: добавить refine.
4. **U1–U4**: observability.
5. **T2–T4**: убедиться, что apply/UX и back-compat не деградируют.

---

## Acceptance Criteria (Self-Critique v1)

- Без хардкод-минимумов по структуре/языку.
- Для `multi_doc_summary` качество стабильно выше за счёт critique/refine на одинаковых промптах.
- Новых 5xx не появляется.
- Есть прозрачная трассировка quality-loop в diagnostics.
- UI работает без изменений контракта (diff → apply/reject).

---

## Риски и митигации

- **Рост latency из-за лишних LLM-вызовов** → максимум 1 проход `critique + refine`, плюс early stop по score.
- **Зацикливание refine** → жёсткий `max_iterations` и fallback на лучший черновик.
- **Ложно-низкий score от критика** → критик получает чёткий перечень критериев, но без regex; его вывод всегда проходит Zod-схему.
- **Большие output tokens** → не ставим жёстких лимитов, наблюдаем через `runDiagnostics.usage`.
- **Ухудшение простых правок** → quality-loop включается только по интенту, не для `edit_local`.

---

## Definition of Done

- Для `multi_doc_summary` без ручных флагов результат стабильно глубже и структурированнее.
- Никаких хардкодов "минимум N разделов / N bullets".
- `critique_node` и `refine_node` явно видны в runtime и diagnostics.
- UX diff/apply не изменился.
- Smoke-тесты зелёные, включая сценарий "создай один документ на основе двух".
