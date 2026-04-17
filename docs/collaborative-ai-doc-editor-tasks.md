# Технические задачи: совместный редактор + ИИ-чат

Бэклог по продуктовой спецификации [collaborative-ai-doc-editor.md](./collaborative-ai-doc-editor.md). Задачи сгруппированы по эпикам; порядок внутри эпика отражает типичные зависимости.

---

## Epic A — Supabase: схема и доступ

**Статус: реализовано в репозитории** (применить SQL к проекту `jnfebpmkcejmclmoqiky` вручную или через CLI — см. [supabase-docs-project-setup.md](./supabase-docs-project-setup.md)).

| ID | Задача | Критерии готовности / заметки |
|----|--------|-------------------------------|
| A1 | Зафиксировать финальный DDL для `chats`, `documents`, `messages` | FK `documents.chat_id → chats.id` ON DELETE CASCADE; `UNIQUE(documents.chat_id)`; CHECK на `messages.role`; индекс `(chat_id, created_at)`; триггер `documents.updated_at`; колонки `model`, `usage`, `metadata` на `messages`; опционально `chats.title`, `chats.default_model`. |
| A2 | Применить миграции в проекте `jnfebpmkcejmclmoqiky` | Файл: `supabase/migrations/20260416120000_collaborative_doc_editor_schema.sql`. Инструкция: [supabase-docs-project-setup.md](./supabase-docs-project-setup.md). |
| A3 | Включить RLS на всех трёх таблицах | Политики под выбранную модель доступа (MVP: общий секрет в URL / токен в header / `auth.uid()` — зафиксировать решение из §10). Без политик anon не использовать в проде. |
| A4 | Включить Realtime для нужных таблиц | Публикация `documents`, `messages` (и при необходимости `chats`) в `supabase_realtime`; проверить подписку из клиента. |
| A5 | Задокументировать server-only секреты | `DOCS_SUPABASE_SERVICE_ROLE_KEY` (или единое имя) в Vercel/CI; не путать с основным `SUPABASE_URL` дашборда. |

---

## Epic B — Инфраструктура приложения (mindjar-dashboard)

**Статус: реализовано** — клиент [`src/lib/docs-supabase.ts`](../src/lib/docs-supabase.ts), типы [`src/types/collab-docs.ts`](../src/types/collab-docs.ts), список [`src/app/dashboard/documents/page.tsx`](../src/app/dashboard/documents/page.tsx), редактор-заготовка [`src/app/dashboard/documents/[chatId]/page.tsx`](../src/app/dashboard/documents/[chatId]/page.tsx), API [`src/app/api/collab-docs/sessions/route.ts`](../src/app/api/collab-docs/sessions/route.ts), RPC-миграция [`supabase/migrations/20260416130000_collab_create_session_rpc.sql`](../supabase/migrations/20260416130000_collab_create_session_rpc.sql).

| ID | Задача | Критерии готовности / заметки |
|----|--------|-------------------------------|
| B1 | Клиент Supabase для проекта документов | Модуль `createClient` с `NEXT_PUBLIC_DOCS_SUPABASE_URL` / `NEXT_PUBLIC_DOCS_SUPABASE_ANON_KEY` (как в спеки); отдельно от клиента основного проекта. |
| B2 | Типы TS для строк БД | Типы/интерфейсы для `Chat`, `Document`, `Message`, `MessageMetadata` (контекст вложений). |
| B3 | Роут редактора в App Router | Например `/dashboard/documents/[chatId]` или `/dashboard/docs/[id]`; заменить/дополнить текущую заглушку списка документов. |
| B4 | Список сессий + «Новый документ» | Создание строк `chats` + `documents` в одной транзакции (RPC или Edge Function с service role); редирект на редактор. |

---

## Epic C — UI редактора и чата (MVP)

**Статус: реализовано** в [`src/components/collab-doc-editor/collab-doc-editor.tsx`](../src/components/collab-doc-editor/collab-doc-editor.tsx). Сообщения: **Send note** (без ИИ) и **Send to AI** (см. также Epic H).

| ID | Задача | Критерии готовности / заметки |
|----|--------|-------------------------------|
| C1 | Layout split: редактор слева, чат справа | Адаптивно: на узком экране табы или стек; соответствие спеки §2. |
| C2 | Редактор текста документа | Сохранение `documents.content` (debounce + явное сохранение при blur); отображение текущего `title`. |
| C3 | Лента сообщений | Загрузка по `chat_id`; роли `user` / `assistant` в UI; без отображения «кто именно» (спека §1). |
| C4 | Поле ввода чата + отправка user-сообщения | INSERT в `messages`; очистка инпута; optimistic UI по желанию. |
| C5 | Dropdown выбора модели | 4 опции (2× OpenAI, 2× Anthropic); сохранение в `chats.default_model` или локально до первого запроса. |
| C6 | Оценка стоимости до отправки | Конфиг тарифов USD/1M in/out; грубый подсчёт токенов; строка вида «~ $X (±30%)»; дисклеймер что это оценка. |
| C7 | Прикрепление контекста других документов | Picker / multi-select; в промпт уходит текст вложений; в `messages.metadata` — `context_document_ids` и краткая подпись в ленте («прикреплено: …»). Обрезка по лимиту токенов. |

---

## Epic D — ИИ: прокси, контракт ответа, применение к документу

**Статус: реализовано** — [`src/app/api/collab-docs/chat/route.ts`](../src/app/api/collab-docs/chat/route.ts), парсер [`src/lib/collab-ai-parse.ts`](../src/lib/collab-ai-parse.ts), каталог моделей [`src/lib/collab-ai-models.ts`](../src/lib/collab-ai-models.ts). Нужны `OPENAI_API_KEY` и/или `ANTHROPIC_API_KEY` в env.

