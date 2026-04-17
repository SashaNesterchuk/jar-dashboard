import { z } from "zod";

export type AgentIntent =
  | "unknown"
  | "answer_only"
  | "edit_local"
  | "edit_with_context"
  | "multi_doc_summary"
  | "compare";

export type AgentStage =
  | "intent"
  | "context_plan"
  | "draft_plan"
  | "research"
  | "writing"
  | "critique"
  | "propose_patch"
  | "validate"
  | "repair"
  | "complete";

export const agentSourceSchema = z.object({
  document_id: z.string().uuid(),
  chunk_index: z.number().int().nonnegative().optional(),
  section_path: z.string().nullable().optional(),
  reason: z.string(),
});

export type AgentSource = z.infer<typeof agentSourceSchema>;

export const agentBudgetSchema = z.object({
  max_input_tokens: z.number().int().positive(),
  reserved_output_tokens: z.number().int().nonnegative(),
  used_input_tokens: z.number().int().nonnegative().default(0),
});

export type AgentBudget = z.infer<typeof agentBudgetSchema>;

export const agentValidationSchema = z.object({
  structural_ok: z.boolean().default(true),
  language_ok: z.boolean().default(true),
  safety_ok: z.boolean().default(true),
  source_coverage_ok: z.boolean().default(true),
  issues: z.array(z.string()).default([]),
});

export type AgentValidation = z.infer<typeof agentValidationSchema>;

export const agentPlanSchema = z.object({
  summary: z.string().default(""),
  depth: z.enum(["brief", "normal", "deep"]).default("normal"),
  targets: z.array(z.string()).default([]),
});

export type AgentPlan = z.infer<typeof agentPlanSchema>;

export const agentResearchQuoteSchema = z.object({
  text: z.string(),
  source_hint: z.string().optional(),
});

export const agentResearchSourceRefSchema = z.object({
  doc_hint: z.string(),
  excerpt: z.string(),
});

export const agentResearchStateSchema = z.object({
  topic: z.string().default(""),
  language: z.string().default("unknown"),
  key_facts: z.array(z.string()).default([]),
  numbers: z.array(z.string()).default([]),
  quotes: z.array(agentResearchQuoteSchema).default([]),
  contradictions: z.array(z.string()).default([]),
  source_refs: z.array(agentResearchSourceRefSchema).default([]),
  notes: z.string().default(""),
});

export type AgentResearchState = z.infer<typeof agentResearchStateSchema>;

export const agentWritingOutputSchema = z.object({
  markdown: z.string().min(1),
  chat_reply: z.string().default(""),
  language: z.string().default("unknown"),
});

export type AgentWritingOutput = z.infer<typeof agentWritingOutputSchema>;

export const agentCritiqueSchema = z.object({
  quality_score: z.number().min(0).max(1),
  language_ok: z.boolean().default(true),
  weaknesses: z.array(z.string()).default([]),
  coverage_notes: z.string().default(""),
  summary: z.string().default(""),
});

export type AgentCritique = z.infer<typeof agentCritiqueSchema>;

export const agentCritiqueHistoryEntrySchema = z.object({
  iteration: z.number().int().nonnegative(),
  source: z.enum(["initial", "refine"]),
  quality_score: z.number().min(0).max(1),
  weaknesses_count: z.number().int().nonnegative(),
  language_ok: z.boolean(),
  accepted: z.boolean().default(true),
});

export type AgentCritiqueHistoryEntry = z.infer<
  typeof agentCritiqueHistoryEntrySchema
>;

export const agentPatchDraftSchema = z.object({
  chat_reply: z.string().default(""),
  patches: z
    .array(
      z.object({
        target_chunk_index: z.number().int().nonnegative(),
        new_text: z.string(),
      })
    )
    .default([]),
});

export type AgentPatchDraft = z.infer<typeof agentPatchDraftSchema>;

export const agentDiagnosticSchema = z.object({
  stage: z.enum([
    "intent",
    "context_plan",
    "draft_plan",
    "research",
    "writing",
    "critique",
    "propose_patch",
    "validate",
    "repair",
    "complete",
  ]),
  code: z.string(),
  message: z.string(),
  at_ms: z.number().int().nonnegative(),
});

export type AgentDiagnostic = z.infer<typeof agentDiagnosticSchema>;

export const agentRunStateSchema = z.object({
  run_id: z.string(),
  started_at_ms: z.number().int().nonnegative(),
  chat_id: z.string().uuid(),
  document_id: z.string().uuid().nullable(),
  user_message_id: z.string().uuid(),
  model_id: z.string(),
  language: z.string().default("unknown"),
  intent: z
    .enum([
      "unknown",
      "answer_only",
      "edit_local",
      "edit_with_context",
      "multi_doc_summary",
      "compare",
    ])
    .default("unknown"),
  stage: z
    .enum([
      "intent",
      "context_plan",
      "draft_plan",
      "research",
      "writing",
      "critique",
      "propose_patch",
      "validate",
      "repair",
      "complete",
    ])
    .default("intent"),
  retries: z.number().int().nonnegative().default(0),
  selected_sources: z.array(agentSourceSchema).default([]),
  budget: agentBudgetSchema,
  plan: agentPlanSchema.optional(),
  research: agentResearchStateSchema.optional(),
  writing: agentWritingOutputSchema.optional(),
  critique: agentCritiqueSchema.optional(),
  critique_history: z.array(agentCritiqueHistoryEntrySchema).default([]),
  refine_iterations_used: z.number().int().nonnegative().default(0),
  patch_draft: agentPatchDraftSchema.optional(),
  validation: agentValidationSchema.optional(),
  diagnostics: z.array(agentDiagnosticSchema).default([]),
});

export type AgentRunState = z.infer<typeof agentRunStateSchema>;

export function createInitialAgentRunState(params: {
  chatId: string;
  userMessageId: string;
  modelId: string;
  maxInputTokens: number;
  reservedOutputTokens: number;
}): AgentRunState {
  return agentRunStateSchema.parse({
    run_id: crypto.randomUUID(),
    started_at_ms: Date.now(),
    chat_id: params.chatId,
    document_id: null,
    user_message_id: params.userMessageId,
    model_id: params.modelId,
    language: "unknown",
    intent: "unknown",
    stage: "intent",
    retries: 0,
    selected_sources: [],
    budget: {
      max_input_tokens: params.maxInputTokens,
      reserved_output_tokens: params.reservedOutputTokens,
      used_input_tokens: 0,
    },
    critique_history: [],
    refine_iterations_used: 0,
    diagnostics: [],
  });
}

export function pushAgentDiagnostic(
  state: AgentRunState,
  entry: Omit<AgentDiagnostic, "at_ms">
): AgentRunState {
  return {
    ...state,
    stage: entry.stage,
    diagnostics: [
      ...state.diagnostics,
      {
        ...entry,
        at_ms: Date.now(),
      },
    ],
  };
}
