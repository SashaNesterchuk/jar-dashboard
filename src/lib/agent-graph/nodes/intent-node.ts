import type { AgentIntent, AgentRunState } from "@/lib/agent-graph/state";
import { z } from "zod";

type IntentNodeInput = {
  state: AgentRunState;
  userText: string;
  contextDocumentCount: number;
  /** Optional persona / skill text so the classifier can interpret the user’s hat. */
  skillContext?: string | null;
  inferIntent: (args: {
    userText: string;
    contextDocumentCount: number;
    skillContext?: string | null;
  }) => Promise<IntentNodeOutput>;
};

type IntentNodeOutput = {
  intent: AgentIntent;
  language: string;
  confidence: number;
  reasons: string[];
};

export const intentOutputSchema = z.object({
  intent: z.enum([
    "answer_only",
    "edit_local",
    "edit_with_context",
    "multi_doc_summary",
    "compare",
  ]),
  language: z.string().default("unknown"),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).default([]),
});

export async function runIntentNode(input: IntentNodeInput): Promise<{
  state: AgentRunState;
  result: IntentNodeOutput;
}> {
  const inferred = await input.inferIntent({
    userText: input.userText,
    contextDocumentCount: input.contextDocumentCount,
    skillContext: input.skillContext,
  });
  const result = intentOutputSchema.parse(inferred);
  const nextState: AgentRunState = {
    ...input.state,
    stage: "intent",
    intent: result.intent,
    language: result.language,
  };
  return {
    state: nextState,
    result,
  };
}