| ID | Задача | Критерии готовности / заметки |
|----|--------|-------------------------------|
| D1 | API Route или Edge Function «chat completion» | Ключи OpenAI/Anthropic только server-side; вход: история, документ, модель, вложенный контекст; выход: текст ответа + структура для правки документа. |
| D2 | Зафиксировать контракт ответа ИИ | Например JSON: `{ "chat_reply": string, "document_markdown": string }` или patch — одно решение на MVP; валидация (zod). |
| D3 | Вызов провайдера по выбранной модели | Ветвление OpenAI vs Anthropic; таймауты и обработка ошибок; сообщение об ошибке в чате. |
| D4 | Запись ответа в БД | INSERT assistant `messages` с `content`, `model`, `usage`; обновление `documents.content` (и `updated_at` триггером); опционально обновить UI «фактическая ~$» из `usage`. |
| D5 | Системный промпт | Инструкция: отвечать кратко в чате, выдавать цельный текст документа или согласованный патч; учёт вложенного контекста. |

---

## Epic E — Реалтайм

**Статус: реализовано** в `collab-doc-editor.tsx`: `postgres_changes` на `documents` (UPDATE по `id`) и `messages` (INSERT по `chat_id`); broadcast-канал `typing:${chatId}` для индикатора набора. Polling не используется.

| ID | Задача | Критерии готовности / заметки |
|----|--------|-------------------------------|
| E1 | Подписка на изменения `documents` | При обновлении `content` с другого клиента — обновить редактор без полной перезагрузки; аккуратно с фокусом/курсором (минимум: если не в фокусе — подставить новый текст). |
| E2 | Подписка на новые `messages` | Новые строки появляются у всех подписчиков `chat_id`. |
| E3 | Индикатор набора в чате | Realtime Broadcast `room = chat_id`; показ «X печатает…»; чужой черновик read-only (спека §4). |
| E4 | (Если не Broadcast) Задокументировать trade-off | Например polling — нежелательно; явно отметить технический долг. |

---

## Epic F — Стратегия конфликтов редактора

**Решение (F1):** без CRDT в MVP — **last-write-wins по сохранению** и **удалённые правки в textarea подтягиваются только когда поле не в фокусе** (см. подсказку под редактором). Полноценный merge/CRDT — позже.

| ID | Задача | Критерии готовности / заметки |
|----|--------|-------------------------------|
| F1 | Принять решение по §10 (CRDT vs last-write-wins) | Зафиксировать в ADR или в конце этого файла одним абзацем. |
| F2 | Реализовать минимальную стратегию | Например LWW с версией `updated_at` или простое перезаписывание при получении realtime; предупреждение в UI при конфликте (опционально v2). |

---

## Epic G — Качество и эксплуатация

**Статус: частично** — в `/api/collab-docs/chat`: лимит размера тела, грубый rate limit по IP, усечение документа/контекста в промпте, `console.error` на ошибки LLM/парсинга без тела ответа в логах. G3 — чеклист вручную.

| ID | Задача | Критерии готовности / заметки |
|----|--------|-------------------------------|
| G1 | Лимиты и защита API | Rate limit на route ИИ; макс. размер тела запроса; отсечение слишком длинного документа/истории. |
| G2 | Логирование | Структурные логи ошибок провайдера; без утечки полного текста в публичные логи при необходимости. |
| G3 | Ручной прогон сценариев | Два браузера: общий документ, сообщение в чате, ответ ИИ меняет текст; typing indicator; прикрепление второго документа как контекста. |

---

## Рекомендуемый порядок внедрения (кратко)

1. A1 → A2 → A3 → A4  
2. B1 → B2 → B3 → B4  
3. C1–C4 (без ИИ, только CRUD + realtime документ/сообщения)  
4. D1–D5 (подключить ИИ и обновление документа)  
5. C5–C7 (модели, $, контекст)  
6. E1–E3  
7. F1–F2  
8. G1–G3  

---

## Epic H — Коллаборация людей и полировка (после MVP A–G)

**Статус: H1–H4 реализованы** в [`collab-doc-editor.tsx`](../src/components/collab-doc-editor/collab-doc-editor.tsx). **H5** — операционный чеклист (алерты / регресс вручную).

| ID | Задача | Критерии готовности / заметки |
|----|--------|-------------------------------|
| H1 | Сообщения в чат **без вызова ИИ** | Кнопка «Заметка» / «Send note»: INSERT `messages` с `metadata.note_only`; коллеги видят через Realtime (уже есть). |
| H2 | **Превью чужого набора** (read-only) | Broadcast вместе с typing: короткий `draftPreview`; у других — блок «печатает…» + текст черновика, без редактирования (спека §4). |
| H3 | **Конфликт документа** (лёгкий F2) | Если пришёл remote UPDATE `documents` пока textarea в фокусе — баннер + «Load latest» (`refreshDoc`), не затирать локальный текст молча. |
| H4 | Разделение «человек / ассистент» в ленте | Бейдж «Note» для `note_only`; при желании позже — отдельный стиль для сообщений с контекстом к ИИ. |
| H5 | G3 + мониторинг | Ручной регресс; при проде — алерты по 5xx `/api/collab-docs/chat`, лимиты в Vercel. |

---

## Открытые решения (зафиксировать до кодинга D/E)

- Один смешанный чат (люди + ассистент) vs отдельные каналы — влияет на `messages.role` и UI.
- Формат ответа ИИ: полный документ каждый раз vs патч — влияет на D2 и размер ответа.
