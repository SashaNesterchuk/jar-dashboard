# Supabase: проект для collaborative doc editor

Проект (**ref**): `jnfebpmkcejmclmoqiky`  
**URL**: `https://jnfebpmkcejmclmoqiky.supabase.co`

Спека фичи: [collaborative-ai-doc-editor.md](./collaborative-ai-doc-editor.md). Миграции: [../supabase/migrations/20260416120000_collaborative_doc_editor_schema.sql](../supabase/migrations/20260416120000_collaborative_doc_editor_schema.sql) (таблицы, RLS, Realtime), [../supabase/migrations/20260416130000_collab_create_session_rpc.sql](../supabase/migrations/20260416130000_collab_create_session_rpc.sql) (RPC `collab_create_chat_with_document` для Epic B, только `service_role`).

## Как применить миграцию (A2)

**Вариант 1 — SQL Editor в Dashboard**

1. Открой [Supabase Dashboard](https://supabase.com/dashboard) → проект `jnfebpmkcejmclmoqiky`.
2. **SQL Editor** → New query.
3. Вставь содержимое файла `supabase/migrations/20260416120000_collaborative_doc_editor_schema.sql` и выполни.

**Вариант 2 — Supabase CLI**

В репозитории уже есть `supabase/config.toml` (после `supabase init`). Линк к облаку хранится в `supabase/.temp/` (в git не коммитится) — у каждого разработчика после клона:

```bash
cd mindjar-dashboard
npx supabase@latest link --project-ref jnfebpmkcejmclmoqiky
npx supabase@latest db push
```

Для `db push` нужен вход в Supabase CLI (`supabase login`), а не `DOCS_SUPABASE_SERVICE_ROLE_KEY` в `.env` — сервисный ключ для приложения (API/Edge), миграции идут через CLI и роль подключения к Postgres.

Файлы в `supabase/migrations/` без префикса `<timestamp>_` CLI **пропускает** (например `create_user_names_table.sql`). Переименуй в вид `YYYYMMDDHHMMSS_name.sql`, если эту миграцию нужно гонять тем же `db push`.

После применения проверь: таблицы `chats`, `documents`, `messages`; в **Database → Publications** таблицы должны быть в `supabase_realtime`.

## Переменные окружения (A5)

| Переменная | Где | Назначение |
|------------|-----|------------|
| `NEXT_PUBLIC_DOCS_SUPABASE_URL` | клиент | `https://jnfebpmkcejmclmoqiky.supabase.co` |
| `NEXT_PUBLIC_DOCS_SUPABASE_ANON_KEY` | клиент | anon key (Settings → API) |
| `DOCS_SUPABASE_SERVICE_ROLE_KEY` | **только сервер** (API routes, Edge Functions, CI) | обход RLS, админ-операции; **не** префикс `NEXT_PUBLIC_` |
| `ANTHROPIC_API_KEY` | сервер | для Claude в [`/api/collab-docs/chat`](../src/app/api/collab-docs/chat/route.ts) (опционально, если не пользуешься Anthropic-моделями) |

Не путать с основным дашбордом Mind Jar: `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` указывают на **другой** проект (`zgxzlynhkawkuicmariy` и т.д.).

Локально: добавь `DOCS_SUPABASE_SERVICE_ROLE_KEY` в `.env.local` (файл уже в `.gitignore`).

В Vercel: **Settings → Environment Variables** для этого репозитория — те же имена для production/preview по необходимости.

## RLS и anon (A3)

Сейчас политики **разрешают `anon` и `authenticated` полный доступ** ко всем строкам — это осознанный MVP для внутреннего дашборда с отдельным проектом. Перед любым публичным приложением с тем же ключом замени политики на ограничение по `auth.uid()`, membership или секрету сессии.

## Realtime (A4)

Таблицы `chats`, `documents`, `messages` добавлены в публикацию `supabase_realtime`. В клиенте подписка вида:

```ts
channel.on(
  "postgres_changes",
  { event: "*", schema: "public", table: "documents", filter: `chat_id=eq.${chatId}` },
  handler
);
```

(Точный `filter` зависит от того, как связываешь подписку с `chat_id` / `id` документа.)

## Проверка подписки

1. После миграции открой таблицу `documents` в Table Editor, измени `content`.
2. В приложении с `createClient(url, anon_key)` подпишись на `postgres_changes` для `documents` и убедись, что событие приходит.
