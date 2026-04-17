import {
  agentWritingOutputSchema,
  pushAgentDiagnostic,
  type AgentCritique,
  type AgentIntent,
  type AgentResearchState,
  type AgentRunState,
  type AgentWritingOutput,
} from "@/lib/agent-graph/state";

export type RefineUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type InvokeRefineModel = (args: {
  systemPrompt: string;
  turns: ChatTurn[];
  maxTokens: number;
}) => Promise<{ text: string; usage: RefineUsage }>;

type RunRefineNodeInput = {
  state: AgentRunState;
  userText: string;
  language: string;
  intent: AgentIntent;
  previousDraft: string;
  critique: AgentCritique;
  research?: AgentResearchState;
  iteration: number;
  maxTokens: number;
  invokeModel: InvokeRefineModel;
};

type RunRefineNodeOutput = {
  state: AgentRunState;
  writing: AgentWritingOutput;
  usage: RefineUsage;
  raw: string;
};

function stripJsonFences(raw: string): string {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  return fence ? fence[1].trim() : t;
}

function intentInstructions(intent: AgentIntent): string {
  switch (intent) {
    case "compare":
      return "The user wants a comparison. Improve how differences and shared patterns are drawn out.";
    case "multi_doc_summary":
      return "The user wants a synthesized document built from multiple sources. Improve cross-source integration and depth.";
    default:
      return "Improve the draft while keeping it aligned with the original request.";
  }
}

function buildRefineSystemPrompt(params: {
  language: string;
  intent: AgentIntent;
}): string {
  return `You are a senior editor rewriting a markdown draft to address specific weaknesses.

Target language: ${params.language}
Intent: ${params.intent}

Hard rules:
- Address every listed weakness directly. Do not ignore any.
- Preserve the user's original intent and language.
- Stay faithful to the research material. Do NOT invent facts or numbers.
- Do NOT shorten the document if the weaknesses call for more depth or specificity.
- Do NOT force templates or arbitrary minimums; structure must fit the actual content.
- Keep what is already good — only rewrite parts that relate to the weaknesses.
- No service markers ("chunk_index", raw JSON, code fences around the document body).

${intentInstructions(params.intent)}

Output contract:
- Return ONLY a single JSON object (no code fences, no commentary).
- Shape:
{
  "markdown": string,
  "chat_reply": string,
  "language": string
}
- "markdown" must be the full rewritten document.
- "chat_reply" is one short sentence about what changed (<= 200 chars).`;
}

function buildRefineUserTurn(params: {
  userText: string;
  previousDraft: string;
  critique: AgentCritique;
  research?: AgentResearchState;
  iteration: number;
}): string {
  const researchBlock = params.research
    ? `Research (authoritative material; do not go beyond it):\n${JSON.stringify(params.research, null, 2)}\n`
    : "Research: (not available)\n";
  const weaknessesBlock =
    params.critique.weaknesses.length > 0
      ? params.critique.weaknesses.map((w, i) => `${i + 1}. ${w}`).join("\n")
      : "(no explicit weaknesses listed; still improve depth and concreteness)";

  return `User request:
${params.userText}

Refinement iteration: ${params.iteration + 1}
Previous critique summary: ${params.critique.summary || "(none)"}
Previous coverage notes: ${params.critique.coverage_notes || "(none)"}
Weaknesses to address:
${weaknessesBlock}

${researchBlock}
Previous draft:
---
${params.previousDraft}
---

Produce the refined writing JSON now.`;
}

export async function runRefineNode(
  input: RunRefineNodeInput
): Promise<RunRefineNodeOutput> {
  let state = pushAgentDiagnostic(input.state, {
    stage: "writing",
    code: "refine.invoke",
    message: `Invoking refine step (iteration=${input.iteration + 1}; weaknesses=${input.critique.weaknesses.length}).`,
  });

  const systemPrompt = buildRefineSystemPrompt({
    language: input.language,
    intent: input.intent,
  });
  const userTurn = buildRefineUserTurn({
    userText: input.userText,
    previousDraft: input.previousDraft,
    critique: input.critique,
    research: input.research,
    iteration: input.iteration,
  });

  const llm = await input.invokeModel({
    systemPrompt,
    turns: [{ role: "user", content: userTurn }],
    maxTokens: input.maxTokens,
  });

  const rawStripped = stripJsonFences(llm.text);
  const parsed = JSON.parse(rawStripped);
  const writing = agentWritingOutputSchema.parse(parsed);

  state = {
    ...state,
    stage: "writing",
    writing,
  };
  state = pushAgentDiagnostic(state, {
    stage: "writing",
    code: "refine.ready",
    message: `refined markdown_chars=${writing.markdown.length}; language=${writing.language}`,
  });

  return {
    state,
    writing,
    usage: llm.usage,
    raw: llm.text,
  };
}
