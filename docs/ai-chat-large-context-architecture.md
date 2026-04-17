# AI Chat Architecture for Large Context and Diff-first Editing

## 1) Purpose

This document describes a production-ready architecture for collaborative AI editing when:
- documents can be large,
- users attach multiple context files,
- we must show git-like diffs before applying,
- and model responses must be stable and parseable.

Main product rule:
- **AI proposes changes, user applies changes.**
- No silent overwrite of the document.

---

## 2) Product Principles

- **Diff-first UX**: every AI response is a proposal with visual diff.
- **Single-model execution per request** (current product scope).
- **Provider-agnostic contract**: OpenAI/Anthropic must map to one internal schema.
- **Chunked context retrieval**: do not send full corpus into one prompt.
- **Deterministic apply safety**: apply only if base version matches (stale-check).
- **Fail closed on parsing**: invalid model output never mutates document.

---

## 3) High-level Flow

1. User sends message in chat, with optional attached context docs.
2. Backend stores user message.
3. Backend builds retrieval query from:
   - user message,
   - current document title/body,
   - selected context doc ids.
4. Backend retrieves top relevant chunks under token budget.
5. Backend calls selected model with strict JSON instructions.
6. Backend validates model output with schema.
7. Backend creates `ai_change_candidate` (proposal), no document update.
8. UI renders proposal summary + git-like diff (green/red).
9. User clicks `Apply` or `Reject`.
10. On `Apply`, backend runs stale-check and updates document atomically.

---

## 4) Data Model

## 4.1 Core existing tables

- `documents`
- `messages`
- `chats`

## 4.2 Proposal table (already aligned with current implementation)

`ai_change_candidates`
- `id`
- `chat_id`
- `document_id`
- `base_document_content`
- `candidate_document_content`
- `model`
- `chat_reply`
- `status` (`pending|applied|rejected|superseded`)
- `usage`
- `latency_ms`
- `created_at`
- `applied_at`
- `applied_by`

## 4.3 New chunk index tables (recommended next step)

`document_chunks`
- `id uuid`
- `document_id uuid`
- `chunk_index int`
- `section_path text` (e.g. `H1:Intro > H2:Goals`)
- `content text`
- `token_estimate int`
- `char_start int`
- `char_end int`
- `content_hash text`
- `embedding vector` (if pgvector enabled)
- `created_at timestamptz`
- `updated_at timestamptz`

`document_chunk_summaries` (optional)
- `chunk_id uuid`
- `summary text`
- `keywords text[]`
- `updated_at`

Why:
- fast retrieval,
- deterministic patch targets,
- smaller and cheaper prompts.

---

## 5) Chunking Strategy

## 5.1 Split policy

Preferred order:
1. Split by markdown headings (`#`, `##`, `###`).
2. If section too large, split by paragraph boundaries.
3. Keep code blocks intact when possible.

## 5.2 Chunk size

- target: `800–1500` tokens per chunk,
- overlap: `10–15%` between neighboring chunks.

## 5.3 Re-chunk triggers

Recompute chunks when:
- document saved and `content_hash` changed,
- import completed,
- AI apply completed.

---

## 6) Retrieval Pipeline (RAG for editing)

## 6.1 Candidate pool

Build candidate chunks from:
- current document chunks (always included in ranking),
- selected context document chunks,
- optional global recent chunks from same chat.

## 6.2 Ranking

Hybrid ranking:
- semantic score (embedding similarity),
- lexical boost (keyword overlap),
- structural boost (heading matches from prompt).

## 6.3 Budgeted packing

Given model context window:
- reserve budget for:
  - system prompt,
  - user prompt,
  - output,
  - safety margin.
- fill remaining budget with highest-ranked chunks.

If overflow:
- drop low-score chunks first,
- never truncate in the middle of JSON examples,
- prefer complete chunks over partial random cuts.

---

## 7) Prompt and Output Contract

## 7.1 Canonical output schema

Current stable schema:

```json
{
  "chat_reply": "string",
  "document_markdown": "string"
}
```

Provider output must pass through one parser/validator.

## 7.2 Prompt constraints

System prompt should require:
- valid JSON only, no markdown fences,
- both required keys always present,
- unchanged document echoed if user asked only a question.

## 7.3 Parse resilience

On parse failure:
1. Retry once with repair prompt:
   - "Return valid minified JSON only. Same semantic content."
2. If still invalid:
   - return structured API error,
   - create no candidate,
   - do not update document.

---

## 8) Diff-first UX

## 8.1 Candidate card

Show:
- model name,
- latency,
- usage/cost hint,
- chat summary,
- line diff preview.

## 8.2 Diff rendering

MVP:
- `diffLines` with:
  - added lines green,
  - removed lines red,
  - unchanged muted.

V2:
- word-level highlight,
- fold unchanged blocks,
- section-level jump navigation.

## 8.3 User actions

- `Apply`
- `Reject`
- `Regenerate` (same prompt, maybe same model)

---

## 9) Apply Logic and Concurrency

Before apply:
1. Load candidate by `id` and verify `status = pending`.
2. Load current `documents.content`.
3. Compare with `base_document_content`.
4. If mismatch -> return `stale_candidate` conflict.
5. If match -> update `documents.content`, mark candidate `applied`, insert assistant message.

This guarantees deterministic behavior in collaborative sessions.

---

## 10) API Design (recommended endpoints)

- `POST /api/collab-docs/chat`
  - input: `chatId`, `userMessageId`, `modelId`, `contextDocumentIds[]`
  - output: `candidate`

- `PATCH /api/collab-docs/candidates/:candidateId`
  - input: `{ action: "apply" | "reject" }`
  - output: final status, conflict code if stale

- `GET /api/collab-docs/candidates?chatId=...` (optional)
  - list recent proposals for audit/history UI

---

## 11) Observability and Performance

Track per request:
- `latency_total_ms`
- `latency_llm_ms`
- `latency_retrieval_ms`
- input token estimate
- output tokens
- parse_fail count
- stale_apply_conflict count

Alert on:
- parse fail rate spike,
- timeout rate spike,
- p95 latency regression.

---

## 12) Cost and Token Control

Hard limits:
- max context docs attached,
- max chunks packed,
- max chars per chunk,
- max output tokens.

Soft controls:
- dynamic budget by selected model,
- early warning in UI (`~cost`),
- optional refusal when budget exceeded.

---

## 13) Security

- provider keys server-only.
- strict request validation (`zod`).
- body size limits.
- rate limit by IP/chat/session.
- redact document contents from public logs.

---

## 14) Rollout Plan

## Phase A (now)
- single model
- full-document candidate
- diff + apply/reject
- stale-check

## Phase B
- chunk indexing
- retrieval + budgeted context
- parse retry hardening

## Phase C
- section/patch output format
- partial apply
- richer diff viewer

---

## 15) Future Upgrade: Patch Contract (optional)

To reduce token usage further, move from full-document output to patch output:

```json
{
  "chat_reply": "string",
  "patches": [
    {
      "target_chunk_id": "uuid",
      "operation": "replace",
      "new_text": "..."
    }
  ]
}
```

Then reconstruct candidate document server-side before diff/apply.

---

## 16) Acceptance Criteria

- Large context requests are packed by token budget, not full-document dump.
- Provider switch does not change output schema.
- Invalid JSON never updates documents.
- User always sees diff before apply.
- Apply succeeds only on matching base snapshot.
- System remains responsive under multi-document context.
