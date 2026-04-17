# AI Chat Diff System (Single-Model Runtime, Cursor-like UX)

## Goal

Implement AI chat where every request returns a **change proposal** and a **git-like diff**:
- green = added
- red = removed

Current requirement: **only one model runs per request**.  
Architecture must still make model switching safe: if user selects another model, response format remains identical and diff/apply flow keeps working.

---

## Product Behavior (Current Scope)

1. User writes a message in chat.
2. User optionally attaches context docs.
3. User chooses **one** model in dropdown.
4. Backend runs only that model.
5. Backend returns proposed full document text + chat reply.
6. UI computes and shows diff against current document.
7. User chooses:
   - `Apply`
   - `Reject`
8. Only on `Apply` the document is updated and synced via Realtime.

Rule: **No auto-apply** from AI response.

---

## Stable Contract (Model-agnostic)

To support easy model switching, all providers must map to the same output schema.

### Client -> API (`POST /api/collab-docs/chat`)

```json
{
  "chatId": "uuid",
  "userMessageId": "uuid",
  "modelId": "gpt-4o",
  "contextDocumentIds": ["uuid", "uuid"]
}
```

### API -> Client

```json
{
  "ok": true,
  "candidate": {
    "candidateId": "uuid",
    "modelId": "gpt-4o",
    "chatReply": "I updated section 2 and clarified timeline.",
    "documentMarkdown": "# ... full text ...",
    "usage": { "prompt_tokens": 2000, "completion_tokens": 900 },
    "latencyMs": 4200
  }
}
```

If model changes (OpenAI, Anthropic, etc.), response shape must stay the same.

---

## Diff Engine

MVP: line-based diff.

Suggested frontend lib:
- `diff` (jsdiff), using `diffLines` or `createPatch`.

UI rendering:
- deleted lines: red block
- added lines: green block
- unchanged lines: neutral

V2:
- word-level highlighting inside changed lines
- collapse unchanged long ranges

---

## Cursor-like UX (Single Candidate)

## 1) Ask
- user sends message + context + selected model
- UI state: `Generating proposal...`

## 2) Review
- show assistant summary (`chatReply`)
- show full diff preview
- show model, latency, rough cost

## 3) Decide
- `Apply changes`
- `Reject changes`

## 4) Apply
- update `documents.content`
- insert assistant event/message that proposal was applied
- broadcast to collaborators via Realtime

---

## Data Model (Recommended)

Use proposal table even with one model; this gives auditability and clean apply flow.

`ai_change_candidates`
- `id uuid pk`
- `chat_id uuid fk`
- `document_id uuid fk`
- `base_document_content text` (snapshot before AI call)
- `candidate_document_content text`
- `model text`
- `chat_reply text`
- `status text` check in (`pending`, `applied`, `rejected`, `superseded`)
- `usage jsonb`
- `latency_ms int`
- `created_at timestamptz default now()`
- `applied_at timestamptz null`
- `applied_by text null`

Why keep `base_document_content`:
- deterministic diff
- safe stale-check before apply

---

## Concurrency / Stale Safety

Before apply:
1. Load current `documents.content`.
2. Compare with `base_document_content` of candidate.
3. If mismatch, block apply and show:
   - "Document changed since this proposal was generated."
   - action: `Regenerate proposal`

MVP: do not force-apply.

---

## Prompt + Provider Adapter

Internal provider outputs (OpenAI/Anthropic specific) must pass through adapter:

```json
{
  "chat_reply": "string",
  "document_markdown": "string"
}
```

Adapter maps provider response -> canonical `candidate`.

This is the core that guarantees:
- switch model in UI
- keep same downstream diff/apply logic

---

## Security / Limits

- provider keys server-side only
- request size limits
- context truncation limits
- store usage and latency
- rate limit by IP/chat

---

## Implementation Plan

### Phase 1
- single-model run
- proposal response (`candidate`)
- diff preview
- apply/reject

### Phase 2
- stale-check + conflict UI polish
- better diff rendering UX

### Phase 3
- optional partial apply (chunk/section)

---

## Acceptance Criteria

- One selected model runs per request.
- Model can be switched in UI without changing API contract.
- Diff (green/red) is shown before apply.
- Document changes only on explicit apply.
- Apply is blocked if base snapshot is stale.
